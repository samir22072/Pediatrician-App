import React from 'react';
import { VACCINATION_SCHEDULE } from '@/lib/vaccinationSchedule';
import { Vaccination } from '@/lib/types';
import { Check, Clock, Calendar } from 'lucide-react';

interface VaccinationChecklistProps {
    vaccinations: Vaccination[]; // Already given ones from backend
    patientDOB: string;
}

export default function VaccinationChecklist({ vaccinations, patientDOB }: VaccinationChecklistProps) {
    const dob = new Date(patientDOB);

    return (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem 1.5rem 1rem', borderBottom: '1px solid var(--glass-border)' }}>
                <h3 style={{ margin: 0, color: 'hsl(var(--primary))' }}>Vaccination Protocol</h3>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid var(--glass-border)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                        <th style={{ padding: '1rem', textAlign: 'left', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Age / Phase</th>
                        <th style={{ padding: '1rem', textAlign: 'left', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Vaccine</th>
                        <th style={{ padding: '1rem', textAlign: 'left', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Due Date</th>
                        <th style={{ padding: '1rem', textAlign: 'left', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {VACCINATION_SCHEDULE.map((group, groupIdx) => {
                        const dueDate = new Date(dob);
                        dueDate.setDate(dueDate.getDate() + group.age_days);
                        const isPastDue = dueDate < new Date();

                        return group.vaccines.map((vName, vIdx) => {
                            // Status Logic
                            const record = vaccinations?.find(v => v.vaccine_name === vName);
                            let status = 'Pending';
                            if (record) status = record.status;

                            return (
                                <tr key={vName} style={{
                                    borderBottom: (vIdx === group.vaccines.length - 1 && groupIdx !== VACCINATION_SCHEDULE.length - 1)
                                        ? '1px solid var(--glass-border)'
                                        : 'none',
                                    backgroundColor: vIdx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent'
                                }}>
                                    {vIdx === 0 && (
                                        <td rowSpan={group.vaccines.length} style={{
                                            padding: '1rem', verticalAlign: 'top',
                                            borderRight: '1px solid var(--glass-border)',
                                            color: 'hsl(var(--text-primary))', fontWeight: 500
                                        }}>
                                            {group.label}
                                        </td>
                                    )}
                                    <td style={{ padding: '0.75rem 1rem', color: 'hsl(var(--text-primary))' }}>{vName}</td>
                                    <td style={{ padding: '0.75rem 1rem', color: 'hsl(var(--text-secondary))' }}>
                                        {dueDate.toLocaleDateString()}
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                        {status === 'Given' ? (
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                                color: 'hsl(var(--success))', fontWeight: 600,
                                                backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '0.2rem 0.6rem', borderRadius: '4px'
                                            }}>
                                                <Check size={14} /> Given
                                            </span>
                                        ) : isPastDue ? (
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                                color: 'hsl(var(--warning))',
                                                backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '0.2rem 0.6rem', borderRadius: '4px'
                                            }}>
                                                <Clock size={14} /> Overdue
                                            </span>
                                        ) : (
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                                color: 'hsl(var(--text-secondary))'
                                            }}>
                                                <Calendar size={14} /> Upcoming
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        });
                    })}
                </tbody>
            </table>
        </div>
    );
}
