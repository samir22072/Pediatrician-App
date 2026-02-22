'use client';
import React, { useMemo } from 'react';
import {
    ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush
} from 'recharts';
import { Visit } from '@/lib/types';
import { BOYS_WEIGHT_AGE_Z, GIRLS_WEIGHT_AGE_Z, BOYS_HEIGHT_AGE_Z, GIRLS_HEIGHT_AGE_Z, BOYS_HEAD_CIRCUMFERENCE_AGE_Z, GIRLS_HEAD_CIRCUMFERENCE_AGE_Z } from '@/lib/growthStandards';
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface ChartViewerProps {
    visits: Visit[];
    gender: 'Male' | 'Female';
}

const CustomTooltip = ({ active, payload, label, ageUnit }: any) => {
    if (active && payload && payload.length) {
        // Separate Patient data from Standards
        const patientPoint = payload.find((p: any) => p.name === 'Patient');
        const standards = payload.filter((p: any) => p.name !== 'Patient').sort((a: any, b: any) => b.value - a.value);

        let ageLabel = `${Number(label).toFixed(1)} yrs`;
        if (ageUnit === 'mo') ageLabel = `${Number(label).toFixed(1)} mos`;
        if (ageUnit === 'dy') ageLabel = `${Number(label).toFixed(0)} days`;

        return (
            <Card className="p-4 shadow-xl border-border/50 bg-popover/95 backdrop-blur-sm min-w-[200px]">
                <div className="border-b border-border pb-2 mb-2">
                    <p className="font-semibold text-muted-foreground text-sm">
                        {`Age: ${ageLabel}`}
                    </p>
                </div>

                {/* Patient Data Prominently */}
                {patientPoint ? (
                    <div className="flex items-center justify-between mb-3 bg-muted/50 p-2 rounded-md">
                        <span className="font-bold text-foreground">Patient</span>
                        <span className="font-bold text-lg" style={{ color: patientPoint.color }}>
                            {Number(patientPoint.value).toFixed(2)}
                        </span>
                    </div>
                ) : (
                    <p className="mb-3 text-muted-foreground italic text-sm">No patient data</p>
                )}

                {/* Standards Grid */}
                <div className="space-y-1">
                    <p className="text-xs uppercase text-muted-foreground font-medium mb-1 opacity-70">Reference</p>
                    {standards.map((p: any) => (
                        <div key={p.name} className="flex justify-between items-center text-xs text-muted-foreground">
                            <span className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}></span>
                                {p.name}
                            </span>
                            <span className="font-mono">{Number(p.value).toFixed(2)}</span>
                        </div>
                    ))}
                </div>
            </Card>
        );
    }
    return null;
};

