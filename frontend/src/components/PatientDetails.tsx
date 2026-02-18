import React, { useState } from 'react';
import { Patient, Visit } from '@/lib/types';
import { ArrowLeft, Plus, Edit, Activity, Syringe, ClipboardList, Sparkles, Scan, Check, X, Loader2, Trash2 } from 'lucide-react';
import AIChat from './AIChat';
import ChartViewer from './ChartViewer';
import VaccinationChecklist from './VaccinationChecklist';
import NavbarActions from './NavbarActions';
import { generateVisitPDF } from '@/lib/pdfGenerator';
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AIService } from '@/lib/api';
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"

interface PatientDetailsProps {
    patient: Patient;
    onBack: () => void;
    onAddVisit: () => void;
    onEditVisit: (visit: Visit) => void;
    onTransferToVisit: (summary: any) => void;
    onVisitDeleted?: () => void;
}

export default function PatientDetails({ patient, onBack, onAddVisit, onEditVisit, onTransferToVisit, onVisitDeleted }: PatientDetailsProps) {
    const visits = patient.visits || [];
    const vaccinations = patient.vaccinations || [];
    const lastVisit = visits.length > 0 ? visits[visits.length - 1] : null;

    const [editingScanId, setEditingScanId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ modality: '', findings: '', impression: '' });
    const [savingScan, setSavingScan] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [activeTab, setActiveTabState] = useState("ai_triage");

    React.useEffect(() => {
        const savedTab = sessionStorage.getItem('patientActiveTab');
        if (savedTab) setActiveTabState(savedTab);
        setUserRole(localStorage.getItem('role'));
    }, []);

    const setActiveTab = (val: string) => {
        setActiveTabState(val);
        sessionStorage.setItem('patientActiveTab', val);
    };

    const handleEditScan = (att: any) => {
        setEditingScanId(att.scan_analysis?.id || null);
        setEditForm({
            modality: att.scan_analysis?.modality || '',
            findings: att.scan_analysis?.findings || '',
            impression: att.scan_analysis?.impression || ''
        });
    };

    const handleSaveScan = async () => {
        if (!editingScanId) return;
        setSavingScan(true);
        try {
            await AIService.updateScanResult({
                id: editingScanId,
                ...editForm
            });
            // Update local state by finding the attachment and updating it
            // For simplicity, we can just trigger a re-fetch or update patient object
            // Here we'll just reload the page or rely on the user to refresh if parent state isn't easily accessible
            // Ideally we'd have a refreshPatient callback. 
            // In PatientDetailsPage, fetchPatientDetails is available. 
            // Let's assume the user will see the changes on next load or we find a way to update.
            // Since we don't have a refresh callback in props yet, let's keep it simple.
            window.location.reload();
        } catch (err) {
            console.error("Failed to save scan", err);
            alert("Failed to save changes");
        } finally {
            setSavingScan(false);
            setEditingScanId(null);
        }
    };

    const calculateAge = (dob: string) => {
        if (!dob) return 'N/A';
        const birthDate = new Date(dob);
        const today = new Date();

        let years = today.getFullYear() - birthDate.getFullYear();
        let months = today.getMonth() - birthDate.getMonth();
        let days = today.getDate() - birthDate.getDate();

        if (days < 0) {
            months--;
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
        <div className="flex flex-col h-[calc(100vh-80px)] animate-in fade-in zoom-in-95 duration-500 p-6 gap-6">
            <NavbarActions>
                <div className="flex items-center gap-2">
                    {userRole !== 'patient' && (
                        <Button onClick={onBack} variant="outline" className="gap-2">
                            <ArrowLeft size={16} /> Back
                        </Button>
                    )}
                    <div className="flex-1" />
                    <Button onClick={onAddVisit} className="gap-2">
                        <Plus size={16} /> Add Visit
                    </Button>
                </div>
            </NavbarActions>

            <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 h-full min-h-0">
                {/* Left Sidebar: Patient Profile */}
                <Card className="h-full flex flex-col gap-6 overflow-hidden">
                    <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                        <Avatar className="h-24 w-24">
                            <AvatarFallback className="text-3xl font-bold bg-primary/10 text-primary">
                                {patient.name.charAt(0)}
                            </AvatarFallback>
                        </Avatar>

                        <div>
                            <h2 className="text-2xl font-bold">{patient.name}</h2>
                            <div className="flex items-center justify-center gap-2 mt-2 text-muted-foreground text-sm">
                                <Badge variant="secondary" className="font-normal">{patient.gender}</Badge>
                                <span>•</span>
                                <span>{patient.dob}</span>
                            </div>
                        </div>

                        <div className="w-full h-px bg-border my-2" />

                        <div className="grid grid-cols-3 gap-4 w-full text-left">
                            <div className="col-span-3 pb-4 border-b">
                                <p className="text-sm font-medium text-muted-foreground mb-1">Current Age</p>
                                <p className="text-2xl font-bold text-foreground">{calculateAge(patient.dob)}</p>
                            </div>

                            {lastVisit ? (
                                <>
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground mb-1">Weight</p>
                                        <p className="text-lg font-semibold text-primary">{lastVisit.weight} kg</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground mb-1">Height</p>
                                        <p className="text-lg font-semibold text-green-600">{lastVisit.height} cm</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground mb-1">Head Circ.</p>
                                        <p className="text-lg font-semibold text-orange-600">
                                            {lastVisit.head_circumference ? `${lastVisit.head_circumference} cm` : '--'}
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <div className="col-span-3 text-center text-muted-foreground italic text-sm py-2">
                                    No vitals recorded
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Right Panel: Tabs & Content */}
                <div className="min-h-0 flex flex-col">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
                        <div className="flex-none mb-4">
                            <TabsList className="grid w-full grid-cols-5 max-w-3xl">
                                <TabsTrigger value="ai_triage" className="gap-2">
                                    <Sparkles size={16} /> AI Triage
                                </TabsTrigger>
                                <TabsTrigger value="charts" className="gap-2">
                                    <Activity size={16} /> Charts
                                </TabsTrigger>
                                <TabsTrigger value="scan_findings" className="gap-2">
                                    <Scan size={16} /> Scans
                                </TabsTrigger>
                                <TabsTrigger value="vaccinations" className="gap-2">
                                    <Syringe size={16} /> Vaccines
                                </TabsTrigger>
                                <TabsTrigger value="history" className="gap-2">
                                    <ClipboardList size={16} /> History
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="flex-1 min-h-0 relative">
                            <TabsContent value="ai_triage" className="h-full m-0 data-[state=active]:flex flex-col">
                                <AIChat
                                    patientName={patient.name}
                                    patientId={String(patient.id)}
                                    patientStats={patientStats}
                                    onTransfer={onTransferToVisit}
                                />
                            </TabsContent>

                            <TabsContent value="charts" className="h-full m-0 overflow-y-auto">
                                <Card className="p-4 h-full">
                                    <ChartViewer visits={visits} gender={patient.gender} />
                                </Card>
                            </TabsContent>

                            <TabsContent value="scan_findings" className="h-full m-0 overflow-y-auto">
                                <ScrollArea className="h-full pr-4">
                                    {visits.flatMap(v => v.attachments).filter(a => a.scan_analysis).length === 0 ? (
                                        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground border-2 border-dashed rounded-lg h-full">
                                            <Scan size={48} className="mb-4 opacity-20" />
                                            <p>No scan analysis results found.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {visits.flatMap(v => v.attachments).filter(a => a.scan_analysis).map(att => (
                                                <Card key={att.id || Math.random()}>
                                                    <CardContent className="p-6">
                                                        <div className="flex items-start justify-between mb-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 dark:bg-purple-900/40 dark:text-purple-300">
                                                                    <Scan size={24} />
                                                                </div>
                                                                <div>
                                                                    <h3 className="font-semibold text-lg">{att.scan_analysis?.modality || "Medical Scan"}</h3>
                                                                    <p className="text-sm text-muted-foreground">Analyzed on {att.scan_analysis?.analyzed_at ? new Date(att.scan_analysis.analyzed_at).toLocaleDateString() : 'Unknown Date'}</p>
                                                                </div>
                                                            </div>
                                                            {editingScanId === att.scan_analysis?.id ? (
                                                                <div className="flex gap-2">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="text-green-500 hover:text-green-600"
                                                                        onClick={handleSaveScan}
                                                                        disabled={savingScan}
                                                                    >
                                                                        {savingScan ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="text-red-500 hover:text-red-600"
                                                                        onClick={() => setEditingScanId(null)}
                                                                        disabled={savingScan}
                                                                    >
                                                                        <X size={16} />
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-2">
                                                                    <Badge variant="outline">{visits.find(v => v.attachments.includes(att))?.date}</Badge>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => handleEditScan(att)}
                                                                        className="h-8 w-8"
                                                                    >
                                                                        <Edit size={14} />
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="space-y-4 mt-2">
                                                            {editingScanId === att.scan_analysis?.id ? (
                                                                <>
                                                                    <div className="space-y-2">
                                                                        <label className="text-xs font-bold uppercase text-muted-foreground">Modality</label>
                                                                        <Input
                                                                            value={editForm.modality}
                                                                            onChange={(e) => setEditForm({ ...editForm, modality: e.target.value })}
                                                                            placeholder="e.g. X-Ray"
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <label className="text-xs font-bold uppercase text-muted-foreground">Findings</label>
                                                                        <Textarea
                                                                            value={editForm.findings}
                                                                            onChange={(e) => setEditForm({ ...editForm, findings: e.target.value })}
                                                                            className="min-h-[100px]"
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <label className="text-xs font-bold uppercase text-muted-foreground">Impression</label>
                                                                        <Input
                                                                            value={editForm.impression}
                                                                            onChange={(e) => setEditForm({ ...editForm, impression: e.target.value })}
                                                                        />
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <div className="bg-muted/30 p-3 rounded-md">
                                                                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Findings</h4>
                                                                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{att.scan_analysis?.findings}</p>
                                                                    </div>
                                                                    <div className="bg-blue-500/10 p-3 rounded-md border border-blue-500/20">
                                                                        <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-2">Impression</h4>
                                                                        <p className="text-sm text-foreground font-medium">{att.scan_analysis?.impression}</p>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>

                                                        <div className="mt-4 pt-4 border-t flex justify-between items-center">
                                                            <span className="text-xs text-muted-foreground italic">File: {att.name}</span>
                                                            <a href={att.file} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                                                                View Original Image <ArrowLeft size={12} className="rotate-180" />
                                                            </a>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    )}
                                </ScrollArea>
                            </TabsContent>

                            <TabsContent value="vaccinations" className="h-full m-0 overflow-y-auto">
                                <VaccinationChecklist vaccinations={vaccinations} patientDOB={patient.dob} />
                            </TabsContent>

                            <TabsContent value="history" className="h-full m-0 overflow-y-auto">
                                <ScrollArea className="h-full pr-4">
                                    {visits.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground border-2 border-dashed rounded-lg">
                                            <ClipboardList size={48} className="mb-4 opacity-20" />
                                            <p>No visits recorded yet.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {[...visits].filter(v => v.visit_type !== 'Initial').reverse().map(visit => (
                                                <Card key={visit.id} className="hover:border-primary/50 transition-colors">
                                                    <CardContent className="p-6 flex justify-between items-start">
                                                        <div>
                                                            <div className="flex items-center gap-3 mb-2">
                                                                <span className="font-bold text-lg">{visit.date}</span>
                                                                <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                                    {visit.visit_type}
                                                                </Badge>
                                                            </div>
                                                            <div className="flex gap-6 text-sm text-muted-foreground mb-3">
                                                                <span className="font-medium text-foreground">Wt: {visit.weight} kg</span>
                                                                <span className="font-medium text-foreground">Ht: {visit.height} cm</span>
                                                                <span>Age: {visit.age} y</span>
                                                            </div>
                                                            {visit.diagnosis && (
                                                                <div className="mb-2">
                                                                    <span className="font-semibold text-primary">Diagnosis:</span> <span className="italic">{visit.diagnosis}</span>
                                                                </div>
                                                            )}
                                                            {visit.notes && (
                                                                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                                                                    {visit.notes}
                                                                </p>
                                                            )}
                                                            {visit.attachments && visit.attachments.length > 0 && (
                                                                <div className="mt-3 flex flex-wrap gap-2">
                                                                    {visit.attachments.map((att, idx) => (
                                                                        <a
                                                                            key={idx}
                                                                            href={att.file}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            download={att.name || true}
                                                                            className="text-xs flex items-center gap-1 bg-secondary/50 px-2 py-1 rounded-md hover:bg-secondary transition-colors text-primary"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            <ClipboardList size={12} />
                                                                            {att.name || 'Attachment'}
                                                                        </a>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    generateVisitPDF(visit, patient);
                                                                }}
                                                                title="Download PDF"
                                                            >
                                                                <ClipboardList size={16} />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" onClick={() => onEditVisit(visit)}>
                                                                <Edit size={16} />
                                                            </Button>
                                                            {userRole === 'doctor' && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                                                                    onClick={async (e) => {
                                                                        e.stopPropagation();
                                                                        if (confirm('Are you sure you want to delete this visit? This action cannot be undone.')) {
                                                                            try {
                                                                                await import('@/lib/api').then(m => m.VisitService.delete(visit.id));
                                                                                window.location.reload();
                                                                            } catch (err) {
                                                                                console.error(err);
                                                                                alert('Failed to delete visit');
                                                                            }
                                                                        }
                                                                    }}
                                                                >
                                                                    <Trash2 size={16} />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    )}
                                </ScrollArea>
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}
