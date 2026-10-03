import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import LandingAuth from './pages/LandingAuth';
import PatientRegistration from './pages/PatientRegistration';
import PatientDashboard from './pages/PatientDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import DoctorAuth from './pages/DoctorAuth';
import ReceptionistPortal from './pages/ReceptionistPortal';
import LabPortal from './pages/LabPortal';
import './App.css';

function Navigation() {
  const location = useLocation();
  
  // Don't show nav on the landing page
  if (location.pathname === '/') return null;

  return (
    <nav className="main-nav">
      <div className="nav-container container">
        <div className="logo font-bold text-xl text-primary flex items-center gap-2">
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>SWASTHYA</Link>
        </div>
        <div className="nav-links">
          <Link to="/patient" className={`nav-link ${location.pathname === '/patient' ? 'active' : ''}`}>Patient View</Link>
          <Link to="/doctor-auth" className={`nav-link ${location.pathname === '/doctor' || location.pathname === '/doctor-auth' ? 'active' : ''}`}>Doctor View</Link>
          <Link to="/receptionist" className={`nav-link ${location.pathname === '/receptionist' ? 'active' : ''}`}>Reception/Clinic</Link>
          <Link to="/" className="nav-link text-muted" style={{ fontSize: '0.875rem' }}>Switch Role</Link>
        </div>
      </div>
    </nav>
  );
}

// Simple Placeholder for Lab/Receptionist for now
function PlaceholderView({ title }) {
  return (
    <div className="container" style={{ marginTop: '4rem', textAlign: 'center' }}>
      <h1 className="text-2xl text-primary">{title}</h1>
      <p className="text-muted mt-4">This portal is currently under construction in the mock environment.</p>
    </div>
  );
}

function App() {
  return (
    <Router>
      <div className="app-layout">
        <Navigation />
        <Routes>
          <Route path="/" element={<LandingAuth />} />
          <Route path="/patient-auth" element={<PatientRegistration />} />
          <Route path="/patient" element={<PatientDashboard />} />
          <Route path="/doctor-auth" element={<DoctorAuth />} />
          <Route path="/doctor" element={<DoctorDashboard />} />
          <Route path="/receptionist" element={<ReceptionistPortal />} />
          <Route path="/lab" element={<LabPortal />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
