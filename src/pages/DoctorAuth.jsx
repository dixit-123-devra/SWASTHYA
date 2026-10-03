import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, LogIn } from 'lucide-react';

export default function DoctorAuth() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(false);
  const [formData, setFormData] = useState({ name: '', specialty: '', email: '' });

  const handleAuth = () => {
    if (!isLogin) {
      // Register
      const existing = JSON.parse(localStorage.getItem('swasthya_doctors') || '[]');
      const newDoctor = { id: `DR-${Date.now()}`, ...formData };
      localStorage.setItem('swasthya_doctors', JSON.stringify([...existing, newDoctor]));
      localStorage.setItem('swasthya_current_doctor', JSON.stringify(newDoctor));
    } else {
      // Login: find existing doctor by email or name
      const existing = JSON.parse(localStorage.getItem('swasthya_doctors') || '[]');
      const foundDoctor = existing.find(d => d.email === formData.email || d.name === formData.name);
      
      if (foundDoctor) {
        localStorage.setItem('swasthya_current_doctor', JSON.stringify(foundDoctor));
      } else {
        alert("Doctor not found. Please register first!");
        return;
      }
    }
    navigate('/doctor');
  };

  return (
    <div className="container dashboard-container flex items-center justify-center animate-fade-in" style={{ minHeight: 'calc(100vh - 4rem)' }}>
      <div className="card glass-panel w-full max-w-md text-center">
        <h2 className="text-2xl text-primary font-bold mb-2">Doctor Portal</h2>
        <p className="text-muted text-sm mb-6">{isLogin ? 'Login to view your patients.' : 'Register to join the Swasthya network.'}</p>
        
        <div className="flex flex-col gap-4">
          <input 
            type="text" 
            placeholder="Dr. Name" 
            className="form-input"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          {!isLogin && (
            <input 
              type="text" 
              placeholder="Specialty (e.g. Cardiology)" 
              className="form-input"
              value={formData.specialty}
              onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
            />
          )}
          <input 
            type="email" 
            placeholder="Email Address" 
            className="form-input"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          
          <button className="btn btn-primary mt-2" onClick={handleAuth} disabled={!formData.name || !formData.email}>
            {isLogin ? <><LogIn className="inline mr-2" size={18}/> Login</> : <><UserPlus className="inline mr-2" size={18}/> Register Doctor</>}
          </button>
          
          <button className="btn-link text-sm mt-2" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Need an account? Register' : 'Already registered? Login'}
          </button>
        </div>
      </div>
    </div>
  );
}
