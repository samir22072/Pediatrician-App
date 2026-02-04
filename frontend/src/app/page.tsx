'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardPage from '@/components/pages/DashboardPage';
import PatientDetailsPage from '@/components/pages/PatientDetailsPage';

export default function Home() {
  const router = useRouter();
  const [view, setView] = useState<'DASHBOARD'>('DASHBOARD');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  useEffect(() => {
    // Clear selection when returning to dashboard to prevent "Forward" button loops
    sessionStorage.removeItem('selectedPatientId');
  }, []);

  const handlePatientSelect = (id: string) => {
    sessionStorage.setItem('selectedPatientId', id);
    router.push('/patient');
  };

  return (
    <div className="container">
      {view === 'DASHBOARD' && (
        <DashboardPage onPatientSelect={handlePatientSelect} />
      )}


    </div>
  );
}
