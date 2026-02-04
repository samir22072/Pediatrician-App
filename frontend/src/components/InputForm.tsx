import React, { useState, ChangeEvent, FormEvent } from 'react';
import { Attachment } from '@/lib/types';
import { VACCINATION_SCHEDULE } from '@/lib/vaccinationSchedule';

interface InputFormProps {
    onCancel: () => void;
    onSubmit: (data: any) => void;
    mode?: 'new-patient' | 'add-visit' | 'edit-visit';
    initialData?: any;
    patientDOB?: string;
}

export default function InputForm({ onCancel, onSubmit, mode = 'new-patient', initialData, patientDOB }: InputFormProps) {
    const [formData, setFormData] = useState({
        name: initialData?.name || '',
        dob: initialData?.dob || '',
        gender: initialData?.gender || 'Male',
        fatherHeight: initialData?.father_height || '',
        motherHeight: initialData?.mother_height || '',
        visitDate: initialData?.date || new Date().toISOString().split('T')[0],
        age: initialData?.age || '',
        weight: initialData?.weight || '',
        height: initialData?.height || '',
        visitType: initialData?.visitType || ['General'], // Array
        vaccines: initialData?.vaccines || [], // Array
        diagnosis: initialData?.diagnosis || '',
        notes: initialData?.notes || '',
        attachments: [] as Attachment[]
    });

    const calculateDetailedAge = (dobString: string, dateString: string) => {
        if (!dobString || !dateString) return { display: '', float: 0 };
        const dob = new Date(dobString);
        const visitDate = new Date(dateString);

        let years = visitDate.getFullYear() - dob.getFullYear();
        let months = visitDate.getMonth() - dob.getMonth();
        let days = visitDate.getDate() - dob.getDate();

        if (days < 0) {
            months--;
            const prevMonthDate = new Date(visitDate.getFullYear(), visitDate.getMonth(), 0);
            days += prevMonthDate.getDate();
        }
        if (months < 0) {
            years--;
            months += 12;
        }

        const diffTime = Math.abs(visitDate.getTime() - dob.getTime());
        const ageFloat = (diffTime / (1000 * 60 * 60 * 24 * 365.25)).toFixed(2);

        return {
            display: `${years}y ${months}m ${days}d`,
            float: ageFloat
        };
    };

    // Derived state for display
    const ageDetails = ((mode === 'add-visit' || mode === 'edit-visit') && patientDOB)
        ? calculateDetailedAge(patientDOB, formData.visitDate)
        : { display: '', float: formData.age };

    // Update internal float age for submission if date changes
    React.useEffect(() => {
        if ((mode === 'add-visit' || mode === 'edit-visit') && patientDOB) {
            const { float } = calculateDetailedAge(patientDOB, formData.visitDate);
            if (float != formData.age) {
                setFormData(prev => ({ ...prev, age: float }));
            }
        }
    }, [formData.visitDate, patientDOB, mode]);


    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleVisitTypeChange = (type: string) => {
        setFormData(prev => {
            const current = Array.isArray(prev.visitType) ? prev.visitType : [];
            if (current.includes(type)) {
                return { ...prev, visitType: current.filter(t => t !== type) };
            } else {
                return { ...prev, visitType: [...current, type] };
            }
        });
    };

    const handleVaccineChange = (vaccine: string) => {
        if (!vaccine) return;
        setFormData(prev => {
            const current = Array.isArray(prev.vaccines) ? prev.vaccines : [];
            if (current.includes(vaccine)) return prev;
            return { ...prev, vaccines: [...current, vaccine] };
        });
    };

    const removeVaccine = (vaccine: string) => {
        setFormData(prev => ({ ...prev, vaccines: formData.vaccines.filter((v: string) => v !== vaccine) }));
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();

        if (mode === 'new-patient') {
            const birthDate = new Date(formData.dob);
            const today = new Date();
            const ageInYears = (today.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

            onSubmit({
                name: formData.name,
                dob: formData.dob,
                gender: formData.gender,
                father_height: Number(formData.fatherHeight),
                mother_height: Number(formData.motherHeight),
                initial_weight: formData.weight ? Number(formData.weight) : null,
                initial_height: formData.height ? Number(formData.height) : null,
                calculated_age: ageInYears > 0 ? Number(ageInYears.toFixed(2)) : 0
            });
        } else {
            onSubmit({
                date: formData.visitDate,
                age: Number(formData.age),
                weight: Number(formData.weight),
                height: Number(formData.height),
                visit_type: Array.isArray(formData.visitType) ? formData.visitType.join(', ') : formData.visitType,
                vaccines: formData.vaccines,
                diagnosis: formData.diagnosis,
                notes: formData.notes,
                attachments: formData.attachments
            });
        }
    };

    const isVisit = mode === 'add-visit' || mode === 'edit-visit';

    // Compact styles for modal usage
    const labelStyle = { fontSize: '0.8rem', marginBottom: '0.25rem' };
    const inputStyle = { padding: '0.5rem 0.75rem', fontSize: '0.9rem' };

    return (
        <div className="card animate-fade-in" style={{ padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'hsl(var(--primary))', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', fontSize: '1.25rem' }}>
                {mode === 'new-patient' ? 'New Subject Registration' : mode === 'edit-visit' ? 'Update Mission Log' : 'Add New Visit'}
            </h2>

            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(2, 1fr)' }}>
                {mode === 'new-patient' && (
                    <>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label className="label" style={labelStyle}>Full Name</label>
                            <input type="text" name="name" className="input-field" style={inputStyle} value={formData.name} onChange={handleChange} required placeholder="Subject Name" />
                        </div>
                        <div>
                            <label className="label" style={labelStyle}>Date of Birth</label>
                            <input type="date" name="dob" className="input-field" style={inputStyle} value={formData.dob} onChange={handleChange} required />
                        </div>
                        <div>
                            <label className="label" style={labelStyle}>Gender</label>
                            <select name="gender" className="input-field" style={inputStyle} value={formData.gender} onChange={handleChange}>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                            </select>
                        </div>
                        <div>
                            <label className="label" style={labelStyle}>Father's Height (cm)</label>
                            <input type="number" name="fatherHeight" className="input-field" style={inputStyle} value={formData.fatherHeight} onChange={handleChange} step="0.1" />
                        </div>
                        <div>
                            <label className="label" style={labelStyle}>Mother's Height (cm)</label>
                            <input type="number" name="motherHeight" className="input-field" style={inputStyle} value={formData.motherHeight} onChange={handleChange} step="0.1" />
                        </div>

                        <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem', borderTop: '1px solid var(--glass-border)', paddingTop: '0.75rem' }}>
                            <label className="label" style={{ color: 'hsl(var(--primary))', fontSize: '0.85rem' }}>Initial Vitals (Optional)</label>
                        </div>
                        <div>
                            <label className="label" style={labelStyle}>Weight (kg)</label>
                            <input type="number" name="weight" className="input-field" style={inputStyle} value={formData.weight} onChange={handleChange} step="0.01" />
                        </div>
                        <div>
                            <label className="label" style={labelStyle}>Height (cm)</label>
                            <input type="number" name="height" className="input-field" style={inputStyle} value={formData.height} onChange={handleChange} step="0.1" />
                        </div>
                    </>
                )}

                {isVisit && (
                    <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                        {/* Left Column: Vitals & Info */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label className="label" style={labelStyle}>Date</label>
                                    <input type="date" name="visitDate" className="input-field" style={inputStyle} value={formData.visitDate} onChange={handleChange} required />
                                </div>
                                <div>
                                    <label className="label" style={labelStyle}>Age</label>
                                    <div className="input-field" style={{
                                        ...inputStyle,
                                        backgroundColor: 'rgba(255,255,255,0.05)',
                                        color: 'hsl(var(--primary))',
                                        fontWeight: 600,
                                        display: 'flex', alignItems: 'center'
                                    }}>
                                        {ageDetails.display || formData.age + ' yrs'}
                                    </div>
                                    <input type="hidden" name="age" value={formData.age} />
                                </div>
                            </div>

                            <div>
                                <label className="label" style={labelStyle}>Visit Type</label>
                                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                    {['General', 'Sick', 'Vaccination', 'Follow-up'].map(type => (
                                        <label key={type} style={{
                                            display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer',
                                            padding: '0.4rem 0.6rem', borderRadius: 'var(--border-radius)',
                                            border: '1px solid var(--glass-border)',
                                            backgroundColor: formData.visitType.includes(type) ? 'rgba(14, 165, 233, 0.2)' : 'transparent',
                                            borderColor: formData.visitType.includes(type) ? 'hsl(var(--primary))' : 'var(--glass-border)',
                                            fontSize: '0.8rem'
                                        }}>
                                            <input
                                                type="checkbox"
                                                style={{ display: 'none' }}
                                                checked={formData.visitType.includes(type)}
                                                onChange={() => handleVisitTypeChange(type)}
                                            />
                                            {type}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label className="label" style={labelStyle}>Weight (kg)</label>
                                    <input type="number" name="weight" className="input-field" style={inputStyle} value={formData.weight} onChange={handleChange} required step="0.01" />
                                </div>
                                <div>
                                    <label className="label" style={labelStyle}>Height (cm)</label>
                                    <input type="number" name="height" className="input-field" style={inputStyle} value={formData.height} onChange={handleChange} required step="0.1" />
                                </div>
                            </div>

                            {formData.visitType.includes('Vaccination') && (
                                <div style={{ padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 'var(--border-radius)' }}>
                                    <label className="label" style={{ color: 'hsl(var(--success))', fontSize: '0.85rem' }}>Vaccines Administered</label>
                                    <select className="input-field" style={inputStyle} onChange={(e) => { handleVaccineChange(e.target.value); e.target.value = ''; }}>
                                        <option value="">-- Select Vaccine --</option>
                                        {VACCINATION_SCHEDULE.map((group, idx) => (
                                            <optgroup key={idx} label={group.label}>
                                                {group.vaccines.map(v => (
                                                    <option key={v} value={v}>{v}</option>
                                                ))}
                                            </optgroup>
                                        ))}
                                    </select>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
                                        {formData.vaccines.map((v: string) => (
                                            <span key={v} style={{
                                                padding: '0.2rem 0.6rem', borderRadius: '2rem',
                                                backgroundColor: 'hsl(var(--success))', color: 'black', fontWeight: 600,
                                                fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
                                            }}>
                                                {v}
                                                <button type="button" onClick={() => removeVaccine(v)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>&times;</button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right Column: Diagnosis & Notes */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', minHeight: '600px' }}>
                            <div>
                                <label className="label" style={labelStyle}>Diagnosis / Focus</label>
                                <input type="text" name="diagnosis" className="input-field" style={{ ...inputStyle, width: '100%', borderColor: 'hsl(var(--primary))' }} value={formData.diagnosis} onChange={handleChange} placeholder="e.g. Viral Fever" />
                            </div>

                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <label className="label" style={labelStyle}>Clinical Notes</label>
                                <textarea
                                    name="notes"
                                    className="input-field"
                                    style={{ ...inputStyle, flex: 1, width: '100%', resize: 'none', lineHeight: '1.5' }}
                                    value={formData.notes}
                                    onChange={handleChange}
                                    placeholder="Comprehensive clinical notes..."
                                ></textarea>
                            </div>
                        </div>
                    </div>
                )}

                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                    <button type="button" className="btn" style={{ backgroundColor: 'transparent', border: '1px solid var(--glass-border)', color: 'hsl(var(--text-secondary))', flex: 1, padding: '0.5rem' }} onClick={onCancel}>
                        Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '0.5rem' }}>
                        {mode === 'new-patient' ? 'Create Record' : 'Save Data'}
                    </button>
                </div>
            </form>
        </div>
    );
}
