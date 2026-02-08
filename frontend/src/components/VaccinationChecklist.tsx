import React from 'react';
import { VACCINATION_SCHEDULE } from '@/lib/vaccinationSchedule';
import { Vaccination } from '@/lib/types';
import { Check, Clock, Calendar } from 'lucide-react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface VaccinationChecklistProps {
    vaccinations: Vaccination[]; // Already given ones from backend
    patientDOB: string;
}

export default function VaccinationChecklist({ vaccinations, patientDOB }: VaccinationChecklistProps) {
    const dob = new Date(patientDOB);

    return (
        <Card className="rounded-lg border shadow-sm">
            <CardHeader className="bg-muted/40 py-4 border-b">
                <CardTitle className="text-lg font-semibold text-primary">Vaccination Protocol</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                            <TableHead className="w-[150px]">Age / Phase</TableHead>
                            <TableHead>Vaccine</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {VACCINATION_SCHEDULE.map((group, groupIdx) => {
                            const dueDate = new Date(dob);
                            dueDate.setDate(dueDate.getDate() + group.age_days);
                            const isPastDue = dueDate < new Date();

                            return group.vaccines.map((vName, vIdx) => {
                                const record = vaccinations?.find(v => v.vaccine_name === vName);
                                let status = 'Pending';
                                if (record) status = record.status;

                                return (
                                    <TableRow
                                        key={vName}
                                        className={vIdx % 2 === 0 ? 'bg-muted/5' : ''}
                                    >
                                        {vIdx === 0 && (
                                            <TableCell rowSpan={group.vaccines.length} className="font-medium border-r bg-muted/10">
                                                {group.label}
                                            </TableCell>
                                        )}
                                        <TableCell>{vName}</TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {dueDate.toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>
                                            {status === 'Given' ? (
                                                <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">
                                                    <Check size={12} className="mr-1" /> Given
                                                </Badge>
                                            ) : isPastDue ? (
                                                <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800">
                                                    <Clock size={12} className="mr-1" /> Overdue
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-muted-foreground border-border">
                                                    <Calendar size={12} className="mr-1" /> Upcoming
                                                </Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            });
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
