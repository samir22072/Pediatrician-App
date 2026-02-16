import React, { useState } from 'react';
import { Patient, Visit } from '@/lib/types';
import { ArrowLeft, Plus, Edit, Activity, Syringe, ClipboardList, Sparkles } from 'lucide-react';
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

interface PatientDetailsProps {
    patient: Patient;
    onBack: () => void;
    onAddVisit: () => void;
    onEditVisit: (visit: Visit) => void;
    onTransferToVisit: (summary: any) => void;
}

export default function PatientDetails({ patient, onBack, onAddVisit, onEditVisit, onTransferToVisit }: PatientDetailsProps) {
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
                    <Button onClick={onBack} variant="outline" className="gap-2">
                        <ArrowLeft size={16} /> Back
                    </Button>
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
                    <Tabs defaultValue="ai_triage" className="flex flex-col h-full">
                        <div className="flex-none mb-4">
                            <TabsList className="grid w-full grid-cols-4 max-w-2xl">
                                <TabsTrigger value="ai_triage" className="gap-2">
                                    <Sparkles size={16} /> AI Triage
                                </TabsTrigger>
                                <TabsTrigger value="charts" className="gap-2">
                                    <Activity size={16} /> Charts
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
