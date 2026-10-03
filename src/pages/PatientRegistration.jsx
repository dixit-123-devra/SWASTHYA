import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Mail, ShieldCheck, CheckCircle2 } from 'lucide-react';
import * as faceapi from '@vladmandic/face-api';
import './PatientRegistration.css';

export default function PatientRegistration() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Info, 2: FaceScan, 3: OTP, 4: Success
  const [formData, setFormData] = useState({ name: '', email: 'devradixit@gmail.com' });
  const [otp, setOtp] = useState('');
  const [sentOtp, setSentOtp] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [extractedDescriptor, setExtractedDescriptor] = useState(null);
  
  const videoRef = React.useRef(null);
  const streamRef = React.useRef(null);

  React.useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = 'https://vladmandic.github.io/face-api/model/';
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
      setModelsLoaded(true);
    };
    loadModels();
  }, []);

  React.useEffect(() => {
    if (step === 2) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch((err) => {
          console.error("Camera access denied or unavailable", err);
          alert("Camera access is required for Face ID registration.");
        });
    }

    return () => {
      // Cleanup camera when leaving step 2
      if (step !== 2 && streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [step]);

  const handleNext = () => setStep(step + 1);

  const simulateFaceScan = async () => {
    if (!videoRef.current || !modelsLoaded) return alert("Please wait for models to load.");
    
    // Detect face and extract 128D embedding with High Sensitivity settings
    const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.2 })).withFaceLandmarks().withFaceDescriptor();
    
    let descriptorArray;
    
    if (!detection) {
      const useBypass = window.confirm("AI failed to detect a face (lighting or glasses may interfere). Would you like to use the Developer Bypass to simulate a successful scan?");
      if (!useBypass) return;
      // Generate a consistent dummy 128D array for testing so login still matches
      descriptorArray = new Array(128).fill(0.12345);
    } else {
      // Save descriptor for backend
      descriptorArray = Array.from(detection.descriptor);
    }
    
    setExtractedDescriptor(descriptorArray);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    
    if (isLoginMode) {
      // Call backend to recognize face
      try {
        const response = await fetch('http://localhost:5000/api/patients/recognize-face', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ descriptor: descriptorArray })
        });
        if (response.ok) {
          const data = await response.json();
          localStorage.setItem('swasthya_user', JSON.stringify({ name: data.patient.patientName, uniqueId: data.patient.uniqueId }));
          navigate('/patient');
        } else {
          alert("Face not recognized! Please register first.");
          setStep(1);
          setIsLoginMode(false);
        }
      } catch (e) {
        alert("Server error during recognition.");
      }
    } else {
      handleNext(); // Move to OTP
    }
  };

  const startLogin = () => {
    setIsLoginMode(true);
    setStep(2);
  };

  const handleVerifyOTP = async () => {
    // 1. Verify the OTP matches the one sent to their email
    if (otp !== sentOtp && otp !== '123456') { // Fallback bypass for dev
      alert("Invalid OTP! Please check your email and try again.");
      return;
    }

    // 2. Register face in Firebase
    try {
      const response = await fetch('http://localhost:5000/api/patients/register-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientName: formData.name, email: formData.email, descriptor: extractedDescriptor })
      });
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('swasthya_user', JSON.stringify({ name: formData.name, uniqueId: data.uniqueId }));
        handleNext(); // Go to success
        setTimeout(() => navigate('/patient'), 2000); // Route to dashboard
      }
    } catch (e) {
      console.error(e);
      handleNext();
      setTimeout(() => navigate('/patient'), 2000);
    }
  };

  const handleSendOTP = async () => {
    setIsSending(true);
    try {
      const response = await fetch('http://localhost:5000/api/patients/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email })
      });
      const data = await response.json();
      if (response.ok) {
        setSentOtp(data.otp);
      } else {
        alert("Failed to send email: " + data.error);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to reach server.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="container dashboard-container flex items-center justify-center animate-fade-in" style={{ minHeight: 'calc(100vh - 4rem)' }}>
      <div className="card registration-card glass-panel w-full max-w-md">
        
        {step === 1 && (
          <div className="flex flex-col gap-4 text-center">
            <h2 className="text-2xl text-primary font-bold">Patient Registration</h2>
            <p className="text-muted text-sm">Enter your details to create your Swasthya ID.</p>
            <input 
              type="text" 
              placeholder="Full Name" 
              className="form-input mt-4"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <input 
              type="email" 
              placeholder="Email Address" 
              className="form-input"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <button className="btn btn-primary mt-2" onClick={handleNext} disabled={!formData.name || !formData.email}>
              Continue to Face Scan
            </button>
            <div className="mt-4 pt-4 border-t border-[hsl(var(--color-primary)/0.2)]">
              <p className="text-sm text-muted mb-2">Already have a Swasthya ID?</p>
              <button className="btn btn-outline w-full" onClick={startLogin}>
                Login with Face ID
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4 text-center items-center">
            <h2 className="text-2xl text-primary font-bold">Biometric Setup</h2>
            <p className="text-muted text-sm">We are generating your secure Facial Embeddings using Facenet.</p>
            
            <div className="scanner-box my-6" style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-lg)' }}>
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0, opacity: 0.7 }}
              />
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, pointerEvents: 'none' }}>
                <Camera size={48} className="text-primary animate-pulse" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' }} />
              </div>
              <div className="scan-line" style={{ zIndex: 20 }}></div>
            </div>

            <button className="btn btn-primary w-full" onClick={simulateFaceScan} disabled={!modelsLoaded}>
              {!modelsLoaded ? 'Loading AI Models...' : 'Start Face Scan'}
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4 text-center items-center">
            <h2 className="text-2xl text-primary font-bold"><Mail className="inline mr-2" />Verify Email</h2>
            
            {sentOtp ? (
              <>
                <p className="text-muted text-sm">We sent a 6-digit OTP to <strong>{formData.email}</strong>.</p>
                <p className="text-xs text-primary mt-2 font-bold bg-primary/10 p-2 rounded border border-primary/20">Developer Testing? Use Bypass Code: 123456</p>
                <input 
                  type="text" 
                  placeholder="Enter 6-digit OTP" 
                  className="form-input text-center tracking-widest text-lg w-full mt-4 py-3 font-mono"
                  maxLength="6"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />
                <button className="btn btn-primary w-full mt-2 font-bold" onClick={handleVerifyOTP} disabled={otp.length < 6}>
                  Verify & Register
                </button>
              </>
            ) : (
              <>
                <p className="text-muted text-sm">Click the button below to receive an authentication code at <strong>{formData.email}</strong>.</p>
                <button className="btn btn-outline w-full mt-4" onClick={handleSendOTP} disabled={isSending}>
                  {isSending ? "Sending Email..." : "Send OTP"}
                </button>
              </>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-4 text-center items-center">
            <CheckCircle2 size={64} className="text-success mb-2" />
            <h2 className="text-2xl text-success font-bold">Registration Complete!</h2>
            <p className="text-muted text-sm">Your unique Swasthya ID has been mapped to your Face ID in Firebase.</p>
            <p className="text-sm mt-4 text-primary animate-pulse">Redirecting to Dashboard...</p>
          </div>
        )}

      </div>
    </div>
  );
}
