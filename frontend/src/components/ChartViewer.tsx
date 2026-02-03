'use client';
import React, { useMemo } from 'react';
import {
    ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Visit } from '@/lib/types';
import { BOYS_WEIGHT_AGE_Z, GIRLS_WEIGHT_AGE_Z, BOYS_HEIGHT_AGE_Z, GIRLS_HEIGHT_AGE_Z } from '@/lib/growthStandards';

interface ChartViewerProps {
    visits: Visit[];
    gender: 'Male' | 'Female';
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        // Separate Patient data from Standards
        const patientPoint = payload.find((p: any) => p.name === 'Patient');
        const standards = payload.filter((p: any) => p.name !== 'Patient').sort((a: any, b: any) => b.value - a.value);

        return (
            <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', padding: '1rem', borderRadius: '8px', fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', minWidth: '180px' }}>
                <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                    <p style={{ margin: 0, fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                        {`Age: ${Number(label).toFixed(1)} yrs`}
                    </p>
                </div>

                {/* Patient Data Prominently */}
                {patientPoint ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <span style={{ fontWeight: 'bold', color: 'hsl(var(--text-primary))' }}>Patient</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 'bold', color: patientPoint.color, fontSize: '1.1rem' }}>
                                {Number(patientPoint.value).toFixed(2)}
                            </span>
                        </div>
                    </div>
                ) : (
                    <p style={{ margin: '0 0 0.75rem', color: 'hsl(var(--text-secondary))', fontStyle: 'italic', fontSize: '0.85rem' }}>No patient data</p>
                )}

                {/* Standards Grid */}
                <div style={{ display: 'grid', gap: '0.25rem', fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.25rem', opacity: 0.7 }}>Reference</div>
                    {standards.map((p: any) => (
                        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: p.color }}></span>
                                {p.name}
                            </span>
                            <span>{Number(p.value).toFixed(2)}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

export default function ChartViewer({ visits, gender }: ChartViewerProps) {
    const [metric, setMetric] = React.useState<'weight' | 'height'>('weight');

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

            // Approximate match for existing standard points (e.g. at birth Age 0)
            const matchIndex = combined.findIndex(c => Math.abs(c.age - visitAge) < 0.01);

            if (matchIndex >= 0) {
                combined[matchIndex][valueKey] = val;
            } else {
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

    const chartData = useMemo(() => {
        const isWeight = metric === 'weight';
        const standards = isWeight
            ? (gender === 'Male' ? BOYS_WEIGHT_AGE_Z : GIRLS_WEIGHT_AGE_Z)
            : (gender === 'Male' ? BOYS_HEIGHT_AGE_Z : GIRLS_HEIGHT_AGE_Z);

        const valueKey = isWeight ? 'patientWeight' : 'patientHeight';
        const patientPoints = visits.map(v => ({
            age: v.age,
            [valueKey]: isWeight ? v.weight : v.height
        }));

        return mergeData(standards, patientPoints, valueKey);
    }, [visits, gender, metric]);

    const renderChart = () => {
        const isWeight = metric === 'weight';
        const title = isWeight ? 'Weight-for-Age' : 'Height-for-Age';
        const dataKey = isWeight ? 'patientWeight' : 'patientHeight';
        // User requested distinct Blue for both charts for the Patient Line
        const color = 'var(--primary)';
        const unit = isWeight ? 'Weight (kg)' : 'Height (cm)';

        return (
            <div className="card" style={{ position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* Header with floating accent */}
                <h3 style={{ marginBottom: '1.5rem', color: `hsl(${color})`, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: `hsl(${color})`, boxShadow: `0 0 10px hsl(${color})` }}></span>
                    {title}
                </h3>
                <div style={{ height: '400px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
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

                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />

                            <XAxis
                                dataKey="age"
                                type="number"
                                domain={[0, 'auto']}
                                label={{ value: 'Age (Years)', position: 'insideBottom', offset: -5, fill: 'hsl(var(--text-secondary))', fontSize: 12 }}
                                stroke="hsl(var(--text-secondary))"
                                tick={{ fill: 'hsl(var(--text-secondary))', fontSize: 12 }}
                                tickCount={8}
                            />
                            <YAxis
                                label={{ value: unit, angle: -90, position: 'insideLeft', fill: 'hsl(var(--text-secondary))', fontSize: 12, dx: 10 }}
                                stroke="hsl(var(--text-secondary))"
                                tick={{ fill: 'hsl(var(--text-secondary))', fontSize: 12 }}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1 }} />
                            <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '12px' }} iconType="circle" />

                            {/* Standard Deviation Lines - Subtle & Professional */}
                            <Line type="monotone" dataKey="sd3" stroke="#ef4444" strokeWidth={1} strokeDasharray="2 4" dot={false} name="+3 SD" connectNulls strokeOpacity={0.6} />
                            <Line type="monotone" dataKey="sd2" stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 4" dot={false} name="+2 SD" connectNulls strokeOpacity={0.7} />
                            <Line type="monotone" dataKey="sd0" stroke="#10b981" strokeWidth={2} dot={false} name="Median" connectNulls strokeOpacity={0.8} />
                            <Line type="monotone" dataKey="sd2neg" stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 4" dot={false} name="-2 SD" connectNulls strokeOpacity={0.7} />
                            <Line type="monotone" dataKey="sd3neg" stroke="#ef4444" strokeWidth={1} strokeDasharray="2 4" dot={false} name="-3 SD" connectNulls strokeOpacity={0.6} />

                            {/* Patient Line - Neon & Glowing */}
                            <Line
                                type="monotone"
                                dataKey={dataKey}
                                stroke={`hsl(${color})`}
                                strokeWidth={3}
                                activeDot={{ r: 8, fill: `hsl(${color})`, stroke: 'white', strokeWidth: 2 }}
                                dot={{ fill: 'var(--bg-primary)', stroke: `hsl(${color})`, strokeWidth: 2, r: 5 }}
                                name="Patient"
                                connectNulls
                                style={{ filter: `url(#glow-${dataKey})` }}
                                animationDuration={1500}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
                {/* Glass decoration */}
                <div style={{
                    position: 'absolute', top: 0, right: 0, width: '150px', height: '150px',
                    background: `radial-gradient(circle at top right, hsl(${color}) 0%, transparent 70%)`,
                    opacity: 0.05, pointerEvents: 'none'
                }} />
            </div>
        );
    };

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 'var(--border-radius)', padding: '4px', display: 'inline-flex', border: '1px solid var(--glass-border)' }}>
                    <button
                        onClick={() => setMetric('weight')}
                        style={{
                            padding: '0.5rem 1.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                            backgroundColor: metric === 'weight' ? 'hsl(var(--primary))' : 'transparent',
                            color: metric === 'weight' ? 'white' : 'hsl(var(--text-secondary))',
                            fontWeight: 600, transition: 'all 0.2s', boxShadow: metric === 'weight' ? '0 2px 10px rgba(14, 165, 233, 0.3)' : 'none'
                        }}
                    >
                        Weight
                    </button>
                    <button
                        onClick={() => setMetric('height')}
                        style={{
                            padding: '0.5rem 1.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                            backgroundColor: metric === 'height' ? 'hsl(var(--success))' : 'transparent',
                            color: metric === 'height' ? 'white' : 'hsl(var(--text-secondary))',
                            fontWeight: 600, transition: 'all 0.2s', boxShadow: metric === 'height' ? '0 2px 10px rgba(16, 185, 129, 0.3)' : 'none'
                        }}
                    >
                        Height
                    </button>
                </div>
            </div>
            {renderChart()}
        </div>
    );
}
