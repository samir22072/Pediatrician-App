import React, { useState, ChangeEvent, FormEvent, useEffect } from 'react';
import { Attachment } from '@/lib/types';
import { VACCINATION_SCHEDULE } from '@/lib/vaccinationSchedule';

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { X, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from "@/lib/utils"

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
        // Optional Vitals
        temperature: initialData?.temperature || '',
        bloodPressure: initialData?.blood_pressure || '',
        heartRate: initialData?.heart_rate || '',
        headCircumference: initialData?.head_circumference || '',

        visitType: initialData?.visitType || initialData?.visit_type || ['General'], // Array
        vaccines: initialData?.vaccines || initialData?.given_vaccines || [], // Array
        diagnosis: initialData?.diagnosis || '',
        notes: initialData?.notes || '',

        // Treatment
        prescription: initialData?.prescription || '',
        followUpDate: initialData?.follow_up_date || '',

        attachments: initialData?.attachments || [] as Attachment[]
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
        const ageFloat = (diffTime / (1000 * 60 * 60 * 24 * 365.25)).toFixed(5);

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
    useEffect(() => {
        if ((mode === 'add-visit' || mode === 'edit-visit') && patientDOB) {
            const { float } = calculateDetailedAge(patientDOB, formData.visitDate);
            if (float != formData.age) {
                setFormData(prev => ({ ...prev, age: float }));
            }
        }
    }, [formData.visitDate, patientDOB, mode]);




    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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

    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();

        const submitData: any = {
            // ... existing fields
        };

        if (mode === 'new-patient') {
            // ... existing new patient logic
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
                initial_head_circumference: formData.headCircumference ? Number(formData.headCircumference) : null,
                calculated_age: ageInYears > 0 ? Number(ageInYears.toFixed(5)) : 0
            });
        } else {
            onSubmit({
                date: formData.visitDate,
                age: Number(formData.age),
                weight: Number(formData.weight),
                height: Number(formData.height),
                temperature: formData.temperature ? Number(formData.temperature) : null,
                blood_pressure: formData.bloodPressure || null,
                heart_rate: formData.heartRate ? Number(formData.heartRate) : null,
                head_circumference: formData.headCircumference ? Number(formData.headCircumference) : null,
                visit_type: Array.isArray(formData.visitType) ? formData.visitType.join(', ') : formData.visitType,
                vaccines: formData.vaccines,
                diagnosis: formData.diagnosis,
                notes: formData.notes,
                prescription: formData.prescription || null,
                follow_up_date: formData.followUpDate || null,
                attachments: formData.attachments,
                files: selectedFiles // Pass active files
            });
            console.log("InputForm: Submitted data", {
                visitDate: formData.visitDate,
                files: selectedFiles
            });
        }
    };

    const isVisit = mode === 'add-visit' || mode === 'edit-visit';

    return (
        <Card className="w-full h-full max-h-[90vh] overflow-hidden border-0 shadow-none sm:border sm:shadow-lg flex flex-col">
            <CardHeader className="border-b bg-muted/40 pb-4 shrink-0">
                <CardTitle className="text-xl text-primary flex items-center gap-2">
                    {mode === 'new-patient' ? 'New Patient Registration' : mode === 'edit-visit' ? 'Update Visit' : 'Add New Visit'}
                </CardTitle>
            </CardHeader>

            <div className="flex-1 overflow-y-auto p-6">
                <form id="input-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {mode === 'new-patient' && (
                        <>
                            <div className="col-span-1 md:col-span-2 space-y-2">
                                <Label>Full Name</Label>
                                <Input name="name" value={formData.name} onChange={handleChange} required placeholder="Patient Name" className="bg-background" />
                            </div>
                            <div className="space-y-2">
                                <Label>Date of Birth</Label>
                                <div className="relative">
                                    <Input
                                        type="date"
                                        name="dob"
                                        value={formData.dob}
                                        onChange={handleChange}
                                        required
                                        className="bg-background pl-10 hide-date-icon"
                                        onClick={(e) => (e.target as HTMLInputElement).showPicker()}
                                    />
                                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/80 pointer-events-none" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Gender</Label>
                                <Select value={formData.gender} onValueChange={(val) => setFormData(prev => ({ ...prev, gender: val }))} >
                                    <SelectTrigger className="bg-background">
                                        <SelectValue placeholder="Select Gender" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Male">Male</SelectItem>
                                        <SelectItem value="Female">Female</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Father's Height (cm)</Label>
                                <Input type="number" name="fatherHeight" value={formData.fatherHeight} onChange={handleChange} step="0.1" className="bg-background" />
                            </div>
                            <div className="space-y-2">
                                <Label>Mother's Height (cm)</Label>
                                <Input type="number" name="motherHeight" value={formData.motherHeight} onChange={handleChange} step="0.1" className="bg-background" />
                            </div>

                            <div className="col-span-1 md:col-span-2 pt-4 border-t">
                                <Label className="text-primary text-base">Initial Vitals (Optional)</Label>
                            </div>
                            <div className="space-y-2">
                                <Label>Weight (kg)</Label>
                                <Input type="number" name="weight" value={formData.weight} onChange={handleChange} step="0.01" className="bg-background" />
                            </div>
                            <div className="space-y-2">
                                <Label>Height (cm)</Label>
                                <Input type="number" name="height" value={formData.height} onChange={handleChange} step="0.1" className="bg-background" />
                            </div>
                            <div className="space-y-2">
                                <Label>Head Circumference (cm)</Label>
                                <Input type="number" name="headCircumference" value={formData.headCircumference} onChange={handleChange} step="0.1" className="bg-background" />
                            </div>
                        </>
                    )}

                    {isVisit && (
                        <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Left Column: Vitals & Info */}
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Date</Label>
                                        <div className="relative">
                                            <Input
                                                type="date"
                                                name="visitDate"
                                                value={formData.visitDate}
                                                onChange={handleChange}
                                                required
                                                className="bg-background pl-10 hide-date-icon"
                                                onClick={(e) => (e.target as HTMLInputElement).showPicker()}
                                            />
                                            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/80 pointer-events-none" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Age</Label>
                                        <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted/50 px-3 py-2 text-sm font-semibold text-primary">
                                            {ageDetails.display || formData.age + ' yrs'}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Visit Type</Label>
                                    <div className="flex flex-wrap gap-3 p-3 border rounded-md bg-background/50">
                                        {['General', 'Sick', 'Vaccination', 'Follow-up'].map(type => (
                                            <div key={type} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`vt-${type}`}
                                                    checked={formData.visitType.includes(type)}
                                                    onCheckedChange={() => handleVisitTypeChange(type)}
                                                />
                                                <Label htmlFor={`vt-${type}`} className="text-sm font-medium cursor-pointer">{type}</Label>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Weight (kg)</Label>
                                        <Input type="number" name="weight" value={formData.weight} onChange={handleChange} required step="0.01" className="bg-background" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Height (cm)</Label>
                                        <Input type="number" name="height" value={formData.height} onChange={handleChange} required step="0.1" className="bg-background" />
                                    </div>
                                </div>

                                {/* Optional Vitals */}
                                <div className="pt-4 border-t space-y-4">
                                    <Label className="text-muted-foreground font-semibold">Optional Vitals</Label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground">Head Circ. (cm)</Label>
                                            <Input type="number" name="headCircumference" value={formData.headCircumference} onChange={handleChange} step="0.1" placeholder="35.5" className="bg-background h-9" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground">Temp (F)</Label>
                                            <Input type="number" name="temperature" value={formData.temperature} onChange={handleChange} step="0.1" placeholder="98.6" className="bg-background h-9" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground">BP</Label>
                                            <Input type="text" name="bloodPressure" value={formData.bloodPressure} onChange={handleChange} placeholder="120/80" className="bg-background h-9" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground">Pulse</Label>
                                            <Input type="number" name="heartRate" value={formData.heartRate} onChange={handleChange} placeholder="BPM" className="bg-background h-9" />
                                        </div>
                                    </div>
                                </div>

                                {formData.visitType.includes('Vaccination') && (
                                    <div className="p-4 bg-muted/30 rounded-lg space-y-3 border border-border">
                                        <Label className="text-green-500 font-semibold">Vaccines Administered</Label>
                                        <Select onValueChange={handleVaccineChange}>
                                            <SelectTrigger className="bg-background">
                                                <SelectValue placeholder="Select Vaccine" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {VACCINATION_SCHEDULE.map((group, idx) => (
                                                    <SelectGroup key={idx}>
                                                        <SelectLabel className="text-muted-foreground">{group.label}</SelectLabel>
                                                        {group.vaccines.map(v => (
                                                            <SelectItem key={v} value={v}>{v}</SelectItem>
                                                        ))}
                                                    </SelectGroup>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        <div className="flex flex-wrap gap-2 pt-2">
                                            {formData.vaccines.map((v: string) => (
                                                <div key={v} className="bg-green-500/10 text-green-600 dark:text-green-400 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-2 border border-green-500/20">
                                                    {v}
                                                    <button type="button" onClick={() => removeVaccine(v)} className="hover:text-destructive transition-colors">
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right Column: Diagnosis & Notes & Plan */}
                            <div className="flex flex-col gap-6 h-full min-h-[500px]">
                                <div className="space-y-2">
                                    <Label>Diagnosis / Focus</Label>
                                    <Input name="diagnosis" className="border-primary/50 bg-background font-medium" value={formData.diagnosis} onChange={handleChange} placeholder="e.g. Viral Fever" />
                                </div>

                                <div className="flex-1 flex flex-col space-y-2">
                                    <Label>Clinical Notes</Label>
                                    <Textarea
                                        name="notes"
                                        className="flex-1 min-h-[120px] resize-none bg-background leading-relaxed"
                                        value={formData.notes}
                                        onChange={handleChange}
                                        placeholder="Comprehensive clinical notes..."
                                    />
                                </div>

                                <div className="flex-1 flex flex-col space-y-2">
                                    <Label>Prescription / Treatment Plan</Label>
                                    <Textarea
                                        name="prescription"
                                        className="flex-1 min-h-[120px] resize-none border-blue-500/30 bg-background/50 leading-relaxed"
                                        value={formData.prescription}
                                        onChange={handleChange}
                                        placeholder="Rx..."
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Follow-up Date</Label>
                                    <div className="space-y-2">
                                        <div className="relative">
                                            <Input
                                                type="date"
                                                name="followUpDate"
                                                value={formData.followUpDate}
                                                onChange={handleChange}
                                                min={new Date().toISOString().split('T')[0]}
                                                className="cursor-pointer bg-background pl-10 hide-date-icon"
                                                onClick={(e) => {
                                                    try {
                                                        if ('showPicker' in HTMLInputElement.prototype) {
                                                            (e.target as HTMLInputElement).showPicker();
                                                        }
                                                    } catch (err) { }
                                                }}
                                            />
                                            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/80 pointer-events-none" />
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            {[
                                                { label: '3 Days', days: 3 },
                                                { label: '5 Days', days: 5 },
                                                { label: '1 Week', days: 7 },
                                                { label: '2 Weeks', days: 14 },
                                                { label: '1 Month', days: 30 }
                                            ].map(period => (
                                                <Button
                                                    key={period.label}
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-xs border border-border"
                                                    onClick={() => {
                                                        const date = new Date();
                                                        date.setDate(date.getDate() + period.days);
                                                        const dateStr = date.toISOString().split('T')[0];
                                                        setFormData(prev => ({ ...prev, followUpDate: dateStr }));
                                                    }}
                                                >
                                                    +{period.label}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Attachments Section */}
                                <div className="space-y-2 pt-4 border-t">
                                    <Label>Attachments</Label>

                                    {/* Existing Attachments */}
                                    {formData.attachments && formData.attachments.length > 0 && (
                                        <div className="space-y-2 mb-4">
                                            <Label className="text-xs text-muted-foreground font-semibold">Current Attachments</Label>
                                            <div className="grid gap-2">
                                                {formData.attachments.map((att: any, idx: number) => (
                                                    <div key={idx} className="flex justify-between items-center text-sm p-2 bg-secondary/30 rounded-md border border-border/50">
                                                        <a
                                                            href={att.file}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            download={att.name || true}
                                                            className="truncate max-w-[200px] flex items-center gap-2 hover:text-primary transition-colors"
                                                        >
                                                            <span className="text-xs">📎</span>
                                                            {att.name || `Attachment ${idx + 1}`}
                                                        </a>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="file"
                                            multiple
                                            onChange={handleFileChange}
                                            className="hidden"
                                            id="file-upload"
                                        />
                                        <Button type="button" variant="secondary" size="sm" onClick={() => document.getElementById('file-upload')?.click()}>
                                            {formData.attachments.length > 0 ? "Add More Files" : "Upload Attachments"}
                                        </Button>
                                        <span className="text-xs text-muted-foreground">{selectedFiles.length} new file(s) selected</span>
                                    </div>
                                    {selectedFiles.length > 0 && (
                                        <div className="space-y-1 mt-2">
                                            <Label className="text-xs text-muted-foreground font-semibold">New Uploads</Label>
                                            {selectedFiles.map((file, idx) => (
                                                <div key={idx} className="flex justify-between items-center text-sm p-2 bg-muted/50 rounded-md">
                                                    <span className="truncate max-w-[200px]">{file.name}</span>
                                                    <button type="button" onClick={() => removeFile(idx)} className="text-destructive hover:font-bold">
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                            </div>
                        </div>
                    )}
                </form>
            </div>
            <CardFooter className="shrink-0 flex gap-4 border-t bg-muted/40 p-6 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
                    Cancel
                </Button>
                <Button type="submit" form="input-form" className="flex-1">
                    {mode === 'new-patient' ? 'Create Record' : 'Save Data'}
                </Button>
            </CardFooter>
        </Card>
    );
}
