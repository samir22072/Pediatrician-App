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
        <div className="animate-fade-in" style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
            <NavbarActions>
                <button onClick={onBack} className="btn" style={{
                    backgroundColor: 'transparent',
                    color: 'hsl(var(--text-secondary))',
                    marginRight: 'auto',
                    border: '1px solid var(--glass-border)',
                    fontSize: '0.85rem'
                }}>
                    <ArrowLeft size={16} /> Back
                </button>
                <button onClick={onAddVisit} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
                    <Plus size={16} /> Add Visit
                </button>
            </NavbarActions>

            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '2rem', flex: 1, minHeight: 0 }}>

                {/* Left Sidebar: Patient Profile */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Identity Card */}
                    <div className="card" style={{ padding: '2rem 1.5rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                        <div style={{
                            width: '80px', height: '80px', borderRadius: '50%', margin: '0 auto 1rem',
                            backgroundColor: 'rgba(14, 165, 233, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: '2px solid hsl(var(--primary))', boxShadow: '0 0 20px rgba(14, 165, 233, 0.3)'
                        }}>
                            <span style={{ fontSize: '2rem', fontWeight: 'bold', color: 'hsl(var(--primary))' }}>
                                {patient.name.charAt(0)}
                            </span>
                        </div>
                        <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{patient.name}</h2>
                        <div style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))', marginTop: '0.5rem' }}>
                            {patient.gender} • {patient.dob}
                        </div>

                        {/* Vitals Grid (Merged) */}
                        <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', textAlign: 'left' }}>
                            <div style={{ gridColumn: '1 / -1', paddingBottom: '1rem', borderBottom: '1px solid var(--glass-border)', marginBottom: '0.5rem' }}>
                                <div className="label" style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>Current Age</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'white' }}>
                                    {calculateAge(patient.dob)}
                                </div>
                            </div>

                            {lastVisit ? (
                                <>
                                    <div>
                                        <div className="label" style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>Weight</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'hsl(var(--primary))' }}>
                                            {lastVisit.weight} kg
                                        </div>
                                    </div>
                                    <div>
                                        <div className="label" style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>Height</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'hsl(var(--success))' }}>
                                            {lastVisit.height} cm
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div style={{ gridColumn: '1 / -1', fontSize: '0.9rem', fontStyle: 'italic', color: 'hsl(var(--text-secondary))' }}>
                                    No vitals recorded
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Panel: Tabs & Content */}
                <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>

                    {/* Tab Navigation */}
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)' }}>
                        {[
                            { id: 'ai_triage', label: 'AI Triage', icon: <div style={{ fontSize: '1.2em' }}>✨</div> }, // Using emoji as quick icon, otherwise import Sparkles
                            { id: 'charts', label: 'Growth Charts', icon: <Activity size={18} /> },
                            { id: 'vaccinations', label: 'Vaccinations', icon: <Syringe size={18} /> },
                            { id: 'history', label: 'Visit History', icon: <ClipboardList size={18} /> }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as Tab)}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    background: 'transparent',
                                    border: 'none',
                                    borderBottom: activeTab === tab.id ? '2px solid hsl(var(--primary))' : '2px solid transparent',
                                    color: activeTab === tab.id ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    transition: 'all 0.2s',
                                    fontSize: '0.95rem'
                                }}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Scrollable Content Area */}
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {activeTab === 'ai_triage' && (
                            <div className="animate-fade-in" style={{ height: '100%' }}>
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
                                    <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'hsl(var(--text-secondary))' }}>
                                        <p>No visits recorded yet.</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gap: '1rem' }}>
                                        {[...visits].reverse().map(visit => (
                                            <div key={visit.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                                                        <span style={{ fontWeight: 600, fontSize: '1.1rem', color: 'hsl(var(--text-primary))' }}>{visit.date}</span>
                                                        <span style={{
                                                            fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '1rem',
                                                            backgroundColor: 'rgba(14, 165, 233, 0.1)', color: 'hsl(var(--primary))', border: '1px solid rgba(14, 165, 233, 0.2)'
                                                        }}>
                                                            {visit.visit_type}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', color: 'hsl(var(--text-secondary))' }}>
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
                                                <button onClick={() => onEditVisit(visit)} className="btn" style={{
                                                    padding: '0.5rem', backgroundColor: 'var(--bg-accent)', color: 'white'
                                                }}>
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
