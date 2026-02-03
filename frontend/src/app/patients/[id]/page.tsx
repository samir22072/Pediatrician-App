'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Patient, Visit } from '@/lib/types';
import PatientDetails from '@/components/PatientDetails';
import InputForm from '@/components/InputForm';

export default function PatientDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { id } = params;

    const [patient, setPatient] = useState<Patient | null>(null);
    const [view, setView] = useState<'DETAILS' | 'ADD_VISIT' | 'EDIT_VISIT'>('DETAILS');
    const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) fetchPatientDetails(id as string);
    }, [id]);

    const fetchPatientDetails = async (patientId: string) => {
        try {
            setLoading(true);
            const res = await api.get(`patients/${patientId}/`);
            setPatient(res.data);
        } catch (err) {
            console.error("Failed to fetch patient", err);
            router.push('/');
        } finally {
            setLoading(false);
        }
    };

    const handleAddVisit = async (data: any) => {
        try {
            await api.post('visits/', { ...data, patient: id });
            await fetchPatientDetails(id as string);
            setView('DETAILS');
        } catch (err) {
            alert("Failed to add visit");
        }
    };

    const handleEditVisit = async (data: any) => {
        if (!editingVisit) return;
        try {
            await api.patch(`visits/${editingVisit.id}/`, data);
            await fetchPatientDetails(id as string);
            setEditingVisit(null);
            setView('DETAILS');
        } catch (err) {
            alert("Failed to update visit");
        }
    };

    if (loading) return <div style={{ padding: '2rem', color: 'hsl(var(--text-secondary))' }}>Loading patient data...</div>;
    if (!patient) return null;

    const Modal = ({ children, onClose }: { children: React.ReactNode, onClose: () => void }) => (
        <div
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div style={{ width: '100%', maxWidth: '600px', margin: '2rem' }}>
                {children}
            </div>
        </div>
    );

    return (
        <div className="container" style={{ position: 'relative' }}>
            <PatientDetails
                patient={patient}
                onBack={() => router.push('/')}
                onAddVisit={() => setView('ADD_VISIT')}
                onEditVisit={(v) => { setEditingVisit(v); setView('EDIT_VISIT'); }}
            />

            {view === 'ADD_VISIT' && (
                <Modal onClose={() => setView('DETAILS')}>
                    <InputForm
                        mode="add-visit"
                        onSubmit={handleAddVisit}
                        onCancel={() => setView('DETAILS')}
                        initialData={patient.visits && patient.visits.length > 0 ? {
                            weight: patient.visits[patient.visits.length - 1].weight,
                            height: patient.visits[patient.visits.length - 1].height
                        } : {}}
                    />
                </Modal>
            )}

            {view === 'EDIT_VISIT' && editingVisit && (
                <Modal onClose={() => { setEditingVisit(null); setView('DETAILS'); }}>
                    <InputForm
                        mode="edit-visit"
                        onSubmit={handleEditVisit}
                        onCancel={() => { setEditingVisit(null); setView('DETAILS'); }}
                        initialData={{
                            ...editingVisit,
                            visitType: (editingVisit as any).visit_type || [],
                            vaccines: (editingVisit as any).given_vaccines_display || []
                        }}
                    />
                </Modal>
            )}
        </div>
    );
}
