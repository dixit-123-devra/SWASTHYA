import React, { useState, useEffect, useRef } from 'react';
import { Camera, CheckCircle, UploadCloud, Users, Activity } from 'lucide-react';
import * as faceapi from '@vladmandic/face-api';

export default function ReceptionistPortal() {
  const [doctors, setDoctors] = useState([]);
  const [labs] = useState([{ id: 'LAB-1', name: 'City Diagnostics' }, { id: 'LAB-2', name: 'Apollo Labs' }]);
  const [scanning, setScanning] = useState(false);
  const [identifiedPatient, setIdentifiedPatient] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedLab, setSelectedLab] = useState('');
  const [mappingSuccess, setMappingSuccess] = useState(false);
  const [labMappingSuccess, setLabMappingSuccess] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = 'https://vladmandic.github.io/face-api/model/';
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
      setModelsLoaded(true);
    };
    loadModels();
    
    // Load registered doctors from local storage
    const storedDocs = JSON.parse(localStorage.getItem('swasthya_doctors') || '[]');
    setDoctors(storedDocs);
  }, []);

  const startScan = async () => {
    if (!modelsLoaded) return alert("AI Models are still loading...");
    setScanning(true);
    setIdentifiedPatient(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      
      // Wait for 2 seconds to allow the camera to focus, then capture
      setTimeout(async () => {
        const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.2 })).withFaceLandmarks().withFaceDescriptor();
        
        stopCamera();
        
        let descriptorArray;

        if (!detection) {
          const useBypass = window.confirm("AI failed to detect a face. Would you like to use the Developer Bypass to simulate a successful recognition scan?");
          if (!useBypass) return;
          // Generate the consistent dummy 128D array used in patient registration bypass
          descriptorArray = new Array(128).fill(0.12345);
        } else {
          descriptorArray = Array.from(detection.descriptor);
        }
        
        try {
          const response = await fetch('http://localhost:5000/api/patients/recognize-face', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ descriptor: descriptorArray })
          });
          if (response.ok) {
            const data = await response.json();
            // CRITICAL FIX: We must pass data.patient.email here so it gets saved to the mapping and the doctor knows where to send the OTP!
            setIdentifiedPatient({ 
              name: data.patient.patientName, 
              uniqueId: data.patient.uniqueId,
              email: data.patient.email 
            });
          } else {
            alert("Patient not found in the secure database.");
          }
        } catch (e) {
          alert("Error connecting to Face Recognition Server.");
        }
      }, 2000);
    } catch (err) {
      alert("Camera required for scanning.");
      setScanning(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  const handleMapDoctor = async () => {
    if (!selectedDoctor) return alert("Select a doctor first!");
    
    // Save locally for persistence if needed, but primarily send to backend
    const mapped = JSON.parse(localStorage.getItem('swasthya_mapped_patients') || '[]');
    const patientData = { ...identifiedPatient, doctorId: selectedDoctor, mappedAt: new Date().toISOString() };
    localStorage.setItem('swasthya_mapped_patients', JSON.stringify([...mapped, patientData]));
    
    try {
      await fetch('http://localhost:5000/api/doctors/map-patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient: identifiedPatient, doctorId: selectedDoctor })
      });
      setMappingSuccess(true);
      setTimeout(() => setMappingSuccess(false), 3000);
    } catch (e) {
      alert("Failed to map via server.");
    }
  };

  const handleMapLab = () => {
    if (!selectedLab) return alert("Select a laboratory first!");
    
    const mapped = JSON.parse(localStorage.getItem('swasthya_lab_patients') || '[]');
    const patientData = { ...identifiedPatient, labId: selectedLab, mappedAt: new Date().toISOString() };
    localStorage.setItem('swasthya_lab_patients', JSON.stringify([...mapped, patientData]));
    
    setLabMappingSuccess(true);
    setTimeout(() => setLabMappingSuccess(false), 3000);
  };

  return (
    <div className="container dashboard-container animate-fade-in flex flex-col gap-6 pt-8">
      <header className="dashboard-header glass-panel">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="text-primary"/> Receptionist & Clinic Portal</h1>
        <p className="text-muted text-sm mt-1">Identify patients via Facial Recognition and map them to Doctors.</p>
      </header>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left: Scanner */}
        <section className="card glass-panel flex flex-col items-center text-center">
          <h2 className="text-xl font-bold mb-4">Patient Biometric Identification</h2>
          
          <div className="scanner-box my-4" style={{ position: 'relative', width: '300px', height: '300px', overflow: 'hidden', borderRadius: 'var(--radius-lg)', border: '2px dashed hsl(var(--color-primary))', backgroundColor: 'hsl(var(--bg-main)/0.5)' }}>
            {scanning && (
              <>
                <video ref={videoRef} autoPlay playsInline muted style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} />
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Camera size={48} className="text-primary animate-pulse drop-shadow-md" />
                </div>
                <div className="scan-line" style={{ zIndex: 20 }}></div>
              </>
            )}
            {!scanning && !identifiedPatient && <Camera size={48} className="text-muted opacity-50 m-auto mt-[120px]" />}
            {!scanning && identifiedPatient && <CheckCircle size={64} className="text-success m-auto mt-[110px]" />}
          </div>

          {!identifiedPatient ? (
            <button className="btn btn-primary w-full max-w-[300px]" onClick={startScan} disabled={scanning || !modelsLoaded}>
              {scanning ? 'Scanning Face...' : !modelsLoaded ? 'Loading AI Models...' : 'Start Face Scan'}
            </button>
          ) : (
            <button className="btn btn-outline w-full max-w-[300px]" onClick={() => setIdentifiedPatient(null)}>
              Reset & Scan New Patient
            </button>
          )}
        </section>

        {/* Right: Actions */}
        <div className="flex flex-col gap-6">
          <section className="card glass-panel" style={{ opacity: identifiedPatient ? 1 : 0.5, pointerEvents: identifiedPatient ? 'auto' : 'none' }}>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Activity className="text-primary"/> Doctor Mapping</h2>
            {identifiedPatient && (
              <div className="bg-[hsl(var(--bg-main))] p-3 rounded mb-4 border border-[hsl(var(--color-primary)/0.2)]">
                <p className="text-sm text-muted">Identified Patient:</p>
                <p className="font-bold text-lg">{identifiedPatient.name}</p>
                <p className="text-xs text-primary">{identifiedPatient.uniqueId}</p>
              </div>
            )}
            
            <p className="text-sm mb-2">Assign to Available Doctor:</p>
            <select className="form-input mb-4" value={selectedDoctor} onChange={(e) => setSelectedDoctor(e.target.value)}>
              <option value="">-- Select Doctor --</option>
              {doctors.map(d => (
                <option key={d.id} value={d.id}>Dr. {d.name} ({d.specialty})</option>
              ))}
            </select>
            
            <button className={`btn w-full ${mappingSuccess ? 'btn-success' : 'btn-primary'}`} onClick={handleMapDoctor}>
              {mappingSuccess ? 'Successfully Assigned!' : 'Map Patient to Doctor'}
            </button>
          </section>

          <section className="card glass-panel" style={{ opacity: identifiedPatient ? 1 : 0.5, pointerEvents: identifiedPatient ? 'auto' : 'none' }}>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><UploadCloud className="text-primary"/> Laboratory Mapping</h2>
            <p className="text-sm text-muted mb-4">Map patient to a laboratory for direct secure S3 report uploads.</p>
            
            <select className="form-input mb-4" value={selectedLab} onChange={(e) => setSelectedLab(e.target.value)}>
              <option value="">-- Select Laboratory --</option>
              {labs.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            
            <button 
              className={`btn w-full ${labMappingSuccess ? 'btn-success' : 'btn-outline'}`} 
              onClick={handleMapLab}
              style={{ backgroundColor: labMappingSuccess ? 'hsl(var(--color-success))' : '', color: labMappingSuccess ? 'white' : '' }}
            >
              {labMappingSuccess ? 'Patient Sent to Lab!' : 'Map Patient to Laboratory'}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
