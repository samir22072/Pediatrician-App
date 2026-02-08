import React, { useState } from 'react';
import { User, Plus, ChevronRight, Activity, Search, Users, Baby, ClipboardList, Stethoscope } from 'lucide-react';
import { Patient } from '@/lib/types';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

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
        <div className="space-y-8 p-6 animate-in fade-in zoom-in-95 duration-500">
            {/* Top Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="relative w-full sm:w-[350px]">
                    <Search
                        size={18}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                        type="text"
                        placeholder="Search patients..."
                        className="pl-10 h-10 bg-background"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button onClick={onAddNew} size="lg" className="w-full sm:w-auto shadow-md">
                    <Plus size={18} className="mr-2" /> New Patient
                </Button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatsCard
                    icon={<Users size={24} className="text-blue-500" />}
                    label="Total Patients"
                    value={totalPatients}
                    className="border-l-4 border-l-blue-500"
                />
                <StatsCard
                    icon={<ClipboardList size={24} className="text-green-500" />}
                    label="Total Visits"
                    value={totalVisits}
                    className="border-l-4 border-l-green-500"
                />
                <StatsCard
                    icon={<Baby size={24} className="text-orange-500" />}
                    label="Avg. Age"
                    value={`${avgAge} yrs`}
                    className="border-l-4 border-l-orange-500"
                />
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filtered.map(patient => (
                    <Card
                        key={patient.id}
                        className="group overflow-hidden cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all duration-300 hover:-translate-y-1"
                        onClick={() => onSelectPatient(patient.id.toString())}
                    >
                        <div className="absolute top-0 left-0 w-1 h-full bg-muted-foreground/20 group-hover:bg-primary transition-colors" />

                        <CardContent className="p-5 pl-7 flex flex-col gap-4 h-full">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                                        <AvatarFallback className={cn(
                                            "text-lg font-bold",
                                            patient.gender === 'Male' ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400"
                                        )}>
                                            {patient.name.charAt(0)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h3 className="font-semibold text-lg leading-none">{patient.name}</h3>
                                        <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                                            <span>{patient.gender}</span>
                                            <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                                            <span>{patient.dob}</span>
                                        </div>
                                    </div>
                                </div>
                                <ChevronRight className="text-muted-foreground/50 group-hover:text-primary transition-colors" size={20} />
                            </div>

                            <div className="mt-auto pt-4 border-t border-border flex justify-between items-end text-sm">
                                <div>
                                    <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium">Last Visit</p>
                                    <p className="font-semibold mt-1">
                                        {patient.visits && patient.visits.length > 0
                                            ? patient.visits[patient.visits.length - 1].date
                                            : 'Never'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium">Current Age</p>
                                    <p className="font-semibold mt-1">
                                        {patient.visits && patient.visits.length > 0
                                            ? `${patient.visits[patient.visits.length - 1].age} yrs`
                                            : <span className="text-muted-foreground italic">Newborn</span>}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {filtered.length === 0 && (
                <div className="text-center py-20 bg-muted/20 rounded-lg border border-dashed text-muted-foreground">
                    <Search className="mx-auto h-12 w-12 opacity-20 mb-4" />
                    <p className="text-lg">No patients found matching criteria.</p>
                </div>
            )}
        </div>
    );
};

function StatsCard({ icon, label, value, className }: { icon: React.ReactNode, label: string, value: string | number, className?: string }) {
    return (
        <Card className={cn("overflow-hidden", className)}>
            <CardContent className="p-6 flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-background border shadow-sm flex items-center justify-center shrink-0">
                    {icon}
                </div>
                <div>
                    <p className="text-sm font-medium text-muted-foreground">{label}</p>
                    <p className="text-2xl font-bold">{value}</p>
                </div>
            </CardContent>
        </Card>
    );
}
