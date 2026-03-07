"use client";

import React, { useEffect, useState } from "react";

interface FunnelRates {
    avgDealSize: number;
    qualificationRate: number; // as percentage e.g. 35.2
    attendanceRate: number;
    closeRate: number;
    avgCpl: number;
    avgCpc: number;
    avgCtr: number;
    totalMetaSpend: number;
    totalLeads: number;
    months: number;
}

interface Projection {
    targetRevenue: number;
    requiredNewClients: number;
    requiredAttendedCalls: number;
    requiredQualifiedLeads: number;
    requiredTotalLeads: number;
    requiredMetaSpend: number;
    requiredClicks: number;
    requiredImpressions: number;
}

function formatNumber(value: number): string {
    if (!isFinite(value) || isNaN(value)) return "—";
    return Math.round(value).toLocaleString("es-AR");
}

function formatCurrency(value: number): string {
    if (!isFinite(value) || isNaN(value)) return "—";
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${Math.round(value).toLocaleString("es-AR")}`;
}

export default function FunnelCalculator({ clientId }: { clientId: string }) {
    const [rates, setRates] = useState<FunnelRates | null>(null);
    const [loading, setLoading] = useState(true);
    const [targetRevenue, setTargetRevenue] = useState<number>(0);
    const [projection, setProjection] = useState<Projection | null>(null);

    useEffect(() => {
        setLoading(true);
        fetch(`/api/leads/funnel-calculator?clientId=${clientId}&months=3`)
            .then(r => r.json())
            .then(data => {
                setRates(data);
                if (data.avgDealSize > 0) {
                    setTargetRevenue(data.avgDealSize * 10); // reasonable default
                }
            })
            .finally(() => setLoading(false));
    }, [clientId]);

    // Compute projection whenever target or rates change
    useEffect(() => {
        if (!rates || targetRevenue <= 0) {
            setProjection(null);
            return;
        }

        const qualRate = rates.qualificationRate / 100;
        const attendRate = rates.attendanceRate / 100;
        const clRate = rates.closeRate / 100;

        const requiredNewClients = rates.avgDealSize > 0 ? targetRevenue / rates.avgDealSize : 0;
        const requiredAttendedCalls = clRate > 0 ? requiredNewClients / clRate : 0;
        const requiredQualifiedLeads = attendRate > 0 ? requiredAttendedCalls / attendRate : 0;
        const requiredTotalLeads = qualRate > 0 ? requiredQualifiedLeads / qualRate : 0;
        const requiredMetaSpend = requiredTotalLeads * rates.avgCpl;
        const requiredClicks = rates.avgCpc > 0 ? requiredMetaSpend / rates.avgCpc : 0;
        const ctrDecimal = rates.avgCtr / 100;
        const requiredImpressions = ctrDecimal > 0 ? requiredClicks / ctrDecimal : 0;

        setProjection({
            targetRevenue,
            requiredNewClients,
            requiredAttendedCalls,
            requiredQualifiedLeads,
            requiredTotalLeads,
            requiredMetaSpend,
            requiredClicks,
            requiredImpressions,
        });
    }, [rates, targetRevenue]);

    if (loading) {
        return (
            <div className="p-6 bg-special border border-argent rounded-lg animate-pulse">
                <div className="h-4 bg-argent/30 rounded w-48 mb-4" />
                <div className="h-20 bg-argent/20 rounded" />
            </div>
        );
    }

    if (!rates || rates.totalLeads === 0) {
        return (
            <div className="p-6 bg-special border border-argent rounded-lg">
                <p className="text-text-muted text-small">No hay datos históricos suficientes para calcular proyecciones.</p>
            </div>
        );
    }

    return (
        <div className="p-6 bg-special border border-argent rounded-lg space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                    Calculadora de Funnel
                </h2>
                <span className="text-[10px] text-text-muted">
                    Basado en {rates.totalLeads} leads de los últimos {rates.months} meses
                </span>
            </div>

            {/* Historical rates summary */}
            <div className="grid grid-cols-4 gap-4">
                <RateCard label="Ticket promedio" value={formatCurrency(rates.avgDealSize)} />
                <RateCard label="% Calificación" value={`${rates.qualificationRate}%`} />
                <RateCard label="% Asistencia" value={`${rates.attendanceRate}%`} />
                <RateCard label="% Cierre" value={`${rates.closeRate}%`} />
            </div>

            {/* Target input */}
            <div className="flex items-center gap-4">
                <label className="text-small text-text-muted whitespace-nowrap">
                    Facturación objetivo:
                </label>
                <div className="relative flex-1 max-w-xs">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-small">$</span>
                    <input
                        type="number"
                        value={targetRevenue || ""}
                        onChange={(e) => setTargetRevenue(Number(e.target.value))}
                        className="w-full pl-7 pr-3 py-2 bg-stellar border border-argent rounded text-small text-text-primary font-mono focus:border-classic focus:outline-none"
                        placeholder="Ej: 500000"
                    />
                </div>
            </div>

            {/* Projection funnel */}
            {projection && projection.requiredNewClients > 0 && (
                <div className="space-y-2">
                    <h3 className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                        Proyección necesaria
                    </h3>
                    <div className="space-y-1.5">
                        <ProjectionRow
                            label="Impresiones"
                            value={formatNumber(projection.requiredImpressions)}
                            pct={100}
                            color="bg-argent/40"
                        />
                        <ProjectionRow
                            label="Clicks"
                            value={formatNumber(projection.requiredClicks)}
                            pct={projection.requiredImpressions > 0 ? (projection.requiredClicks / projection.requiredImpressions) * 100 : 0}
                            color="bg-argent/60"
                            rate={`CTR ${rates.avgCtr}%`}
                        />
                        <ProjectionRow
                            label="Leads"
                            value={formatNumber(projection.requiredTotalLeads)}
                            pct={projection.requiredImpressions > 0 ? (projection.requiredTotalLeads / projection.requiredImpressions) * 100 : 0}
                            color="bg-classic/40"
                            rate={`CPL ${formatCurrency(rates.avgCpl)}`}
                        />
                        <ProjectionRow
                            label="Calificados"
                            value={formatNumber(projection.requiredQualifiedLeads)}
                            pct={projection.requiredTotalLeads > 0 ? (projection.requiredQualifiedLeads / projection.requiredTotalLeads) * 100 : 0}
                            color="bg-classic/60"
                            rate={`${rates.qualificationRate}%`}
                        />
                        <ProjectionRow
                            label="Asistieron"
                            value={formatNumber(projection.requiredAttendedCalls)}
                            pct={projection.requiredTotalLeads > 0 ? (projection.requiredAttendedCalls / projection.requiredTotalLeads) * 100 : 0}
                            color="bg-classic/80"
                            rate={`${rates.attendanceRate}%`}
                        />
                        <ProjectionRow
                            label="Nuevos Clientes"
                            value={formatNumber(projection.requiredNewClients)}
                            pct={projection.requiredTotalLeads > 0 ? (projection.requiredNewClients / projection.requiredTotalLeads) * 100 : 0}
                            color="bg-synced"
                            rate={`${rates.closeRate}%`}
                        />
                    </div>

                    {/* Bottom summary */}
                    <div className="flex items-center gap-6 pt-4 border-t border-argent mt-4">
                        <div>
                            <span className="text-[10px] text-text-muted uppercase tracking-widest">Inversión Meta necesaria</span>
                            <p className="text-body font-black text-text-primary font-mono">{formatCurrency(projection.requiredMetaSpend)}</p>
                        </div>
                        <div>
                            <span className="text-[10px] text-text-muted uppercase tracking-widest">Facturación objetivo</span>
                            <p className="text-body font-black text-synced font-mono">{formatCurrency(projection.targetRevenue)}</p>
                        </div>
                        <div>
                            <span className="text-[10px] text-text-muted uppercase tracking-widest">ROAS proyectado</span>
                            <p className="text-body font-black text-text-primary font-mono">
                                {projection.requiredMetaSpend > 0
                                    ? `${(projection.targetRevenue / projection.requiredMetaSpend).toFixed(1)}x`
                                    : "—"}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function RateCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="px-4 py-3 bg-stellar rounded border border-argent/50">
            <p className="text-[9px] text-text-muted uppercase tracking-widest">{label}</p>
            <p className="text-body font-black text-text-primary font-mono mt-1">{value}</p>
        </div>
    );
}

function ProjectionRow({ label, value, pct, color, rate }: {
    label: string;
    value: string;
    pct: number;
    color: string;
    rate?: string;
}) {
    return (
        <div className="flex items-center gap-3">
            <div className="w-28 text-right">
                <span className="text-small text-text-muted">{label}</span>
            </div>
            <div className="flex-1 h-7 bg-argent/10 rounded overflow-hidden relative">
                <div
                    className={`h-full ${color} rounded transition-all duration-500`}
                    style={{ width: `${Math.max(Math.min(pct, 100), 2)}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-between px-3">
                    <span className="text-[11px] font-black font-mono text-text-primary">{value}</span>
                    {rate && <span className="text-[9px] text-text-muted">{rate}</span>}
                </div>
            </div>
        </div>
    );
}