export default function ChartViewer({ visits, gender }: ChartViewerProps) {
    const [metric, setMetric] = React.useState<'weight' | 'height' | 'head_circumference'>('weight');
    const [ageUnit, setAgeUnit] = React.useState<'yr' | 'mo' | 'dy'>('yr');
    const [isFullRange, setIsFullRange] = React.useState(false);
    // Auto-scale age unit based on data
    React.useEffect(() => {
        if (!visits || visits.length === 0) return;
        const maxAge = Math.max(...visits.map(v => v.age));

        if (maxAge < 0.0833) { // Less than 1 month
            setAgeUnit('dy');
        } else if (maxAge < 1) { // Less than 1 year
            setAgeUnit('mo');
        } else {
            setAgeUnit('yr');
        }
    }, [visits]);

    // Helper for Interpolation
    const interpolate = (age: number, standards: any[], key: string) => {
        // Find surrounding points
        const lower = standards.filter(p => p.age <= age).pop();
        const upper = standards.filter(p => p.age > age).shift(); // Use shift() to get the first element

        if (!lower) return upper ? upper[key] : null;
        if (!upper) return lower[key];

        // Linear Interpolation
        const ratio = (age - lower.age) / (upper.age - lower.age);
        return lower[key] + (upper[key] - lower[key]) * ratio;
    };

    // Generic Data Merger
    const mergeData = (standards: any[], patientData: any[], valueKey: string) => {
        const combined = [...standards.map(s => ({ ...s }))]; // Deep copy

        patientData.forEach(visit => {
            const visitAge = visit.age;
            const rawVal = visit[valueKey];
            // Enforce number type. Handle '0' if valid, but usually height/weight > 0.
            // If it's missing or null in the visit, don't plot it as 0.
            if (rawVal === null || rawVal === undefined || rawVal === '') return;

            const val = Number(rawVal);
            if (isNaN(val)) return; // Allow 0, just strictly NaN check

            // Only merge with original standards (integers 0-5), NEVER overwrite another patient visit.
            // Standards are always at the beginning of the array.
            const standardsCount = standards.length;
            const matchIndex = combined.slice(0, standardsCount).findIndex(c => Math.abs(c.age - visitAge) < 0.0001);

            if (matchIndex >= 0) {
                // Matched a standard point (e.g. Birth)
                combined[matchIndex][valueKey] = val;
            } else {
                // Unique timestamp or non-standard age -> Append new point
                combined.push({
                    age: visitAge,
                    [valueKey]: val,
                    sd3neg: interpolate(visitAge, standards, 'sd3neg'),
                    sd2neg: interpolate(visitAge, standards, 'sd2neg'),
                    sd0: interpolate(visitAge, standards, 'sd0'),
                    sd2: interpolate(visitAge, standards, 'sd2'),
                    sd3: interpolate(visitAge, standards, 'sd3'),
                });
            }
        });

        // Ensure every point has the value key (null if missing) for Recharts connectNulls to work
        return combined.map(pt => ({
            ...pt,
            [valueKey]: pt[valueKey] !== undefined ? pt[valueKey] : null
        })).sort((a, b) => a.age - b.age);
    };

    const rawChartData = useMemo(() => {
        let standards: any[] = [];
        if (metric === 'weight') standards = (gender === 'Male' ? BOYS_WEIGHT_AGE_Z : GIRLS_WEIGHT_AGE_Z);
        else if (metric === 'height') standards = (gender === 'Male' ? BOYS_HEIGHT_AGE_Z : GIRLS_HEIGHT_AGE_Z);
        else if (metric === 'head_circumference') standards = (gender === 'Male' ? BOYS_HEAD_CIRCUMFERENCE_AGE_Z : GIRLS_HEAD_CIRCUMFERENCE_AGE_Z);

        const valueKey = metric === 'weight' ? 'patientWeight' : (metric === 'height' ? 'patientHeight' : 'patientHC');
        const visitKey = metric === 'weight' ? 'weight' : (metric === 'height' ? 'height' : 'head_circumference');

        const patientPoints = visits
            .filter(v => v.visit_type !== 'Initial')
            .map(v => ({
                age: v.age,
                [valueKey]: (v as any)[visitKey] // Cast to any to access dynamic key
            }));

        // Dynamically Filter Standards to "Zoom"
        const maxPatientAge = patientPoints.length > 0 ? Math.max(...patientPoints.map(p => p.age)) : 0;
        let ageLimit = 5; // Default full 5 years

        if (isFullRange) {
            ageLimit = 5;
        } else if (patientPoints.length > 0) {
            if (maxPatientAge < 0.25) ageLimit = 0.5; // Up to 6 months if baby is < 3mo
            else if (maxPatientAge < 1) ageLimit = 1.2; // Up to 1.2y if baby < 1y
            else if (maxPatientAge < 2) ageLimit = 2.5;
            else ageLimit = Math.min(5, maxPatientAge + 1);
        }

        const filteredStandards = standards.filter(s => s.age <= ageLimit);

        return mergeData(filteredStandards, patientPoints, valueKey);
    }, [visits, gender, metric, isFullRange]);

    // Transform Data based on Age Unit
    const displayData = useMemo(() => {
        return rawChartData.map(d => ({
            ...d,
            age: ageUnit === 'dy' ? d.age * 365.25 : (ageUnit === 'mo' ? d.age * 12 : d.age)
        }));
    }, [rawChartData, ageUnit]);

    const renderChart = () => {
        let title = 'Weight-for-Age';
        let dataKey = 'patientWeight';
        let color = 'hsl(var(--primary))';
        let unit = 'Weight (kg)';

        if (metric === 'height') {
            title = 'Height-for-Age';
            dataKey = 'patientHeight';
            color = 'hsl(142, 71%, 45%)'; // Green-600 approx
            unit = 'Height (cm)';
        } else if (metric === 'head_circumference') {
            title = 'Head Circumference-for-Age';
            dataKey = 'patientHC';
            color = 'hsl(32, 95%, 44%)'; // Orange-600 approx
            unit = 'Head Circ. (cm)';
        }

        let xLabel = 'Age (Years)';
        if (ageUnit === 'mo') xLabel = 'Age (Months)';
        if (ageUnit === 'dy') xLabel = 'Age (Days)';

        return (
            <div className="relative overflow-hidden flex flex-col h-[450px] w-full">
                <div className="flex items-center gap-2 mb-6 text-foreground">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}></span>
                    <h3 className="text-lg font-semibold" style={{ color }}>{title}</h3>
                </div>

                <div className="flex-1 w-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={displayData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                            <defs>
                                {/* Glow Filter for Patient Line */}
                                <filter id={`glow-${dataKey}`} x="-50%" y="-50%" width="200%" height="200%">
                                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                                    <feMerge>
                                        <feMergeNode in="coloredBlur" />
                                        <feMergeNode in="SourceGraphic" />
                                    </feMerge>
                                </filter>
                            </defs>

                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} strokeOpacity={0.5} />

                            <XAxis
                                dataKey="age"
                                type="number"
                                domain={[0, 'auto']}
                                label={{ value: xLabel, position: 'insideBottom', offset: -15, fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                                stroke="hsl(var(--muted-foreground))"
                                stdDeviation={0}
                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                                tickCount={8}
                            />
                            <YAxis
                                label={{ value: unit, angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))', fontSize: 12, dx: 10 }}
                                stroke="hsl(var(--muted-foreground))"
                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                                domain={['auto', 'auto']}
                            />
                            <Tooltip content={<CustomTooltip ageUnit={ageUnit} />} cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeOpacity: 0.5 }} />
                            <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '12px' }} iconType="circle" />

                            {/* Standard Deviation Lines - Only if standards exist */}
                            <Line type="monotone" dataKey="sd3" stroke="#ef4444" strokeWidth={1} strokeDasharray="2 4" dot={false} name="+3 SD" connectNulls strokeOpacity={0.4} />
                            <Line type="monotone" dataKey="sd2" stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 4" dot={false} name="+2 SD" connectNulls strokeOpacity={0.5} />
                            <Line type="monotone" dataKey="sd0" stroke="#10b981" strokeWidth={2} dot={false} name="Median" connectNulls strokeOpacity={0.6} />
                            <Line type="monotone" dataKey="sd2neg" stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 4" dot={false} name="-2 SD" connectNulls strokeOpacity={0.5} />
                            <Line type="monotone" dataKey="sd3neg" stroke="#ef4444" strokeWidth={1} strokeDasharray="2 4" dot={false} name="-3 SD" connectNulls strokeOpacity={0.4} />

                            {/* Patient Line - Neon & Glowing */}
                            <Line
                                type="monotone"
                                dataKey={dataKey}
                                stroke={color}
                                strokeWidth={3}
                                activeDot={{ r: 6, fill: color, stroke: 'white', strokeWidth: 2 }}
                                dot={{ fill: 'hsl(var(--background))', stroke: color, strokeWidth: 2, r: 4 }}
                                name="Patient"
                                connectNulls
                                style={{ filter: `url(#glow-${dataKey})` }}
                                animationDuration={1500}
                            />

                            <Brush
                                dataKey="age"
                                height={30}
                                stroke="hsl(var(--primary))"
                                fill="hsl(var(--background))"
                                startIndex={0}
                                tickFormatter={(val) => {
                                    if (ageUnit === 'dy') return Math.round(val) + 'd';
                                    if (ageUnit === 'mo') return Math.round(val) + 'm';
                                    return Number(val).toFixed(1) + 'y';
                                }}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    };

    return (
        <div className="animate-in fade-in zoom-in-95 duration-500 w-full h-full flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <div className="bg-muted p-1 rounded-lg inline-flex">
                    <button
                        onClick={() => setMetric('weight')}
                        className={cn(
                            "px-4 py-2 rounded-md text-sm font-medium transition-all",
                            metric === 'weight'
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Weight
                    </button>
                    <button
                        onClick={() => setMetric('height')}
                        className={cn(
                            "px-4 py-2 rounded-md text-sm font-medium transition-all",
                            metric === 'height'
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Height
                    </button>
                    <button
                        onClick={() => setMetric('head_circumference')}
                        className={cn(
                            "px-4 py-2 rounded-md text-sm font-medium transition-all",
                            metric === 'head_circumference'
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Head Circ.
                    </button>
                </div>

                {/* Chart Controls */}
                <div className="flex items-center gap-3">
                    <Button
                        variant={isFullRange ? "default" : "outline"}
                        size="sm"
                        onClick={() => setIsFullRange(!isFullRange)}
                        className="h-9 font-medium"
                    >
                        {isFullRange ? "Auto Zoom View" : "Full Range (0-5y)"}
                    </Button>

                    <div className="flex items-center gap-2 ml-2">
                        <span className="text-sm text-muted-foreground font-medium">Age Unit:</span>
                        <Select value={ageUnit} onValueChange={(v: any) => setAgeUnit(v)}>
                            <SelectTrigger className="w-[100px] h-9">
                                <SelectValue placeholder="Unit" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="yr">Years</SelectItem>
                                <SelectItem value="mo">Months</SelectItem>
                                <SelectItem value="dy">Days</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>
            {renderChart()}
        </div>
    );
}
