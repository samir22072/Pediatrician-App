'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardPage from '@/components/pages/DashboardPage';
import PatientDetailsPage from '@/components/pages/PatientDetailsPage';

export default function Home() {
  const router = useRouter();
  const [view, setView] = useState<'DASHBOARD'>('DASHBOARD');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check Authentication
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    const patientId = localStorage.getItem('patientId');

    if (!token) {
      router.push('/login');
    } else if (role === 'patient' && patientId) {
      // Direct access for patients
      sessionStorage.setItem('selectedPatientId', patientId);
      router.push('/patient');
      // Keep loading true while redirecting
    } else {
      // Only show dashboard if we are authorized and NOT a patient redirecting
      if (role !== 'patient') {
        sessionStorage.removeItem('selectedPatientId');
      }
      setIsLoading(false);
    }
  }, [router]);

  const handlePatientSelect = (id: string) => {
    sessionStorage.setItem('selectedPatientId', id);
    router.push('/patient');
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container">
      {view === 'DASHBOARD' && (
        <DashboardPage onPatientSelect={handlePatientSelect} />
      )}


    </div>
  );
}
