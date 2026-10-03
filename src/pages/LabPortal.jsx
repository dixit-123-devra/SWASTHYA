import React, { useState, useEffect } from 'react';
import { UploadCloud, Beaker, Users, XCircle } from 'lucide-react';

export default function LabPortal() {
  const [labPatients, setLabPatients] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccessId, setUploadSuccessId] = useState(null);
  const [activeUploadId, setActiveUploadId] = useState(null);

  useEffect(() => {
    // Load patients mapped to any lab
    const mapped = JSON.parse(localStorage.getItem('swasthya_lab_patients') || '[]');
    setLabPatients(mapped);
  }, []);

  const handleRemovePatient = (uniqueId) => {
    if (!window.confirm("Are you sure you want to remove this patient from the lab queue?")) return;
    const mapped = JSON.parse(localStorage.getItem('swasthya_lab_patients') || '[]');
    const filtered = mapped.filter(p => p.uniqueId !== uniqueId);
    localStorage.setItem('swasthya_lab_patients', JSON.stringify(filtered));
    setLabPatients(filtered);
  };

  const handleFileSelect = async (e, uniqueId) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(uniqueId);
    
    const formData = new FormData();
    formData.append('document', file);
    formData.append('uniqueId', uniqueId);
    formData.append('fileName', file.name);

    try {
      const response = await fetch('http://localhost:5000/api/patients/upload-lab', {
        method: 'POST',
        body: formData
      });
      if (response.ok) {
        setUploadSuccessId(uniqueId);
        setTimeout(() => setUploadSuccessId(null), 4000);
      }
    } catch (error) {
      console.error(error);
      alert('Upload failed. Is the server running?');
    } finally {
      setUploading(null);
    }
  };
  return (
    <div className="container dashboard-container flex flex-col gap-6 pt-8 animate-fade-in">
      <header className="dashboard-header glass-panel">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Beaker className="text-primary"/> Laboratory Upload Portal</h1>
        <p className="text-muted text-sm mt-1">Upload diagnostic reports securely to patient Swasthya accounts.</p>
      </header>

      <section className="card glass-panel w-full">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Users className="text-primary"/> Patients Assigned for Tests</h2>
        
        {labPatients.length === 0 ? (
          <p className="text-muted text-center p-8 border border-dashed border-[hsl(var(--color-primary)/0.3)] rounded-lg">
            No patients have been routed to the laboratory yet.
          </p>
        ) : (
          <div className="grid gap-4">
            {labPatients.map((patient, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-[hsl(var(--bg-main))] rounded-lg border border-[hsl(var(--color-primary)/0.2)] relative">
                <button 
                  className="absolute top-2 right-2 text-muted hover:text-danger transition-colors"
                  onClick={() => handleRemovePatient(patient.uniqueId)}
                  title="Remove patient from queue"
                >
                  <XCircle size={20} />
                </button>
                
                <div>
                  <h3 className="font-bold">{patient.name}</h3>
                  <p className="text-xs text-primary">{patient.uniqueId}</p>
                  <p className="text-xs text-muted mt-1">Assigned to: Lab #{patient.labId}</p>
                </div>
                
                <div className="flex flex-col gap-2 w-1/3">
                  <input 
                    type="file" 
                    id={`labFileInput-${patient.uniqueId}`} 
                    className="hidden" 
                    onChange={(e) => handleFileSelect(e, patient.uniqueId)} 
                    accept="image/*,.pdf" 
                  />
                  
                  <button 
                    className={`btn ${uploadSuccessId === patient.uniqueId ? 'btn-success' : 'btn-outline'} w-full`}
                    onClick={() => document.getElementById(`labFileInput-${patient.uniqueId}`).click()}
                    disabled={uploading === patient.uniqueId}
                    style={{ backgroundColor: uploadSuccessId === patient.uniqueId ? 'hsl(var(--color-success))' : '', color: uploadSuccessId === patient.uniqueId ? 'white' : '' }}
                  >
                    <UploadCloud size={18} className="mr-2 inline" />
                    {uploading === patient.uniqueId ? 'Uploading...' : uploadSuccessId === patient.uniqueId ? 'Saved to S3!' : 'Upload Real Report'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
