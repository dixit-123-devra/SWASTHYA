const express = require('express');
const cors = require('cors');
const multer = require('multer');
require('dotenv').config();

const { 
  registerPatientFace, 
  recognizePatientFace,
  mapPatientToDoctor,
  getDoctorPatients,
  removeMappedPatient,
  processAndStoreLabReport, 
  getSecureDocumentAccess, 
  sendOTP,
  sendFamilyAccessEmail
} = require('./controllers/patientController');

const app = express();
app.use(cors());
app.use(express.json());

// Configure Multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Routes
app.post('/api/patients/register-face', registerPatientFace);
app.post('/api/patients/recognize-face', recognizePatientFace);
app.post('/api/doctors/map-patient', mapPatientToDoctor);
app.get('/api/doctors/:doctorId/patients', getDoctorPatients);
app.delete('/api/doctors/:doctorId/patients/:uniqueId', removeMappedPatient);
app.post('/api/patients/send-otp', sendOTP);
app.post('/api/patients/family-access', sendFamilyAccessEmail);
app.post('/api/patients/upload-lab', upload.single('document'), processAndStoreLabReport);
app.get('/api/patients/:uniqueId/files/:folderType/:fileName', getSecureDocumentAccess);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`[Swasthya Backend] Server running on port ${PORT}`);
  console.log(`[Swasthya Backend] S3 & Firebase connected (Mock mode active if no credentials provided)`);
});
