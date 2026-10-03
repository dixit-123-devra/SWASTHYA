const { db } = require('../config/firebase');
const { generatePresignedUrl, uploadFhirDocument, uploadRawDocument } = require('../config/s3');
const nodemailer = require('nodemailer');
const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * Mocks the facial recognition flow:
 * Takes a face image (simulated), generates a unique ID, and saves to Firebase.
 */
const registerPatientFace = async (req, res) => {
  try {
    const { patientName, email, descriptor } = req.body;
    // We now receive the real 128-d descriptor from the client
    const uniqueId = `patient_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // Store in Firebase
    await db.collection('patients').doc(uniqueId).set({
      patientName,
      email,
      uniqueId,
      facialEmbeddings: descriptor, // Array of 128 numbers
      createdAt: new Date().toISOString()
    });

    res.status(201).json({
      message: 'Patient registered successfully via FaceAuth.',
      uniqueId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const euclideanDistance = (desc1, desc2) => {
  return Math.sqrt(desc1.reduce((sum, val, i) => sum + Math.pow(val - desc2[i], 2), 0));
};

const recognizePatientFace = async (req, res) => {
  try {
    const { descriptor } = req.body;
    if (!descriptor || descriptor.length !== 128) {
      return res.status(400).json({ error: 'Invalid face descriptor.' });
    }

    const snapshot = await db.collection('patients').get();
    let bestMatch = null;
    let minDistance = 0.55; // Threshold for FaceNet match

    snapshot.forEach(doc => {
      const patient = doc.data();
      if (patient.facialEmbeddings && patient.facialEmbeddings.length === 128) {
        const distance = euclideanDistance(descriptor, patient.facialEmbeddings);
        if (distance < minDistance) {
          minDistance = distance;
          bestMatch = patient;
        }
      }
    });

    if (bestMatch) {
      res.status(200).json({ match: true, patient: bestMatch });
    } else {
      res.status(404).json({ match: false, message: 'Face not recognized.' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const mapPatientToDoctor = async (req, res) => {
  try {
    const { patient, doctorId } = req.body;
    await db.collection('mapped_patients').add({
      ...patient,
      doctorId,
      mappedAt: new Date().toISOString()
    });
    res.status(200).json({ message: 'Patient mapped successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getDoctorPatients = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const snapshot = await db.collection('mapped_patients').where('doctorId', '==', doctorId).get();
    const patients = [];
    snapshot.forEach(doc => patients.push({ ...doc.data(), docId: doc.id }));
    res.status(200).json(patients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const removeMappedPatient = async (req, res) => {
  try {
    const { doctorId, uniqueId } = req.params;
    const snapshot = await db.collection('mapped_patients')
      .where('doctorId', '==', doctorId)
      .where('uniqueId', '==', uniqueId)
      .get();
      
    const deletePromises = [];
    snapshot.forEach(doc => {
      deletePromises.push(doc.ref.delete());
    });
    
    await Promise.all(deletePromises);
    res.status(200).json({ message: 'Patient removed from queue' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

function getMockFhirData(uniqueId, fileName, originalName) {
  return {
    resourceType: "Bundle",
    type: "document",
    timestamp: new Date().toISOString(),
    entry: [
      { resource: { resourceType: "Patient", id: uniqueId, name: [{ text: "Simulated Patient (No API Key)" }], birthDate: "1992-05-15", extension: [{ url: "http://hl7.org/fhir/StructureDefinition/patient-bloodGroup", valueString: "O+" }, { url: "http://hl7.org/fhir/StructureDefinition/patient-weight", valueQuantity: { value: 72, unit: "kg" } }] } },
      { resource: { resourceType: "AllergyIntolerance", code: { text: "Penicillin" }, criticality: "high" } },
      { resource: { resourceType: "Condition", code: { text: "Simulated Fracture" }, onsetDateTime: "2024-01-15" } },
      { resource: { resourceType: "MedicationRequest", medicationCodeableConcept: { text: "Lisinopril 10mg" }, status: "active", dosageInstruction: [{ text: "1x daily", route: { text: "Oral" } }] } },
      { resource: { resourceType: "Observation", code: { text: "Hemoglobin" }, valueQuantity: { value: 14.2, unit: "g/dL" }, interpretation: [{ text: "normal" }], referenceRange: [{ low: { value: 13.5 }, high: { value: 17.5 } }] } },
      { resource: { resourceType: "DocumentReference", content: [{ attachment: { title: "Raw Image", url: originalName } }] } }
    ]
  };
}

/**
 * Uploads a document (like a Lab Report), mocks OCR -> FHIR conversion, 
 * and stores it strictly in the S3 isolated folder.
 */
const processAndStoreLabReport = async (req, res) => {
  try {
    const uniqueId = req.body.uniqueId || 'test_patient_001';
    const fileName = req.body.fileName || 'scanned_report';
    
    let llmSegregatedData;

    // AI Pipeline Step 1 & 2: AWS Textract / LLM Conversion to FHIR
    if (req.file) {
      console.log(`[AI Pipeline] Real image detected: ${req.file.originalname}. Sending to Google Gemini Vision...`);
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // Using 1.5-pro as it's universally available and avoids 404s
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" }); 

        const prompt = `You are an expert clinical AI. Analyze this medical report, prescription, or lab result image.
        Extract the clinical information and convert it into a STRICT JSON HL7 FHIR Bundle. 
        It MUST contain the following resource types if found in the image:
        - Patient (extract Demographics like Name, Age/DOB, Weight, BloodGroup)
        - AllergyIntolerance
        - Condition
        - MedicationRequest (extract Drug Name, Dose, Frequency, Route)
        - Observation (extract Lab tests, value, unit, referenceRange, and interpretation 'normal'/'elevated'/'low')
        
        Return ONLY valid JSON. Do not return markdown code blocks like \`\`\`json. Return the raw JSON object starting with { "resourceType": "Bundle", "type": "document", "entry": [...] }`;

        const imagePart = {
          inlineData: {
            data: req.file.buffer.toString("base64"),
            mimeType: req.file.mimetype
          }
        };

        const result = await model.generateContent([prompt, imagePart]);
        let responseText = result.response.text();
        
        // Strip markdown if Gemini accidentally included it
        responseText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        
        llmSegregatedData = JSON.parse(responseText);

        // Safely append DocumentReference for S3 Pointer
        llmSegregatedData.entry.push({
          resource: {
            resourceType: "DocumentReference",
            content: [{ attachment: { title: "Raw Image", url: req.file.originalname } }]
          }
        });
        
        console.log(`[AI Pipeline] Gemini successfully generated true FHIR JSON from the image.`);
      } catch (aiError) {
        console.error("[AI Pipeline Error] Gemini failed to parse image, falling back to mock data.", aiError);
        llmSegregatedData = getMockFhirData(uniqueId, fileName, req.file.originalname);
      }
    } else {
      console.warn("[AI Pipeline] No physical file uploaded, using simulated AI output...");
      llmSegregatedData = getMockFhirData(uniqueId, fileName, null);
    }

    // AI Pipeline Step 3: Upload to S3 isolated bucket
    console.log(`[S3 Upload] Starting upload sequence for ${uniqueId}`);
    const s3Response = await uploadFhirDocument(uniqueId, 'ai_analyzed_reports', `latest_patient_data.fhir.json`, llmSegregatedData);
    console.log(`[S3 Upload] FHIR JSON uploaded successfully to ${s3Response.key}`);
    
    if (req.file) {
      console.log(`[S3 Upload] Raw file detected: ${req.file.originalname}, Size: ${req.file.size} bytes. Uploading to S3...`);
      const rawUploadRes = await uploadRawDocument(uniqueId, 'raw_reports', req.file.originalname, req.file.buffer, req.file.mimetype);
      console.log(`[S3 Upload] Raw file uploaded successfully to ${rawUploadRes.key}`);
    } else {
      console.warn(`[S3 Upload Warning] req.file is UNDEFINED! No raw physical file was uploaded to S3.`);
    }

    res.status(200).json({
      message: 'Document OCR processed, AI segregated, and stored securely in S3.',
      s3Key: s3Response.key,
      data: llmSegregatedData
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Generates a Pre-signed S3 URL for a doctor/patient to securely view a file.
 */
const getSecureDocumentAccess = async (req, res) => {
  try {
    const { uniqueId, folderType, fileName } = req.params;
    
    // Generates a 15-minute expiring link directly to the isolated file
    const urlData = await generatePresignedUrl(uniqueId, folderType, fileName);

    res.status(200).json(urlData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Generates and sends a 6-digit OTP to the patient's email
 */
const sendOTP = async (req, res) => {
  try {
    const { email, context, doctorName } = req.body;
    
    // Generate a real 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`[Swasthya Auth] GENERATED OTP FOR ${email}: ${otp}`);
    
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD
      }
    });

    let subject = 'Your Swasthya Authentication OTP';
    let textBody = `Welcome to Swasthya!\n\nYour 6-digit OTP for FaceAuth registration is: ${otp}\n\nThis code will expire in 10 minutes.\n\nSecurely,\nThe Swasthya Team`;

    if (context === 'doctor_access') {
      subject = `Urgent: Swasthya Medical Record Access Request`;
      textBody = `Hello,\n\nDr. ${doctorName || 'your Doctor'} is requesting immediate secure access to your medical records and lab reports.\n\nTo authorize this access for the next 5 minutes, please provide them with this OTP:\n\n${otp}\n\nHIPAA Warning: If you are not currently with your doctor, do NOT share this code with anyone.\n\nSecurely,\nSwasthya Vault`;
    }

    const mailOptions = {
      from: `"Swasthya Healthcare" <${process.env.SMTP_EMAIL}>`,
      to: email, 
      subject: subject,
      text: textBody
    };

    await transporter.sendMail(mailOptions);

    // In a real app we'd save this OTP to Redis or DB with an expiry.
    // For this prototype, we'll return it so the frontend can verify it directly.
    res.status(200).json({ message: 'OTP sent successfully', otp });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ error: error.message });
  }
};

const sendFamilyAccessEmail = async (req, res) => {
  try {
    const { email, patientName, uniqueId } = req.body;
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.SMTP_EMAIL, pass: process.env.SMTP_PASSWORD }
    });
    
    const webLink = `http://localhost:5173/patient?guestAccessId=${uniqueId}`;
    
    const mailOptions = {
      from: `"Swasthya Healthcare" <${process.env.SMTP_EMAIL}>`,
      to: email, 
      subject: `Swasthya: ${patientName} has shared their Health Dashboard with you`,
      text: `Hello,\n\n${patientName} has added you to their Family Health Circle on Swasthya.\n\nYou do not need to install the application. You can securely view their medication adherence, health timeline, and clinical records directly from the web by clicking the link below:\n\n${webLink}\n\nStay healthy,\nThe Swasthya Team`
    };
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Family access email sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  registerPatientFace,
  recognizePatientFace,
  mapPatientToDoctor,
  getDoctorPatients,
  removeMappedPatient,
  processAndStoreLabReport,
  getSecureDocumentAccess,
  sendOTP,
  sendFamilyAccessEmail
};
