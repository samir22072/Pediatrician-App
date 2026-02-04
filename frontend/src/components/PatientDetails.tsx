import React, { useState } from 'react';
import { Patient, Visit } from '@/lib/types';
import { ArrowLeft, Plus, Edit, Activity, Syringe, ClipboardList } from 'lucide-react';
import AIChat from './AIChat';
import ChartViewer from './ChartViewer';
import VaccinationChecklist from './VaccinationChecklist';
import NavbarActions from './NavbarActions';

interface PatientDetailsProps {
    patient: Patient;
    onBack: () => void;
    onAddVisit: () => void;
    onEditVisit: (visit: Visit) => void;
    onTransferToVisit: (summary: any) => void;
}

type Tab = 'ai_triage' | 'charts' | 'vaccinations' | 'history';

export default function PatientDetails({ patient, onBack, onAddVisit, onEditVisit, onTransferToVisit }: PatientDetailsProps) {
    const [activeTab, setActiveTab] = useState<Tab>('ai_triage');

    const visits = patient.visits || [];
    const vaccinations = patient.vaccinations || [];
    const lastVisit = visits.length > 0 ? visits[visits.length - 1] : null;

    const calculateAge = (dob: string) => {
        if (!dob) return 'N/A';
        const birthDate = new Date(dob);
        const today = new Date();

        let years = today.getFullYear() - birthDate.getFullYear();
        let months = today.getMonth() - birthDate.getMonth();
        let days = today.getDate() - birthDate.getDate();

        if (days < 0) {
            months--;
            // get days in previous month
            const prevMonthDate = new Date(today.getFullYear(), today.getMonth(), 0);
            days += prevMonthDate.getDate();
        }
        if (months < 0) {
            years--;
            months += 12;
        }

        return `${years}y ${months}m ${days}d`;
    };

    const patientStats = {
        age: calculateAge(patient.dob),
        weight: lastVisit?.weight || patient.initial_weight,
        height: lastVisit?.height || patient.initial_height
    };

    return (
        <div className="animate-fade-in flex-col" style={{ height: 'calc(100vh - 80px)' }}>
            <NavbarActions>
                <button onClick={onBack} className="btn gap-2" style={{
                    backgroundColor: 'transparent',
                    color: 'hsl(var(--text-secondary))',
                    marginRight: 'auto',
                    border: '1px solid var(--glass-border)',
                }}>
                    <ArrowLeft size={16} /> Back
                </button>
                <button onClick={onAddVisit} className="btn btn-primary gap-2">
                    <Plus size={16} /> Add Visit
                </button>
            </NavbarActions>

            <div className="patient-layout">

                {/* Left Sidebar: Patient Profile */}
                <div className="flex-col gap-6">

                    {/* Identity Card */}
                    <div className="card text-center relative overflow-hidden">
                        <div className="avatar-lg">
                            <span className="text-xl font-bold" style={{ color: 'hsl(var(--primary))', fontSize: '2rem' }}>
                                {patient.name.charAt(0)}
                            </span>
                        </div>
                        <h2 className="text-lg font-bold" style={{ fontSize: '1.5rem', margin: 0 }}>{patient.name}</h2>
                        <div className="text-sm text-secondary" style={{ marginTop: '0.5rem' }}>
                            {patient.gender} • {patient.dob}
                        </div>

                        {/* Vitals Grid (Merged) */}
                        <div className="grid-2-col text-left" style={{ marginTop: '2rem' }}>
                            <div style={{ gridColumn: '1 / -1', paddingBottom: '1rem', borderBottom: '1px solid var(--glass-border)', marginBottom: '0.5rem' }}>
                                <div className="label">Current Age</div>
                                <div className="font-bold text-lg" style={{ fontSize: '1.5rem', color: 'white' }}>
                                    {calculateAge(patient.dob)}
                                </div>
                            </div>

                            {lastVisit ? (
                                <>
                                    <div>
                                        <div className="label">Weight</div>
                                        <div className="font-semibold text-lg" style={{ color: 'hsl(var(--primary))' }}>
                                            {lastVisit.weight} kg
                                        </div>
                                    </div>
                                    <div>
                                        <div className="label">Height</div>
                                        <div className="font-semibold text-lg" style={{ color: 'hsl(var(--success))' }}>
                                            {lastVisit.height} cm
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="text-secondary text-sm italic" style={{ gridColumn: '1 / -1' }}>
                                    No vitals recorded
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Panel: Tabs & Content */}
                <div className="flex-col" style={{ minHeight: 0 }}>

                    {/* Tab Navigation */}
                    <div className="flex-row gap-4 mb-6" style={{ borderBottom: '1px solid var(--glass-border)' }}>
                        {[
                            { id: 'ai_triage', label: 'AI Triage', icon: <div style={{ fontSize: '1.2em' }}>✨</div> },
                            { id: 'charts', label: 'Growth Charts', icon: <Activity size={18} /> },
                            { id: 'vaccinations', label: 'Vaccinations', icon: <Syringe size={18} /> },
                            { id: 'history', label: 'Visit History', icon: <ClipboardList size={18} /> }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as Tab)}
                                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Scrollable Content Area */}
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {activeTab === 'ai_triage' && (
                            <div className="animate-fade-in h-full">
                                <AIChat
                                    patientName={patient.name}
                                    patientId={String(patient.id)}
                                    patientStats={patientStats}
                                    onTransfer={onTransferToVisit}
                                />
                            </div>
                        )}

                        {activeTab === 'charts' && (
                            <div className="animate-fade-in">
                                <ChartViewer visits={visits} gender={patient.gender} />
                            </div>
                        )}

                        {activeTab === 'vaccinations' && (
                            <div className="animate-fade-in">
                                <VaccinationChecklist vaccinations={vaccinations} patientDOB={patient.dob} />
                            </div>
                        )}

                        {activeTab === 'history' && (
                            <div className="animate-fade-in">
                                {visits.length === 0 ? (
                                    <div className="card text-center text-secondary" style={{ padding: '3rem' }}>
                                        <p>No visits recorded yet.</p>
                                    </div>
                                ) : (
                                    <div className="flex-col gap-4">
                                        {[...visits].reverse().map(visit => (
                                            <div key={visit.id} className="card flex-between">
                                                <div>
                                                    <div className="flex-row items-center gap-4 mb-2">
                                                        <span className="font-semibold text-lg">{visit.date}</span>
                                                        <span style={{
                                                            fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '1rem',
                                                            backgroundColor: 'rgba(14, 165, 233, 0.1)', color: 'hsl(var(--primary))', border: '1px solid rgba(14, 165, 233, 0.2)'
                                                        }}>
                                                            {visit.visit_type}
                                                        </span>
                                                    </div>
                                                    <div className="flex-row gap-6 text-sm text-secondary">
                                                        <span>Wt: {visit.weight} kg</span>
                                                        <span>Ht: {visit.height} cm</span>
                                                        <span>Age: {visit.age} y</span>
                                                    </div>
                                                    {visit.diagnosis && (
                                                        <div style={{ marginTop: '0.5rem', fontStyle: 'italic', color: 'hsl(var(--text-primary))' }}>
                                                            Diagnosis: {visit.diagnosis}
                                                        </div>
                                                    )}
                                                    {visit.notes && (
                                                        <div style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>
                                                            {visit.notes}
                                                        </div>
                                                    )}
                                                </div>
                                                <button onClick={() => onEditVisit(visit)} className="btn-icon" style={{ backgroundColor: 'var(--bg-accent)', color: 'white' }}>
                                                    <Edit size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
