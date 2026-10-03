import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Clock, CalendarHeart, ShieldCheck, HeartPulse, Activity, UploadCloud, Bell, FileText, Camera } from 'lucide-react';
import './PatientDashboard.css';

const MOCK_MEDICATIONS = [
  { id: 1, name: 'Metformin 500mg', time: 'Morning', taken: false, timeSlot: '08:00 AM' },
  { id: 2, name: 'Atorvastatin 20mg', time: 'Morning', taken: true, timeSlot: '08:30 AM' },
  { id: 3, name: 'Lisinopril 10mg', time: 'Afternoon', taken: false, timeSlot: '01:00 PM' },
  { id: 4, name: 'Metformin 500mg', time: 'Evening', taken: false, timeSlot: '08:00 PM' },
];

export default function PatientDashboard() {
  const navigate = useNavigate();
  const [userData, setUserData] = useState({ name: 'Guest Patient', uniqueId: 'SW-PENDING' });
  const [meds, setMeds] = useState(MOCK_MEDICATIONS);
  const [progress, setProgress] = useState(40); // 40% completed course
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [showAuthRequest, setShowAuthRequest] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [cameraStream, setCameraStream] = useState(null);
  const [familyEmail, setFamilyEmail] = useState('');
  const [familyInviteStatus, setFamilyInviteStatus] = useState('');
  const videoRef = React.useRef(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const guestId = searchParams.get('guestAccessId');
    
    if (guestId) {
      setUserData({ name: 'Family Member Viewer', uniqueId: guestId, isGuest: true });
    } else {
      const stored = localStorage.getItem('swasthya_user');
      if (stored) {
        setUserData(JSON.parse(stored));
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('swasthya_user');
    navigate('/');
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      alert("Camera access required for picture upload.");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
  };

  const handleCapture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
    canvas.toBlob((blob) => {
      const file = new File([blob], 'camera_capture.png', { type: 'image/png' });
      setUploadFile(file);
      stopCamera();
    }, 'image/png');
  };

  const handleFileUpload = async () => {
    if (!uploadFile) return alert("Select a file or take a picture first!");
    setUploadStatus('Uploading & Processing via AI OCR...');
    
    const formData = new FormData();
    formData.append('document', uploadFile);
    formData.append('uniqueId', userData.uniqueId);
    formData.append('fileName', uploadFile.name);

    try {
      const res = await fetch('http://localhost:5000/api/patients/upload-lab', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        setUploadStatus('Success! Converted to FHIR & Stored in S3.');
        setUploadFile(null);
        setTimeout(() => setUploadStatus(''), 4000);
      } else {
        setUploadStatus('Upload failed.');
      }
    } catch (err) {
      setUploadStatus('Server error during upload.');
    }
  };


  const toggleMed = (id) => {
    setMeds(meds.map(m => m.id === id ? { ...m, taken: !m.taken } : m));
  };

  const getProgressColor = () => {
    if (progress >= 80) return 'var(--color-success)';
    if (progress >= 50) return 'var(--color-warning)';
    return 'var(--color-danger)';
  };

  const handleUploadPastReport = async () => {
    setUploading(true);
    setUploadSuccess(false);
    try {
      const response = await fetch('http://localhost:5000/api/patients/upload-lab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uniqueId: userData.uniqueId, fileName: 'past_report_uploaded' })
      });
      if (response.ok) {
        setUploadSuccess(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUploading(false);
      setTimeout(() => setUploadSuccess(false), 3000);
    }
  };

  const handleAddFamilyMember = async () => {
    if(!familyEmail) return;
    setFamilyInviteStatus('Sending invite...');
    try {
       const res = await fetch('http://localhost:5000/api/patients/family-access', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           email: familyEmail,
           patientName: userData.name,
           uniqueId: userData.uniqueId
         })
       });
       if(res.ok) {
         setFamilyInviteStatus('Invite sent successfully!');
         setFamilyEmail('');
         setTimeout(() => setFamilyInviteStatus(''), 4000);
       } else {
         setFamilyInviteStatus('Failed to send invite.');
       }
    } catch (e) {
       console.error(e);
       setFamilyInviteStatus('Network error.');
    }
  };

  return (
    <div className="container dashboard-container animate-fade-in">
      
      {/* Header Profile Section */}
      <header className="dashboard-header glass-panel">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl">{userData.isGuest ? "Family View," : "Welcome back,"} <span className="font-bold">{userData.name}</span></h1>
              <p className="text-muted text-sm">Patient ID: #{userData.uniqueId} {userData.isGuest ? '• Read-Only Mode' : '• Active Plan'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Device-Based Authentication Modal / Push Notification */}
      {showAuthRequest && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 100 }}>
          <div className="card glass-panel w-full animate-fade-in" style={{ border: '1px solid hsl(var(--color-primary))', maxWidth: '400px' }}>
            <div className="flex items-center gap-4 mb-4">
              <div className="avatar-sm bg-primary text-white"><ShieldCheck size={20} /></div>
              <div>
                <h3 className="text-xl font-bold">Access Request</h3>
                <p className="text-muted text-sm">Dr. Sharma is requesting access.</p>
              </div>
            </div>
            <p className="mb-6">Dr. Sharma from City Hospital wants 15-minute access to your active FHIR records and lab history.</p>
            <div className="flex gap-4">
              <button className="btn btn-outline w-full" onClick={() => setShowAuthRequest(false)}>Deny</button>
              <button className="btn btn-primary w-full" onClick={() => setShowAuthRequest(false)}>Approve Access</button>
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-grid">
        {/* Left Column: Timeline */}
        <div className="main-content">
          <section className="card timeline-card">
            <div className="card-header">
              <h2 className="text-xl flex items-center gap-2"><Clock className="text-primary" /> Today's Interactive Timeline</h2>
              <p className="text-muted text-sm">Track your daily doses to update analytics in real-time.</p>
            </div>

            <div className="timeline">
              {['Morning', 'Afternoon', 'Evening', 'Night'].map((timeOfDay) => (
                <div key={timeOfDay} className="timeline-segment">
                  <h3 className="segment-title">{timeOfDay}</h3>
                  <div className="med-cards">
                    {meds.filter(m => m.time === timeOfDay).length === 0 ? (
                      <p className="text-muted text-sm italic">No medications scheduled.</p>
                    ) : (
                      meds.filter(m => m.time === timeOfDay).map(med => (
                        <div key={med.id} className={`med-card ${med.taken ? 'taken' : ''}`}>
                          <div className="med-info">
                            <h4 className="font-semibold">{med.name}</h4>
                            <p className="text-muted text-sm">{med.timeSlot}</p>
                          </div>
                          <button 
                            className={`btn-check ${med.taken ? 'active' : ''}`}
                            onClick={() => toggleMed(med.id)}
                          >
                            <CheckCircle size={24} />
                            {med.taken ? 'Taken' : 'Take Dose'}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: Analytics & Family View */}
        <div className="side-content flex flex-col gap-6">
          
          {/* Course Progress */}
          <section className="card progress-card glass-panel">
            <div className="card-header">
              <h2 className="text-xl flex items-center gap-2"><Activity className="text-primary" /> Course Progress</h2>
              <p className="text-muted text-sm mt-2">Day 12 of 30 — {progress}% Completed</p>
            </div>
            <div className="progress-bar-container">
              <div 
                className="progress-bar-fill" 
                style={{ width: `${progress}%`, backgroundColor: getProgressColor() }}
              ></div>
            </div>
            <p className="text-sm mt-4 text-warning">
              You're slightly behind pace. Try not to miss the evening doses!
            </p>
          </section>

          {/* Family Circle */}
          <section className="card family-card">
            <div className="card-header">
              <h2 className="text-xl flex items-center gap-2"><ShieldCheck className="text-success" /> Family Health Circle</h2>
              <p className="text-muted text-sm mt-2">People who have access to your health records.</p>
            </div>
            
            <div className="border-t border-[hsl(var(--color-primary)/0.2)] pt-4 mt-4">
              <p className="text-xs text-muted mb-2">Invite a new family member via email. They will receive a direct secure web link to view this dashboard without needing to install the app.</p>
              <div className="flex gap-2">
                <input 
                  type="email" 
                  placeholder="family@example.com" 
                  className="form-input text-sm flex-1"
                  value={familyEmail}
                  onChange={(e) => setFamilyEmail(e.target.value)}
                />
                <button 
                  className="btn btn-primary text-sm" 
                  onClick={handleAddFamilyMember}
                  disabled={familyInviteStatus.includes('Sending')}
                >
                  Invite
                </button>
              </div>
              {familyInviteStatus && <p className={`text-xs mt-2 ${familyInviteStatus.includes('success') ? 'text-success' : 'text-warning'}`}>{familyInviteStatus}</p>}
            </div>
          </section>

          {/* Upload Past Records Card */}
          <section className="card glass-panel">
            <div className="card-header">
              <h2 className="text-xl flex items-center gap-2"><UploadCloud className="text-primary" /> Upload Records</h2>
              <p className="text-muted text-sm mt-2">Upload or capture a physical report. AI OCR will convert to FHIR and store securely in S3.</p>
            </div>
            
            {cameraStream ? (
              <div className="flex flex-col gap-2 mt-4">
                <video ref={videoRef} autoPlay playsInline className="w-full h-48 bg-black rounded-lg object-cover" />
                <div className="flex gap-2">
                  <button className="btn btn-primary flex-1" onClick={handleCapture}>Capture</button>
                  <button className="btn btn-outline flex-1" onClick={stopCamera}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4 mt-4">
                <input type="file" id="fileInput" className="hidden" onChange={(e) => setUploadFile(e.target.files[0])} accept="image/*,.pdf" />
                
                <div className="flex gap-2">
                  <button className="btn btn-outline flex-1 text-sm" onClick={() => document.getElementById('fileInput').click()}>
                    <FileText size={16} className="inline mr-2" /> Browse File
                  </button>
                  <button className="btn btn-outline flex-1 text-sm" onClick={startCamera}>
                    <Camera size={16} className="inline mr-2" /> Take Picture
                  </button>
                </div>

                {uploadFile && (
                  <div className="p-3 bg-[hsl(var(--bg-main))] rounded border border-[hsl(var(--color-primary)/0.3)] flex justify-between items-center mt-2">
                    <span className="text-sm truncate w-[200px]">{uploadFile.name}</span>
                    <button className="text-danger text-sm" onClick={() => setUploadFile(null)}>Remove</button>
                  </div>
                )}
                
                <button 
                  className="btn btn-primary w-full mt-2 text-sm" 
                  disabled={!uploadFile || uploadStatus.includes('Uploading')}
                  onClick={handleFileUpload}
                  style={{ backgroundColor: uploadStatus.includes('Success') ? 'hsl(var(--color-success))' : '' }}
                >
                  {uploadStatus || 'Securely Upload to S3'}
                </button>
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}
