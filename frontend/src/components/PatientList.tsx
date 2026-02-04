import React, { useState } from 'react';
import { User, Plus, ChevronRight, Activity, Search, Users, Baby, ClipboardList, Stethoscope } from 'lucide-react';
import { Patient } from '@/lib/types';

interface PatientListProps {
    patients: Patient[];
    onSelectPatient: (id: string) => void;
    onAddNew: () => void;
}

export default function PatientList({ patients, onSelectPatient, onAddNew }: PatientListProps) {
    const [searchTerm, setSearchTerm] = useState('');

    const filtered = patients.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Stats
    const totalPatients = patients.length;
    const totalVisits = patients.reduce((acc, p) => acc + (p.visits?.length || 0), 0);

    // Calculate Average Age
    const validAges = patients
        .map(p => p.visits && p.visits.length > 0 ? p.visits[p.visits.length - 1].age : null)
        .filter(age => age !== null) as number[];
    const avgAge = validAges.length > 0
        ? (validAges.reduce((a, b) => a + b, 0) / validAges.length).toFixed(1)
        : '0';

    return (
        <div className="animate-fade-in">
            {/* Top Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div style={{ position: 'relative', width: '300px' }}>
                    <Search
                        size={18}
                        style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-secondary))' }}
                    />
                    <input
                        type="text"
                        placeholder="Search patients..."
                        className="input-field"
                        style={{ paddingLeft: '2.5rem' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button onClick={onAddNew} className="btn btn-primary">
                    <Plus size={18} /> New Patient
                </button>
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <StatsCard icon={<Users size={32} />} label="Total Patients" value={totalPatients} color="var(--primary)" />
                <StatsCard icon={<ClipboardList size={32} />} label="Total Visits" value={totalVisits} color="var(--success)" />
                <StatsCard icon={<Baby size={32} />} label="Avg. Age" value={`${avgAge} yrs`} color="var(--warning)" />
            </div>

            {/* Grid */}
            <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                {filtered.map(patient => (
                    <div
                        key={patient.id}
                        className="card"
                        style={{
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem',
                            transition: 'all 0.3s ease',
                            position: 'relative',
                            overflow: 'hidden',
                            padding: '1.5rem'
                        }}
                        onClick={() => onSelectPatient(patient.id.toString())}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'hsl(var(--primary))';
                            e.currentTarget.style.boxShadow = '0 0 20px rgba(14, 165, 233, 0.2)';
                            e.currentTarget.style.transform = 'translateY(-4px)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--glass-border)';
                            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        {/* Glowing accent line based on gender */}
                        <div style={{
                            position: 'absolute', top: 0, left: 0, width: '4px', height: '100%',
                            backgroundColor: patient.gender === 'Male' ? 'hsl(var(--primary))' : 'hsl(330, 81%, 60%)', // Blue for Male, Pink for Female
                            opacity: 0.6
                        }} />

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{
                                    width: '50px', height: '50px', borderRadius: '50%',
                                    backgroundColor: 'rgba(255, 255, 255, 0.03)', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    fontSize: '1.2rem', fontWeight: 'bold', color: 'hsl(var(--text-primary))'
                                }}>
                                    {patient.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{patient.name}</h3>
                                    <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginTop: '0.25rem' }}>
                                        {patient.gender} • {patient.dob}
                                    </div>
                                </div>
                            </div>
                            <ChevronRight color="hsl(var(--text-secondary))" size={20} />
                        </div>

                        <div style={{
                            marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)',
                            display: 'flex', justifyContent: 'space-between', paddingLeft: '0.5rem', fontSize: '0.85rem'
                        }}>
                            <div>
                                <span style={{ color: 'hsl(var(--text-secondary))' }}>Last Visit</span>
                                <div style={{ fontWeight: 600, marginTop: '0.25rem' }}>
                                    {patient.visits && patient.visits.length > 0
                                        ? patient.visits[patient.visits.length - 1].date
                                        : 'Never'}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span style={{ color: 'hsl(var(--text-secondary))' }}>Current Age</span>
                                <div style={{ fontWeight: 600, marginTop: '0.25rem' }}>
                                    {patient.visits && patient.visits.length > 0
                                        ? `${patient.visits[patient.visits.length - 1].age} yrs`
                                        : 'Newborn'}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'hsl(var(--text-secondary))' }}>
                    <p>No patients found matching criteria.</p>
                </div>
            )}
        </div>
    );
};

function StatsCard({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: string | number, color: string }) {
    // Helper to inject color into icon clone if needed, but simple wrap works
    const iconWithColor = React.cloneElement(icon as React.ReactElement<any>, { color });

    return (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
                padding: '1rem', borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: `1px solid ${color}33`, // 20% opacity hex
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                {iconWithColor}
            </div>
            <div>
                <div className="label" style={{ marginBottom: 0 }}>{label}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{value}</div>
            </div>
        </div>
    );
}
