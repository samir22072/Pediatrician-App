'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Patient } from '@/lib/types';
import PatientList from '@/components/PatientList';
import InputForm from '@/components/InputForm';

export default function Home() {
  const router = useRouter();
  const [view, setView] = useState<'LIST' | 'NEW_PATIENT'>('LIST');
  const [patients, setPatients] = useState<Patient[]>([]);

  // Initial Load
  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      const res = await api.get('patients/');
      setPatients(res.data);
    } catch (err) {
      console.error("Fetch Patients Failed", err);
    }
  };

  // Handlers
  const handleNewPatient = async (data: any) => {
    try {
      const res = await api.post('patients/', data);
      // Navigate to the new patient's details page
      router.push(`/patients/${res.data.id}`);
    } catch (err) {
      alert("Failed to create patient");
    }
  };

  // Render
  return (
    <div className="container">
      {view === 'LIST' && (
        <PatientList
          patients={patients}
          onSelectPatient={(id) => router.push(`/patients/${id}`)}
          onAddNew={() => setView('NEW_PATIENT')}
        />
      )}

      {view === 'NEW_PATIENT' && (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <InputForm mode="new-patient" onSubmit={handleNewPatient} onCancel={() => setView('LIST')} />
        </div>
      )}
    </div>
  );
}
