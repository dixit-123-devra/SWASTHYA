import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCircle, Stethoscope, ClipboardList, TestTube2 } from 'lucide-react';
import './LandingAuth.css';

const ROLES = [
  { id: 'patient', name: 'Patient Portal', icon: UserCircle, path: '/patient-auth', description: 'Access your health records, timeline, and family circle.' },
  { id: 'doctor', name: 'Doctor Portal', icon: Stethoscope, path: '/doctor', description: 'View analytics, prescribe meds, and check risk alerts.' },
  { id: 'receptionist', name: 'Receptionist Desk', icon: ClipboardList, path: '/receptionist', description: 'Facial auth routing and appointment management.' },
  { id: 'laboratory', name: 'Laboratory Portal', icon: TestTube2, path: '/lab', description: 'Upload OCR documents and process FHIR records.' },
];

export default function LandingAuth() {
  const navigate = useNavigate();

  return (
    <div className="landing-container animate-fade-in">
      <div className="landing-content text-center">
        <div className="brand-logo mb-8">
          <h1 className="text-4xl font-bold text-primary tracking-wider" style={{ textShadow: '0 0 20px hsla(var(--color-primary), 0.5)' }}>SWASTHYA</h1>
          <p className="text-muted mt-2 text-lg">Secure Healthcare Ecosystem</p>
        </div>

        <div className="roles-grid">
          {ROLES.map((role) => (
            <div 
              key={role.id} 
              className="card role-card glass-panel cursor-pointer"
              onClick={() => navigate(role.path)}
            >
              <div className="role-icon mb-4 text-primary">
                <role.icon size={48} />
              </div>
              <h2 className="text-xl mb-2">{role.name}</h2>
              <p className="text-muted text-sm">{role.description}</p>
              
              <button className="btn btn-outline w-full mt-6 text-sm">
                Login with FaceAuth
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
