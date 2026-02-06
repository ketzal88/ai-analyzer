"use client";
import React from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { AdvancedKPISummary, DashboardReport, DiagnosticFinding } from "@/types"; // Cleaned imports

export type DateRangeOption = "last_7d" | "last_14d" | "last_30d" | "last_90d" | "this_month" | "last_month";

interface DashboardProps {
    report?: DashboardReport;
    isLoading?: boolean;
    error?: string | null;
    onRefresh?: () => void;
    range: DateRangeOption;
    onRangeChange: (range: DateRangeOption) => void;
}

export default function Dashboard({
    report,
    isLoading = false,
    error = null,
    onRefresh,
    range,
    onRangeChange
}: DashboardProps) {
    // const [mounted, setMounted] = React.useState(false); - Removed unused

    const rangeLabels: Record<DateRangeOption, string> = {
        last_7d: "Últimos 7 días",
        last_14d: "Últimos 14 días",
        last_30d: "Últimos 30 días",
        last_90d: "Últimos 90 días",
        this_month: "Este Mes",
        last_month: "Mes Pasado"
    };

    if (isLoading) {
        return (
            <AppLayout>
                <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                    <div className="w-12 h-12 border-4 border-classic border-t-transparent rounded-full animate-spin"></div>
                    <div className="text-text-secondary animate-pulse font-bold">Analizando señales de la cuenta...</div>
                </div>
            </AppLayout>
        );
    }

    if (error) {
        return (
            <AppLayout>
                <div className="card p-8 border-red-500/20 bg-red-500/5 text-center">
                    <h2 className="text-subheader text-red-400 mb-2">Análisis Fallido</h2>
                    <p className="text-body text-text-secondary">{error}</p>
                    <button onClick={onRefresh} className="btn-secondary mt-4">Reintentar</button>
                </div>
            </AppLayout>
        );
    }

    if (!report) {
        // Empty state wrapper
        return <AppLayout><div className="text-center p-12 text-text-secondary">Cargando...</div></AppLayout>;
    }

    return (
        <AppLayout>
            <div className="space-y-8 pb-20">
                {/* Pro Header */}
                <div className="flex flex-col lg:flex-row justify-between items-start gap-6 bg-stellar/50 p-6 rounded-xl border border-argent/50">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-display font-black text-text-primary">Panel de Auditoría</h1>
                            <span className="px-2 py-0.5 bg-classic text-white text-[10px] font-black uppercase rounded">v2.1</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] font-bold text-text-muted uppercase tracking-widest">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-synced shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                <span>Fuente: Meta Ads API</span>
                            </div>
                            <span>{report.config.currencyCode} • {report.config.timezone}</span>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 items-end md:items-center">
                        <div className="flex items-end gap-2">
                            <div className="flex flex-col items-end gap-1">
                                <span className="text-[10px] font-black uppercase text-text-muted tracking-widest">Comparar Con</span>
                                <select
                                    className="bg-stellar border border-argent rounded-lg px-3 py-2 text-small font-bold text-text-primary focus:border-classic outline-none min-w-[140px]"
                                    defaultValue="previous_period"
                                >
                                    <option value="previous_period">Periodo Anterior</option>
                                    <option value="wow">Año Pasado (YoY) - Deshab.</option>
                                </select>
                            </div>

                            <div className="flex flex-col items-end gap-1">
                                <span className="text-[10px] font-black uppercase text-text-muted tracking-widest">Rango de Análisis</span>
                                <select
                                    value={range}
                                    onChange={(e) => onRangeChange(e.target.value as DateRangeOption)}
                                    className="bg-stellar border border-argent rounded-lg px-3 py-2 text-small font-bold text-text-primary focus:border-classic outline-none min-w-[160px]"
                                >
                                    {Object.entries(rangeLabels).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {onRefresh && (
                            <button
                                onClick={onRefresh}
                                className="btn-primary flex items-center gap-2 px-6 py-2.5 shadow-lg shadow-classic/20 hover:shadow-classic/40 active:scale-95 transition-all"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                EJECUTAR ANÁLISIS
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-between text-[11px] font-bold text-text-muted uppercase tracking-widest px-2">
                    <div>
                        <span className="text-text-primary">Periodo:</span> {report.dateRange.start} al {report.dateRange.end}
                    </div>
                    <div>
                        <span className="text-classic">Vs:</span> {report.comparisonRange.start} al {report.comparisonRange.end}
                    </div>
                </div>

                {/* KPI Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {report.kpis.map((kpi) => (
                        <AdvancedKPICard key={kpi.id} kpi={kpi} />
                    ))}
                </div>

                {/* Client Config Summary (Subtle) */}
                <div className="p-4 bg-special/30 border border-argent rounded-xl flex flex-wrap gap-8 text-[10px] uppercase font-black tracking-widest text-text-muted">
                    <div className="space-y-1">
                        <p className="opacity-50 text-white">Conversión Primaria</p>
                        <p className="text-classic">{report.config.primaryConversionType}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="opacity-50 text-white">Atribución de Valor</p>
                        <p className="text-classic">{report.config.valueType}</p>
                    </div>
                    {report.config.whatsappClickType && (
                        <div className="space-y-1">
                            <p className="opacity-50 text-white">WhatsApp Track</p>
                            <p className="text-classic">{report.config.whatsappClickType}</p>
                        </div>
                    )}
                </div>

                {/* Findings Summary Badges */}
                <div className="flex items-center gap-4 p-4 bg-stellar/30 border border-argent/30 rounded-xl">
                    <span className="text-[11px] font-black text-text-muted uppercase tracking-widest">Estado del Diagnóstico:</span>
                    <div className="flex gap-2">
                        {report.findings.filter(f => f.severity === "CRITICAL").length > 0 && (
                            <span className="px-3 py-1 bg-red-500/10 text-red-500 border border-red-500/20 rounded text-[10px] font-bold uppercase">
                                {report.findings.filter(f => f.severity === "CRITICAL").length} Críticos
                            </span>
                        )}
                        {report.findings.filter(f => f.severity === "WARNING").length > 0 && (
                            <span className="px-3 py-1 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded text-[10px] font-bold uppercase">
                                {report.findings.filter(f => f.severity === "WARNING").length} Advertencias
                            </span>
                        )}
                        {report.findings.length === 0 && (
                            <span className="px-3 py-1 bg-green-500/10 text-green-500 border border-green-500/20 rounded text-[10px] font-bold uppercase">
                                Sistema Saludable
                            </span>
                        )}
                        <span className="text-[10px] text-text-muted underline cursor-pointer ml-auto" onClick={() => window.location.href = '/findings'}>Ver Detalle →</span>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

function AdvancedKPICard({ kpi }: { kpi: AdvancedKPISummary }) {
    // const isPositive = kpi.delta >= 0;  - Removed unused
    const trendColor = kpi.trend === "up" ? "text-synced" : kpi.trend === "down" ? "text-red-400" : "text-text-muted";

    return (
        <div className="card relative group hover:border-classic/30 transition-all duration-300">
            {/* Info Tooltip Icon */}
            {kpi.definition && (
                <div className="absolute top-4 right-4 text-text-muted opacity-30 group-hover:opacity-100 transition-opacity cursor-help" title={`${kpi.definition.label}\nFuente: ${kpi.definition.source}\n${kpi.definition.formula || ""}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
            )}

            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">{kpi.label}</p>

            <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                    <span className="text-[28px] font-black text-text-primary leading-none">
                        {kpi.prefix}{kpi.current}{kpi.suffix}
                    </span>
                    <div className={`flex items-center text-[11px] font-black ${trendColor}`}>
                        {kpi.trend === "up" ? "↑" : kpi.trend === "down" ? "↓" : "•"}
                        {Math.abs(kpi.delta).toFixed(1)}%
                    </div>
                </div>
                <div className="text-[11px] font-bold text-text-muted/60">
                    Prev: {kpi.prefix}{kpi.previous}{kpi.suffix}
                </div>
            </div>
        </div>
    );
}
