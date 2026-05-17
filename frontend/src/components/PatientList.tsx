import React, { useState } from 'react';
import { Plus, ChevronRight, Search, Users, Baby, ClipboardList } from 'lucide-react';
import { Patient } from '@/lib/types';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

import NavbarActions from './NavbarActions';

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

    const totalPatients = patients.length;
    const totalVisits = patients.reduce((acc, p) => acc + (p.visits?.filter(v => v.visit_type !== 'Initial').length || 0), 0);

    const validAges = patients
        .map(p => p.visits && p.visits.length > 0 ? p.visits[p.visits.length - 1].age : null)
        .filter(age => age !== null) as number[];
    const avgAge = validAges.length > 0
        ? (validAges.reduce((a, b) => a + b, 0) / validAges.length).toFixed(1)
        : '0';

    return (
        <div className="min-h-[calc(100vh-64px)] bg-background">
            {/* Global Navbar Actions */}
            <NavbarActions>
                <div className="flex items-center gap-2">
                    <Button
                        onClick={onAddNew}
                        className="gap-2 bg-white text-teal-700 hover:bg-teal-50 border-0 shadow-md font-bold px-5"
                    >
                        <Plus size={18} strokeWidth={3} /> Add New Patient
                    </Button>
                </div>
            </NavbarActions>

            <div className="max-w-7xl mx-auto p-6 space-y-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatsCard
                        icon={<Users size={20} className="text-teal-700" />}
                        iconBg="bg-teal-50 border border-teal-100"
                        label="Total Patients"
                        value={totalPatients}
                        accent="border-l-[3px] border-l-teal-600"
                    />
                    <StatsCard
                        icon={<ClipboardList size={20} className="text-emerald-700" />}
                        iconBg="bg-emerald-50 border border-emerald-100"
                        label="Total Visits"
                        value={totalVisits}
                        accent="border-l-[3px] border-l-emerald-600"
                    />
                    <StatsCard
                        icon={<Baby size={20} className="text-amber-700" />}
                        iconBg="bg-amber-50 border border-amber-100"
                        label="Average Age"
                        value={`${avgAge} yrs`}
                        accent="border-l-[3px] border-l-amber-500"
                    />
                </div>

                {/* Search */}
                <div className="relative w-full sm:w-[360px]">
                    <Search
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                        type="text"
                        placeholder="Search patients by name..."
                        className="pl-9 h-11 bg-white border-slate-200 shadow-sm focus-visible:ring-teal-500/30 focus-visible:ring-2 focus-visible:ring-offset-0 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Patient Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filtered.map(patient => (
                        <Card
                            key={patient.id}
                            className="group relative overflow-hidden cursor-pointer bg-white border border-border hover:border-teal-300 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
                            onClick={() => onSelectPatient(patient.id.toString())}
                        >
                            {/* Left accent bar */}
                            <div className="absolute top-0 left-0 w-[3px] h-full bg-slate-100 group-hover:bg-primary transition-colors duration-200 rounded-l-lg" />

                            <CardContent className="p-5 pl-6 flex flex-col gap-4 h-full">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-11 w-11 border-2 border-slate-100 shadow-sm">
                                            <AvatarFallback className={cn(
                                                "text-base font-bold",
                                                patient.gender === 'Male'
                                                    ? "bg-sky-50 text-sky-700"
                                                    : "bg-rose-50 text-rose-600"
                                            )}>
                                                {patient.name.charAt(0)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <h3 className="font-semibold text-sm leading-none text-foreground group-hover:text-primary transition-colors">{patient.name}</h3>
                                            <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                                                <span className={cn(
                                                    "px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide",
                                                    patient.gender === 'Male'
                                                        ? "bg-sky-50 text-sky-700"
                                                        : "bg-rose-50 text-rose-600"
                                                )}>{patient.gender}</span>
                                                <span className="text-muted-foreground/40">•</span>
                                                <span>{patient.dob}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronRight className="text-muted-foreground/30 group-hover:text-primary/60 transition-colors" size={18} />
                                </div>

                                <div className="mt-auto pt-3 border-t border-border/60 flex justify-between items-end text-xs">
                                    <div>
                                        <p className="text-muted-foreground uppercase tracking-wider font-medium text-[10px]">Last Visit</p>
                                        <p className="font-semibold mt-0.5 text-foreground">
                                            {patient.visits && patient.visits.length > 0
                                                ? patient.visits[patient.visits.length - 1].date
                                                : <span className="text-muted-foreground italic font-normal">Never</span>}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-muted-foreground uppercase tracking-wider font-medium text-[10px]">Current Age</p>
                                        <p className="font-semibold mt-0.5 text-foreground">
                                            {patient.visits && patient.visits.length > 0
                                                ? `${patient.visits[patient.visits.length - 1].age} yrs`
                                                : <span className="text-muted-foreground italic font-normal">Newborn</span>}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {filtered.length === 0 && (
                    <div className="text-center py-20 bg-white rounded-xl border border-dashed border-border text-muted-foreground">
                        <Search className="mx-auto h-10 w-10 opacity-20 mb-3" />
                        <p className="text-base font-medium">No patients found</p>
                        <p className="text-sm mt-1 opacity-70">Try a different search term</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function StatsCard({ icon, iconBg, label, value, accent }: {
    icon: React.ReactNode;
    iconBg: string;
    label: string;
    value: string | number;
    accent: string;
}) {
    return (
        <Card className={cn("overflow-hidden bg-white border-border shadow-sm", accent)}>
            <CardContent className="p-5 flex items-center gap-4">
                <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
                    {icon}
                </div>
                <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
                    <p className="text-2xl font-bold text-foreground tracking-tight mt-0.5">{value}</p>
                </div>
            </CardContent>
        </Card>
    );
}
