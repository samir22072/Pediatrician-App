import React, { useState, useEffect } from 'react';
import { PatientService } from '@/lib/api';
import { Patient } from '@/lib/types';
import PatientList from '@/components/PatientList';
import InputForm from '@/components/InputForm';

interface DashboardPageProps {
    onPatientSelect: (id: string) => void;
}

export default function DashboardPage({ onPatientSelect }: DashboardPageProps) {
    const [view, setView] = useState<'LIST' | 'NEW_PATIENT'>('LIST');
    const [patients, setPatients] = useState<Patient[]>([]);

    useEffect(() => {
        fetchPatients();
    }, []);

    const fetchPatients = async () => {
        try {
            const res = await PatientService.list();
            setPatients(res.data);
        } catch (err) {
            console.error("Fetch Patients Failed", err);
        }
    };

    const handleNewPatient = async (data: any) => {
        try {
            const res = await PatientService.create(data);
            await fetchPatients(); // Refresh locally
            onPatientSelect(res.data.id); // Navigate to details
        } catch (err) {
            alert("Failed to create patient");
        }
    };

    return (
        <div className="animate-in fade-in zoom-in-95 duration-500 w-full">
            {view === 'LIST' && (
                <PatientList
                    patients={patients}
                    onSelectPatient={onPatientSelect}
                    onAddNew={() => setView('NEW_PATIENT')}
                />
            )}

            {view === 'NEW_PATIENT' && (
                <div className="max-w-4xl mx-auto py-8">
                    <InputForm mode="new-patient" onSubmit={handleNewPatient} onCancel={() => setView('LIST')} />
                </div>
            )}
        </div>
    );
}
