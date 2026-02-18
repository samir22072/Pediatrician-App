import React, { useState, useEffect } from 'react';
import { PatientService, VisitService, AttachmentService, AIService } from '@/lib/api';
import { Patient, Visit } from '@/lib/types';
import PatientDetails from '@/components/PatientDetails';
import InputForm from '@/components/InputForm';

interface PatientDetailsPageProps {
    patientId: string;
    onBack: () => void;
}

export default function PatientDetailsPage({ patientId, onBack }: PatientDetailsPageProps) {
    const [patient, setPatient] = useState<Patient | null>(null);
    const [view, setView] = useState<'DETAILS' | 'ADD_VISIT' | 'EDIT_VISIT'>('DETAILS');
    const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
    const [aiPrefill, setAiPrefill] = useState<any>(null); // State for AI context
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null); // Store session ID for linking attachments
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (patientId) fetchPatientDetails(patientId);
    }, [patientId]);

    const fetchPatientDetails = async (id: string, background = false) => {
        try {
            if (!background) setLoading(true);
            const res = await PatientService.detail(id);
            setPatient(res.data);
        } catch (err) {
            console.error("Failed to fetch patient", err);
            onBack();
        } finally {
            if (!background) setLoading(false);
        }
    };

    const handleAddVisit = async (data: any) => {
        try {
            const { files, ...visitData } = data;
            // Include sessionId to link attachments
            const res = await VisitService.create({
                ...visitData,
                patient: patientId,
                sessionId: currentSessionId
            });

            if (files && files.length > 0) {
                // Upload attachments in parallel
                await Promise.all(files.map((file: File) =>
                    AttachmentService.create({ visitId: res.data.id, file })
                ));
            }

            await fetchPatientDetails(patientId);
            setView('DETAILS');
            setCurrentSessionId(null); // Reset session ID after use
        } catch (err) {
            console.error(err);
            alert("Failed to add visit");
        }
    };

    const handleEditVisit = async (data: any) => {
        if (!editingVisit) return;
        console.log("PatientDetailsPage: handleEditVisit called", data);
        try {
            const { files, ...visitData } = data;
            await VisitService.update({ ...visitData, id: editingVisit.id });

            if (files && files.length > 0) {
                console.log("Uploading files for edited visit:", files);
                await Promise.all(files.map((file: File) =>
                    AttachmentService.create({ visitId: editingVisit.id, file })
                ));
            }

            await fetchPatientDetails(patientId);
            setEditingVisit(null);
            setView('DETAILS');
        } catch (err) {
            console.error("Failed to update visit", err);
            alert("Failed to update visit");
        }
    };

    if (loading) return <div style={{ padding: '2rem', color: 'hsl(var(--text-secondary))', textAlign: 'center' }}>Loading patient data...</div>;
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
            <div style={{ width: '100%', maxWidth: '900px', margin: '2rem' }}>
                {children}
            </div>
        </div>
    );

    return (
        <div style={{ position: 'relative' }}>
            <PatientDetails
                patient={patient}
                onBack={onBack}
                onAddVisit={() => { setCurrentSessionId(null); setView('ADD_VISIT'); }}
                onEditVisit={(v) => { setEditingVisit(v); setView('EDIT_VISIT'); }}
                onTransferToVisit={(summary) => {
                    const { sessionId, ...rest } = summary;
                    if (sessionId) setCurrentSessionId(sessionId);
                    setAiPrefill(rest);
                    setEditingVisit(null);
                    setView('ADD_VISIT');
                }}
                onVisitDeleted={() => fetchPatientDetails(patientId, true)}
            />

            {view === 'ADD_VISIT' && (
                <Modal onClose={() => { setView('DETAILS'); setAiPrefill(null); }}>
                    <InputForm
                        mode="add-visit"
                        onSubmit={handleAddVisit}
                        onCancel={() => { setView('DETAILS'); setAiPrefill(null); }}
                        initialData={(() => {
                            const lastVisit = patient.visits && patient.visits.length > 0 ? patient.visits[patient.visits.length - 1] : null;
                            const prefill = aiPrefill || {};

                            // Helper to prefer AI value if valid, else fallback
                            const getVal = (key: string, fallback: any) => {
                                const aiVal = prefill[key];
                                // Check for non-null, non-undefined, non-empty string. Allow 0.
                                if (aiVal !== null && aiVal !== undefined && aiVal !== '') return aiVal;
                                return fallback;
                            };

                            return {
                                ...prefill, // Keep other AI fields
                                weight: getVal('weight', lastVisit?.weight || ''),
                                height: getVal('height', lastVisit?.height || ''),
                                head_circumference: getVal('head_circumference', lastVisit?.head_circumference || ''),
                                age: patient.dob ? (() => {
                                    const diff = new Date().getTime() - new Date(patient.dob).getTime();
                                    return (diff / (1000 * 60 * 60 * 24 * 365.25)).toFixed(2);
                                })() : ''
                            };
                        })()}
                        patientDOB={patient.dob}
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
                        patientDOB={patient.dob}
                    />
                </Modal>
            )}
        </div>
    );
}
