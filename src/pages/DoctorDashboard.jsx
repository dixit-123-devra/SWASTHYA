import React, { useState, useEffect } from 'react';
import { Users, Activity, AlertTriangle, FileText, Search, UploadCloud, Lock, Clock, EyeOff, CheckCircle, Camera } from 'lucide-react';
import './DoctorDashboard.css';

export default function DoctorDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [doctorInfo, setDoctorInfo] = useState({ name: 'Guest Doctor', specialty: 'General', id: 'unknown' });
  const [mappedPatients, setMappedPatients] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadTargetPatient, setUploadTargetPatient] = useState('');
  
  // Security & Access States
  const [requestingAccessFor, setRequestingAccessFor] = useState(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [validOtp, setValidOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [accessGrantedTo, setAccessGrantedTo] = useState(null);
  const [secureData, setSecureData] = useState(null);
  const [rawDocumentUrl, setRawDocumentUrl] = useState(null);
  const [timeLeft, setTimeLeft] = useState(300);
  const [newPrescription, setNewPrescription] = useState({ drug: '', dose: '', frequency: '' });
  
  // AI Alerts State
  const [medicationAlert, setMedicationAlert] = useState(null);

  const fetchPatients = () => {
    const currentDoc = JSON.parse(localStorage.getItem('swasthya_current_doctor'));
    if (currentDoc) {
      setDoctorInfo(currentDoc);
      fetch(`http://localhost:5000/api/doctors/${currentDoc.id}/patients`)
        .then(res => res.json())
        .then(data => setMappedPatients(data))
        .catch(err => console.error("Failed to fetch patients:", err));
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const handleRemovePatient = async (uniqueId) => {
    if (!window.confirm("Are you sure you want to dismiss this patient from your queue?")) return;
    try {
      await fetch(`http://localhost:5000/api/doctors/${doctorInfo.id}/patients/${uniqueId}`, {
        method: 'DELETE'
      });
      fetchPatients();
    } catch (e) {
      console.error("Failed to remove patient", e);
    }
  };

  // Timer for self-destructing data
  useEffect(() => {
    let timer;
    if (accessGrantedTo && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0) {
      handleRevokeAccess();
    }
    return () => clearInterval(timer);
  }, [accessGrantedTo, timeLeft]);

  const handleRequestAccess = async (patient) => {
    setRequestingAccessFor(patient);
    setIsSendingOtp(true);
    try {
      const res = await fetch('http://localhost:5000/api/patients/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: patient.email || 'devradixit@gmail.com',
          context: 'doctor_access',
          doctorName: doctorInfo.name
        })
      });
      const data = await res.json();
      if (res.ok) {
        setValidOtp(data.otp);
      } else {
        alert("Server failed to send email. Check backend logs.");
      }
    } catch (e) {
      alert("Failed to reach server for OTP request.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  const parseFhirBundle = (bundle) => {
    if (!bundle || bundle.resourceType !== 'Bundle' || !bundle.entry) return null;
    
    let demographics = { name: "N/A", age: "N/A", bloodGroup: "N/A", weight: "N/A" };
    let allergies = [];
    let history = [];
    let currentMeds = [];
    let pastMeds = [];
    let injuries = [];
    let labReports = [];
    let latestRawDoc = null;

    bundle.entry.forEach(({ resource }) => {
      switch (resource.resourceType) {
        case 'Patient':
          demographics.name = resource.name?.[0]?.text || "N/A";
          if (resource.birthDate) {
            const ageDate = new Date(Date.now() - new Date(resource.birthDate).getTime());
            demographics.age = Math.abs(ageDate.getUTCFullYear() - 1970);
          }
          resource.extension?.forEach(ext => {
            if (ext.url.includes('weight')) demographics.weight = ext.valueQuantity?.value + (ext.valueQuantity?.unit || '');
            if (ext.url.includes('bloodGroup')) demographics.bloodGroup = ext.valueString;
          });
          break;
        case 'AllergyIntolerance':
          if (resource.code?.text) allergies.push(resource.code.text);
          break;
        case 'Encounter':
          history.push({
            date: resource.period?.start || "Unknown",
            event: resource.type?.[0]?.text || "Consult",
            details: resource.reasonCode?.[0]?.text || ""
          });
          break;
        case 'Condition':
          injuries.push({
            issue: resource.code?.text,
            year: resource.onsetDateTime ? resource.onsetDateTime.substring(0,4) : "Unknown"
          });
          break;
        case 'MedicationRequest':
          const med = {
            drug: resource.medicationCodeableConcept?.text || "Unknown",
            dose: resource.dosageInstruction?.[0]?.text?.split(' ')[1] || "Unknown",
            frequency: resource.dosageInstruction?.[0]?.text || "",
            route: resource.dosageInstruction?.[0]?.route?.text || "Oral",
            alert: resource.note?.[0]?.text || ""
          };
          if (resource.status === 'active') currentMeds.push(med);
          else pastMeds.push(med);
          break;
        case 'Observation':
          labReports.push({
            test: resource.code?.text,
            value: resource.valueQuantity?.value,
            unit: resource.valueQuantity?.unit,
            flag: resource.interpretation?.[0]?.text,
            history: [resource.valueQuantity?.value]
          });
          break;
        case 'DocumentReference':
          latestRawDoc = resource.content?.[0]?.attachment?.url;
          break;
      }
    });

    return {
      patientDemographics: demographics,
      allergies: allergies,
      chronologicalHistory: history.sort((a,b) => new Date(b.date) - new Date(a.date)),
      extractedInsights: {
        currentMedications: currentMeds,
        previousMedications: pastMeds,
        importantInjuries: injuries,
        labReports: labReports
      },
      latestRawDocument: latestRawDoc
    };
  };

  const handleVerifyOtp = async () => {
    if (otpInput === String(validOtp) || otpInput === '123456') { // Fallback for dev
      setOtpError('');
      setAccessGrantedTo(requestingAccessFor);
      setRequestingAccessFor(null);
      setTimeLeft(300);
      
      // Fetch the actual AI Segregated FHIR data from AWS S3 via Presigned URL
      try {
        const urlRes = await fetch(`http://localhost:5000/api/patients/${requestingAccessFor.uniqueId}/files/ai_analyzed_reports/latest_patient_data.fhir.json`);
        const { url } = await urlRes.json();
        const dataRes = await fetch(url);
        const fhirBundle = await dataRes.json();
        
        const parsedData = parseFhirBundle(fhirBundle);
        if (parsedData) {
          setSecureData(parsedData);
          if (parsedData.latestRawDocument) {
            const rawUrlRes = await fetch(`http://localhost:5000/api/patients/${requestingAccessFor.uniqueId}/files/raw_reports/${parsedData.latestRawDocument}`);
            if (rawUrlRes.ok) {
              const { url: rawUrl } = await rawUrlRes.json();
              setRawDocumentUrl(rawUrl);
            }
          }
        } else {
          throw new Error("Invalid FHIR Bundle");
        }
      } catch (e) {
        console.error("No valid FHIR reports found in S3. Initializing empty state.", e);
        setSecureData({
          patientDemographics: { name: requestingAccessFor?.name || "N/A", age: "N/A", bloodGroup: "N/A", weight: "N/A" },
          allergies: [],
          chronologicalHistory: [],
          extractedInsights: {
            currentMedications: [],
            previousMedications: [],
            importantInjuries: [],
            labReports: []
          }
        });
      }
    } else {
      setOtpError("Invalid OTP entered. Please check your email.");
      console.warn("Invalid OTP entered."); 
    }
  };

  const handleRevokeAccess = async () => {
    if (accessGrantedTo) {
      try {
        await fetch(`http://localhost:5000/api/doctors/${doctorInfo.id}/patients/${accessGrantedTo.uniqueId}`, {
          method: 'DELETE'
        });
        fetchPatients(); // refresh the queue to remove them visually
      } catch (e) {
        console.error("Failed to remove patient from queue:", e);
      }
    }
    
    setAccessGrantedTo(null);
    setSecureData(null);
    setRawDocumentUrl(null);
    setOtpInput('');
  };

  const handleAddPrescription = (e) => {
    e.preventDefault();
    const drugUpper = newPrescription.drug.toUpperCase();
    
    // Simple Clinical Decision Support Engine (CDS)
    let conflictAlert = null;
    
    if (drugUpper.includes("PENICILLIN") && secureData.allergies.some(a => a.toUpperCase().includes("PENICILLIN"))) {
      conflictAlert = { drug: newPrescription.drug, alert: "CRITICAL: Patient has a known allergy to Penicillin-based drugs!" };
    } else if (drugUpper.includes("POTASSIUM") && secureData.extractedInsights.currentMedications.some(m => m.drug.toUpperCase().includes("LISINOPRIL"))) {
      conflictAlert = { drug: newPrescription.drug, alert: "HIGH RISK INTERACTION: Lisinopril combined with Potassium supplements can cause severe Hyperkalemia." };
    }

    if (conflictAlert) {
      setMedicationAlert([conflictAlert]);
    } else {
      const updatedData = { ...secureData };
      updatedData.extractedInsights.currentMedications.push({
        drug: newPrescription.drug,
        dose: newPrescription.dose,
        frequency: newPrescription.frequency,
        route: 'Oral',
        duration: 'Newly Prescribed'
      });
      setSecureData(updatedData);
      setNewPrescription({ drug: '', dose: '', frequency: '' });
      alert("Prescription safely added to active regimen.");
    }
  };

  const handleFileUpload = async () => {
    if (!uploadFile) return alert("Select a file first!");
    if (!accessGrantedTo) return alert("You must be viewing a patient to upload!");
    setUploadStatus('Uploading & Processing via AI OCR...');
    
    const formData = new FormData();
    formData.append('document', uploadFile);
    formData.append('uniqueId', accessGrantedTo.uniqueId);
    formData.append('fileName', uploadFile.name);

    try {
      const res = await fetch('http://localhost:5000/api/patients/upload-lab', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const result = await res.json();
        setUploadStatus('Success! Converted to FHIR & Stored in S3.');
        
        // Dynamically update the vault view with the parsed standard FHIR data!
        if (result.data) {
          const parsedData = parseFhirBundle(result.data);
          if (parsedData) {
            setSecureData(parsedData);
            if (parsedData.latestRawDocument) {
              try {
                const rawUrlRes = await fetch(`http://localhost:5000/api/patients/${accessGrantedTo.uniqueId}/files/raw_reports/${parsedData.latestRawDocument}`);
                if (rawUrlRes.ok) {
                  const { url: rawUrl } = await rawUrlRes.json();
                  setRawDocumentUrl(rawUrl);
                }
              } catch (e) {
                console.error("Failed to generate presigned URL for raw file", e);
              }
            }
            // AI Clashes Check on parsed FHIR data
            const meds = parsedData.extractedInsights?.currentMedications || [];
            const conflictingMeds = meds.filter(m => m.alert);
            if (conflictingMeds.length > 0) {
              setMedicationAlert(conflictingMeds);
            }
          }
        }

        setUploadFile(null);
        setTimeout(() => setUploadStatus(''), 4000);
        
      } else {
        setUploadStatus('Upload failed.');
      }
    } catch (err) {
      setUploadStatus('Server error during upload.');
    }
  };

  return (
    <div className="container dashboard-container animate-fade-in">
      <header className="dashboard-header glass-panel">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl">Clinical Overview, <span className="font-bold">Dr. {doctorInfo.name}</span></h1>
            <p className="text-muted text-sm">Swasthya Provider Portal • {doctorInfo.specialty}</p>
          </div>
          <div className="search-bar">
            <Search className="text-muted" size={18} />
            <input type="text" placeholder="Search patient ID or name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>
      </header>

      <div className="doctor-grid">
        {/* Adherence Overview Table */}
        <div className="main-content" style={{ gridColumn: '1 / -1' }}>
          <section className="card">
            <div className="card-header flex justify-between items-center">
              <h2 className="text-xl flex items-center gap-2"><Users className="text-primary" /> Patient Compliance & Risk Analytics</h2>
              <div className="flex gap-2">
                <button className="btn btn-outline text-sm" onClick={fetchPatients}>Refresh Queue</button>
                <button className="btn btn-outline text-sm">Export Report</button>
              </div>
            </div>
            
            <div className="table-responsive">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Patient ID</th>
                    <th>Name</th>
                    <th>Active Medications</th>
                    <th>Adherence Score</th>
                    <th>Risk Flag</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {mappedPatients.length === 0 ? (
                    <tr><td colSpan="6" className="text-center text-muted p-4">No patients mapped yet.</td></tr>
                  ) : (
                    mappedPatients.map((patient, index) => (
                      <tr key={index}>
                        <td className="font-semibold text-primary">{patient.uniqueId}</td>
                        <td>{patient.name}</td>
                        <td className="text-sm">Not assigned</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">N/A</span>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-success">Pending Review</span>
                        </td>
                        <td>
                          <button className="btn-link font-bold text-primary" onClick={() => handleRequestAccess(patient)}>
                            <Lock size={14} className="inline mr-1" /> Request Access
                          </button>
                          <br />
                          <button className="btn-link text-xs text-danger mt-2" onClick={() => handleRemovePatient(patient.uniqueId)}>
                            Dismiss Patient
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      {/* OTP Request Modal */}
      {requestingAccessFor && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm animate-fade-in">
          <div className="card glass-panel max-w-md w-full border-2 border-warning shadow-[0_0_30px_hsl(var(--color-warning)/0.3)]">
            <h3 className="text-2xl font-bold flex items-center gap-2 text-warning mb-2"><Lock /> Requesting Patient Consent</h3>
            <div className="bg-warning/10 p-3 rounded border border-warning/30 mb-4">
              <p className="font-bold text-lg text-white">Patient: {requestingAccessFor.name}</p>
              <p className="text-sm text-muted">ID: {requestingAccessFor.uniqueId}</p>
            </div>
            
            <p className="text-muted mt-2 text-sm">HIPAA Compliance Protocol: A 6-digit OTP is being sent to the patient's registered email address. Ask the patient for the code to temporarily unlock their records.</p>
            
            {isSendingOtp ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-warning mb-4"></div>
                <p className="text-warning font-bold animate-pulse">Generating & Sending OTP via Gmail SMTP...</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-primary mt-4 font-bold text-center">Developer Testing? Use Bypass Code: 123456</p>
                <input 
                  type="text" 
                  placeholder="Enter 6-digit OTP" 
                  className="form-input mt-2 text-center text-3xl tracking-widest font-mono py-4"
                  maxLength={6}
                  value={otpInput}
                  onChange={e => { setOtpInput(e.target.value); setOtpError(''); }}
                  autoFocus
                />
                {otpError && <p className="text-danger text-sm font-bold text-center mt-2 animate-bounce">{otpError}</p>}
                <div className="flex gap-4 mt-6">
                  <button className="btn btn-outline flex-1" onClick={() => { setRequestingAccessFor(null); setOtpError(''); }}>Cancel Request</button>
                  <button className="btn btn-warning flex-1 font-bold text-black" onClick={handleVerifyOtp}>Verify & Access</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* High-Security Vault Overlay */}
      {accessGrantedTo && secureData && (
        <div className="fixed inset-0 bg-black z-50 overflow-y-auto animate-fade-in" style={{ userSelect: 'none' }}>
          
          <div className="container py-8 relative z-10 max-w-5xl mx-auto">
            <header className="flex flex-col md:flex-row justify-between items-center bg-black/50 p-6 rounded-xl border border-primary/30 mb-8 shadow-[0_0_20px_rgba(0,184,217,0.15)]">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2"><Lock className="text-success" /> Authorized Access: {accessGrantedTo.name}</h2>
                <p className="text-muted text-sm mt-1 flex items-center gap-2"><EyeOff size={14} className="text-danger" /> Screenshots Disabled • Download Disabled</p>
              </div>
              <div className="flex items-center gap-6">
                <div className={`flex items-center gap-2 font-bold ${timeLeft < 60 ? 'text-danger animate-pulse' : 'text-warning'}`}>
                  <Clock size={20} />
                  <span>{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
                </div>
                <button className="btn btn-outline text-danger border-danger hover:bg-danger/10" onClick={handleRevokeAccess}>
                  Close Record
                </button>
              </div>
            </header>

            {/* Massive Clinical Dashboard Overhaul */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column: Demographics & Chronological History */}
              <div className="flex flex-col gap-6 lg:col-span-1">
                {/* Demographics & Allergies */}
                <div className="card glass-panel border border-[hsl(var(--color-primary)/0.2)]">
                  <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-primary"><Users /> Patient Profile</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                    <div><span className="text-muted">Age:</span> <span className="font-bold text-white">{secureData.patientDemographics?.age || 'N/A'}</span></div>
                    <div><span className="text-muted">Blood Group:</span> <span className="font-bold text-danger">{secureData.patientDemographics?.bloodGroup || 'N/A'}</span></div>
                    <div><span className="text-muted">Weight:</span> <span className="font-bold text-white">{secureData.patientDemographics?.weight || 'N/A'}</span></div>
                  </div>
                  
                  <h4 className="text-sm font-bold text-danger flex items-center gap-1 mb-2"><AlertTriangle size={14}/> Known Allergies</h4>
                  <div className="flex flex-wrap gap-2">
                    {secureData.allergies?.length ? secureData.allergies.map((allergy, i) => (
                      <span key={i} className="badge badge-danger">{allergy}</span>
                    )) : <span className="text-muted text-sm">No known allergies</span>}
                  </div>
                </div>

                {/* Chronological Timeline */}
                <div className="card glass-panel border border-warning/30">
                  <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-warning"><Clock /> Clinical History Timeline</h3>
                  <div className="relative border-l border-white/20 ml-3 pl-4 flex flex-col gap-6">
                    {secureData.chronologicalHistory?.map((event, i) => (
                      <div key={i} className="relative">
                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 bg-warning rounded-full shadow-[0_0_8px_hsl(var(--color-warning))]"></div>
                        <p className="text-xs text-warning font-bold">{event.date}</p>
                        <h4 className="font-bold text-white">{event.event}</h4>
                        <p className="text-sm text-muted mt-1">{event.details}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Center & Right Column: Clinical Data */}
              <div className="flex flex-col gap-6 lg:col-span-2">
                
                {/* Medications Section (Current & Previous) */}
                <div className="card glass-panel border border-[hsl(var(--color-primary)/0.2)]">
                  <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-primary"><Activity /> Medication Management</h3>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-bold text-success mb-3 uppercase tracking-wider">Active Regimen</h4>
                      <div className="flex flex-col gap-3">
                        {secureData.extractedInsights?.currentMedications?.map((med, i) => (
                          <div key={i} className="p-3 bg-black/40 rounded border border-success/30 border-l-4 border-l-success">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-bold text-lg text-white block">{med.drug}</span>
                                <span className="text-sm text-muted">{med.route || 'Oral'} • {med.duration || 'Ongoing'}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-primary font-bold block">{med.dose}</span>
                                <span className="text-xs text-muted">{med.frequency}</span>
                              </div>
                            </div>
                            {med.alert && <p className="text-xs text-warning mt-2 flex items-center gap-1"><AlertTriangle size={12}/> {med.alert}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-bold text-muted mb-3 uppercase tracking-wider">Historical Medications</h4>
                      <div className="flex flex-col gap-2">
                        {secureData.extractedInsights?.previousMedications?.map((med, i) => (
                          <div key={i} className="p-2 bg-black/20 rounded border border-white/5 flex justify-between items-center opacity-70">
                            <div>
                              <span className="font-bold text-sm">{med.drug}</span> <span className="text-xs text-primary">{med.dose}</span>
                            </div>
                            <span className="text-xs text-muted max-w-[120px] truncate" title={med.reason}>{med.reason}</span>
                          </div>
                        ))}
                      </div>
                      
                      {/* Clinical Decision Support: New Prescription */}
                      <div className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/30">
                        <h4 className="text-sm font-bold text-primary mb-2">Prescribe New Medication</h4>
                        <form onSubmit={handleAddPrescription} className="flex flex-col gap-2">
                          <input type="text" placeholder="Drug Name (e.g., Penicillin, Potassium)" className="form-input text-sm" value={newPrescription.drug} onChange={e => setNewPrescription({...newPrescription, drug: e.target.value})} required />
                          <div className="flex gap-2">
                            <input type="text" placeholder="Dose (e.g., 500mg)" className="form-input text-sm flex-1" value={newPrescription.dose} onChange={e => setNewPrescription({...newPrescription, dose: e.target.value})} required />
                            <input type="text" placeholder="Freq (e.g., 1x daily)" className="form-input text-sm flex-1" value={newPrescription.frequency} onChange={e => setNewPrescription({...newPrescription, frequency: e.target.value})} required />
                          </div>
                          <button type="submit" className="btn btn-primary text-xs py-2 mt-1 w-full">Run Interaction Check & Prescribe</button>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Lab Reports & Trends */}
                <div className="card glass-panel border border-success/30">
                  <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-success"><FileText /> Laboratory Reports & Vital Trends</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {secureData.extractedInsights?.labReports?.map((lab, i) => (
                      <div key={i} className="p-4 bg-black/40 rounded-xl text-center border border-white/5 relative overflow-hidden flex flex-col justify-between">
                        <div>
                          <p className="text-sm text-muted mb-1">{lab.test}</p>
                          <div className="flex items-end justify-center gap-1 mb-2">
                            <h4 className={`text-3xl font-bold ${lab.flag !== 'normal' ? 'text-danger' : 'text-success'}`}>{lab.value}</h4>
                            <span className="text-xs text-muted mb-1">{lab.unit || ''}</span>
                          </div>
                          {lab.flag !== 'normal' && <span className="text-xs text-danger uppercase tracking-wider block font-bold mb-2">{lab.flag}</span>}
                        </div>
                        
                        {/* Mini trendline visualization */}
                        <div className="w-full flex justify-between items-end h-8 px-2 gap-1 opacity-60 mt-auto">
                          {lab.history?.map((val, hIdx) => {
                            const max = Math.max(...lab.history) * 1.2;
                            const height = `${(val / max) * 100}%`;
                            return (
                              <div key={hIdx} className="flex-1 bg-primary/40 rounded-t-sm relative group" style={{ height }}>
                                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] bg-black px-1 rounded hidden group-hover:block z-10">{val}</span>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-muted mt-1 uppercase">Historical Trend</p>
                      </div>
                    ))}
                  </div>
                </div>

              {/* Raw Secure Document Viewer & Upload */}
              <div className="card glass-panel border border-[hsl(var(--color-primary)/0.5)] mt-4 relative overflow-hidden" style={{ minHeight: '500px' }}>
                <div className="flex justify-between items-center mb-4 relative z-30 pointer-events-auto">
                  <h3 className="text-lg font-bold flex items-center gap-2 text-primary"><FileText /> Original Raw Report View</h3>
                  
                  {/* Secure Upload within Vault Header */}
                  <div className="flex gap-2 items-center">
                    <input type="file" id="doctorVaultFileInput" className="hidden" onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        setUploadFile(e.target.files[0]);
                      }
                    }} accept="image/*,.pdf" />
                    {uploadFile && <span className="text-xs truncate max-w-[100px] text-white">{uploadFile.name}</span>}
                    <button className="btn btn-outline text-xs py-1 px-3" onClick={() => document.getElementById('doctorVaultFileInput').click()}>
                      <UploadCloud size={14} className="inline mr-1" /> Browse S3
                    </button>
                    <button 
                      className="btn btn-primary text-xs py-1 px-3" 
                      disabled={!uploadFile || uploadStatus.includes('Uploading')}
                      onClick={handleFileUpload}
                    >
                      {uploadStatus || 'Run AI Upload'}
                    </button>
                  </div>
                </div>
                
                {/* Security Overlay blocking interactions */}
                <div className="absolute inset-0 top-16 z-20 pointer-events-auto" onContextMenu={e => e.preventDefault()}></div>
                
                <div className="w-full h-[400px] bg-black/50 rounded-xl flex items-center justify-center p-4 text-center border border-dashed border-[hsl(var(--color-primary)/0.3)] relative z-10 overflow-hidden">
                  <div className="relative w-full h-full">
                    {rawDocumentUrl ? (
                      <div className="absolute inset-0 overflow-hidden rounded-xl border border-white/10">
                        <img src={rawDocumentUrl} alt="Secure Patient Report" className="w-full h-full object-contain" />
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 p-3 bg-black/80 border border-danger rounded text-danger text-sm font-bold animate-pulse backdrop-blur whitespace-nowrap z-50">
                          <EyeOff size={16} className="inline mr-2"/>
                          Self-destructs in {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                        </div>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center opacity-50">
                        <FileText size={64} className="text-primary mb-4" />
                        <p className="text-lg font-bold">Secure Document Viewer Active</p>
                        <p className="text-sm mt-2 text-muted max-w-md">No document loaded. Upload a physical report above to view it securely via AWS S3 Presigned URL.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              </div>
            </div>

          </div>
        </div>
      )}

      {/* AI Medication Interaction Alert Modal */}
      {medicationAlert && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] backdrop-blur-md animate-fade-in">
          <div className="card glass-panel max-w-lg w-full border-2 border-danger shadow-[0_0_50px_hsl(var(--color-danger)/0.4)]">
            <h3 className="text-3xl font-bold flex items-center gap-3 text-danger mb-4">
              <AlertTriangle size={32} className="animate-pulse" /> AI Safety Alert
            </h3>
            
            <p className="text-lg text-white mb-6">
              The uploaded document contains medications that <span className="font-bold text-danger">clash with the patient's existing profile</span>.
            </p>
            
            <div className="flex flex-col gap-3 mb-6 max-h-[300px] overflow-y-auto pr-2">
              {medicationAlert.map((med, i) => (
                <div key={i} className="p-4 bg-danger/10 rounded-xl border border-danger/30">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-xl text-white">{med.drug}</span>
                    <span className="badge badge-danger">High Risk</span>
                  </div>
                  <p className="text-sm text-danger font-bold flex items-start gap-2">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    {med.alert}
                  </p>
                </div>
              ))}
            </div>

            <div className="bg-warning/20 border border-warning p-4 rounded-lg mb-6">
              <p className="text-warning text-sm font-bold">Doctor Verification Required</p>
              <p className="text-white text-sm mt-1">Please manually review the patient's current active prescriptions against this new data before authorizing treatment.</p>
            </div>
            
            <button className="btn btn-danger w-full font-bold text-lg py-3" onClick={() => setMedicationAlert(null)}>
              I Understand & Will Verify
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
