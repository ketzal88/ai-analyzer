"use client";
import React from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { AdvancedKPISummary, DashboardReport, Alert } from "@/types";
import Link from "next/link";

export type DateRangeOption = "today" | "yesterday" | "last_7d" | "last_30d" | "this_month";

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

    if (isLoading) {
        return (
            <AppLayout>
                <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                    <div className="w-12 h-12 border-4 border-classic border-t-transparent rounded-full animate-spin"></div>
                    <div className="text-text-secondary animate-pulse font-bold">Sincronizando Centro de Mando...</div>
                </div>
            </AppLayout>
        );
    }

    if (error) {
        return (
            <AppLayout>
                <div className="card p-8 border-red-500/20 bg-red-500/5 text-center">
                    <h2 className="text-subheader text-red-400 mb-2">Error de Conexión</h2>
                    <p className="text-body text-text-secondary">{error}</p>
                    <button onClick={onRefresh} className="btn-secondary mt-4">Reintentar</button>
                </div>
            </AppLayout>
        );
    }

    if (!report) return null;

    // --- Cockpit Logic ---
    const criticalAlerts = report.alerts?.filter(a => a.severity === "CRITICAL") || [];
    const warningAlerts = report.alerts?.filter(a => a.severity === "WARNING") || [];
    const opportunities = report.alerts?.filter(a => a.type === "SCALING_OPPORTUNITY" || a.type === "UNDERFUNDED_WINNER") || [];

    // System Health Score (Simple heuristic)
    const baseScore = 100;
    const healthScore = Math.max(0, baseScore - (criticalAlerts.length * 15) - (warningAlerts.length * 5));

    let healthColor = "text-synced";
    if (healthScore < 80) healthColor = "text-yellow-500";
    if (healthScore < 60) healthColor = "text-red-500";

    return (
        <AppLayout>
            <div className="space-y-8 pb-20">
                {/* Header Row */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div>
                        <h1 className="text-display font-black text-text-primary uppercase tracking-tighter">Centro de Mando</h1>
                        <p className="text-small text-text-muted font-bold uppercase tracking-widest mt-1">
                            Visión Operativa Unificada • {report.config.currencyCode}
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <select
                            value={range}
                            onChange={(e) => onRangeChange(e.target.value as DateRangeOption)}
                            className="bg-stellar border border-argent rounded-lg px-4 py-2 text-small font-bold text-text-primary outline-none focus:border-classic"
                        >
                            <option value="today">Hoy (Parcial)</option>
                            <option value="yesterday">Ayer</option>
                            <option value="last_7d">Últimos 7 Días</option>
                            <option value="last_30d">Últimos 30 Días</option>
                            <option value="this_month">Este Mes</option>
                        </select>

                        <button
                            onClick={onRefresh}
                            className="p-2 hover:bg-argent/10 rounded-lg text-text-muted hover:text-text-primary transition-colors"
                            title="Actualizar Datos"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Macro Status Grid */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    {/* Health Widget */}
                    <div className="md:col-span-4 lg:col-span-3 card flex flex-col justify-between relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <span className="text-6xl">🏥</span>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Salud de la Cuenta</p>
                            <div className={`text-[48px] font-black leading-none mt-2 ${healthColor}`}>
                                {healthScore}/100
                            </div>
                        </div>
                        <div className="mt-4 space-y-2">
                            {criticalAlerts.length > 0 ? (
                                <div className="flex items-center gap-2 text-red-400 font-bold text-small">
                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                    {criticalAlerts.length} Problemas Críticos
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-synced font-bold text-small">
                                    <span className="w-2 h-2 rounded-full bg-synced" />
                                    Sistema Estable
                                </div>
                            )}
                            <p className="text-[10px] text-text-muted">Último Sync: {new Date(report.generatedAt).toLocaleTimeString()}</p>
                        </div>
                    </div>

                    {/* KPI Cards */}
                    <div className="md:col-span-8 lg:col-span-9 grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {report.kpis.slice(0, 4).map(kpi => ( // Show top 4 KPIs
                            <CockpitKPICard key={kpi.id} kpi={kpi} />
                        ))}
                    </div>

                    {/* GEM Status Widget */}
                    <div className="md:col-span-12">
                        <div className="card p-6 bg-stellar/50">
                            <h3 className="text-small font-black text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="text-synced">🧠</span> Estrategia IA (GEM Engine)
                            </h3>
                            {report.gemSummary ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    {/* Learning State */}
                                    <div className="space-y-3 border-r border-argent/30 pr-0 md:pr-8 last:border-0">
                                        <p className="text-[10px] font-bold text-text-secondary uppercase">Fase de Aprendizaje</p>
                                        <div className="flex justify-between items-center text-small">
                                            <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>Exploración</span>
                                            <span className="font-mono font-bold text-text-primary">{report.gemSummary.learning.exploration}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-small">
                                            <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>Explotación</span>
                                            <span className="font-mono font-bold text-text-primary">{report.gemSummary.learning.exploitation}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-small">
                                            <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>Inestable</span>
                                            <span className="font-mono font-bold text-text-primary">{report.gemSummary.learning.unstable}</span>
                                        </div>
                                    </div>

                                    {/* Intent Stage */}
                                    <div className="space-y-3 border-r border-argent/30 pr-0 md:pr-8 last:border-0">
                                        <p className="text-[10px] font-bold text-text-secondary uppercase">Distribución de Intención</p>
                                        <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-argent/20 mt-2 mb-3">
                                            <div className="bg-purple-300 h-full" style={{ width: `${(report.gemSummary.intent.tofu / (report.gemSummary.intent.tofu + report.gemSummary.intent.mofu + report.gemSummary.intent.bofu || 1)) * 100}%` }}></div>
                                            <div className="bg-purple-500 h-full" style={{ width: `${(report.gemSummary.intent.mofu / (report.gemSummary.intent.tofu + report.gemSummary.intent.mofu + report.gemSummary.intent.bofu || 1)) * 100}%` }}></div>
                                            <div className="bg-purple-700 h-full" style={{ width: `${(report.gemSummary.intent.bofu / (report.gemSummary.intent.tofu + report.gemSummary.intent.mofu + report.gemSummary.intent.bofu || 1)) * 100}%` }}></div>
                                        </div>
                                        <div className="flex justify-between text-[10px] font-mono text-text-muted">
                                            <span>TOFU ({report.gemSummary.intent.tofu})</span>
                                            <span>MOFU ({report.gemSummary.intent.mofu})</span>
                                            <span>BOFU ({report.gemSummary.intent.bofu})</span>
                                        </div>
                                    </div>

                                    {/* Decisions */}
                                    <div className="space-y-3">
                                        <p className="text-[10px] font-bold text-text-secondary uppercase">Acciones Recomendadas</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="p-2 bg-synced/10 rounded flex flex-col hover:bg-synced/20 transition-colors">
                                                <span className="text-[9px] font-black text-synced uppercase">Escalar</span>
                                                <span className="text-lg font-black text-text-primary">{report.gemSummary.decisions.scale}</span>
                                            </div>
                                            <div className="p-2 bg-red-500/10 rounded flex flex-col hover:bg-red-500/20 transition-colors">
                                                <span className="text-[9px] font-black text-red-500 uppercase">Apagar</span>
                                                <span className="text-lg font-black text-text-primary">{report.gemSummary.decisions.kill}</span>
                                            </div>
                                            <div className="p-2 bg-yellow-500/10 rounded flex flex-col hover:bg-yellow-500/20 transition-colors">
                                                <span className="text-[9px] font-black text-yellow-500 uppercase">Rotar</span>
                                                <span className="text-lg font-black text-text-primary">{report.gemSummary.decisions.rotate}</span>
                                            </div>
                                            <div className="p-2 bg-blue-500/10 rounded flex flex-col hover:bg-blue-500/20 transition-colors">
                                                <span className="text-[9px] font-black text-blue-500 uppercase">Mantener</span>
                                                <span className="text-lg font-black text-text-primary">{report.gemSummary.decisions.hold}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-6 text-text-muted text-small border border-dashed border-argent/50 rounded-xl">
                                    <p>Recopilando inteligencia del motor...</p>
                                    <p className="text-[10px] mt-1 opacity-60">Los datos aparecerán en el próximo análisis.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Priority Actions & Alerts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* Column 1: Critical & Warnings */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-subheader font-black text-text-primary uppercase tracking-widest flex items-center gap-2">
                                <span className="text-red-500">⚡</span> Atención Requerida
                            </h2>
                            <Link href="/ads-manager" className="text-[10px] font-black text-classic uppercase hover:underline">
                                Gestionar Todo →
                            </Link>
                        </div>

                        <div className="space-y-3">
                            {criticalAlerts.length === 0 && warningAlerts.length === 0 ? (
                                <div className="p-6 rounded-xl border border-dashed border-argent/50 text-center">
                                    <p className="text-text-muted text-small font-medium">Todo bajo control. No hay alertas activas.</p>
                                </div>
                            ) : (
                                <>
                                    {criticalAlerts.map(alert => (
                                        <AlertCard key={alert.id} alert={alert} />
                                    ))}
                                    {warningAlerts.slice(0, 3).map(alert => (
                                        <AlertCard key={alert.id} alert={alert} />
                                    ))}
                                </>
                            )}
                        </div>
                    </section>

                    {/* Column 2: Opportunities & Shortcuts */}
                    <section className="space-y-4">
                        <h2 className="text-subheader font-black text-text-primary uppercase tracking-widest flex items-center gap-2">
                            <span className="text-synced">🚀</span> Oportunidades de Crecimiento
                        </h2>

                        <div className="space-y-3">
                            {opportunities.length === 0 ? (
                                <div className="p-6 rounded-xl border border-dashed border-argent/50 text-center">
                                    <p className="text-text-muted text-small font-medium">El sistema está buscando señales de escala...</p>
                                </div>
                            ) : (
                                opportunities.map(op => (
                                    <div key={op.id} className="p-4 bg-synced/5 border border-synced/20 rounded-xl hover:bg-synced/10 transition-colors cursor-pointer group">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="bg-synced text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase">Escalar</span>
                                                    <span className="text-small font-black text-text-primary">{op.title}</span>
                                                </div>
                                                <p className="text-[11px] text-text-secondary">{op.description}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[10px] font-black text-text-muted uppercase">Impacto</span>
                                                <p className="text-synced font-black">{op.impactScore}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Quick Access Grid */}
                        <div className="pt-4 grid grid-cols-2 gap-4">
                            <Link href="/ads-manager" className="p-4 bg-stellar border border-argent rounded-xl hover:border-classic/50 transition-all group">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-2xl group-hover:scale-110 transition-transform">📊</span>
                                    <span className="text-text-muted group-hover:text-classic transition-colors">→</span>
                                </div>
                                <p className="font-black text-text-primary uppercase text-[11px] tracking-wide">Ads Manager</p>
                                <p className="text-[10px] text-text-muted mt-1">Gestión detallada de campañas</p>
                            </Link>

                            <Link href="/decision-board" className="p-4 bg-stellar border border-argent rounded-xl hover:border-special/50 transition-all group">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-2xl group-hover:scale-110 transition-transform">🧬</span>
                                    <span className="text-text-muted group-hover:text-special transition-colors">→</span>
                                </div>
                                <p className="font-black text-text-primary uppercase text-[11px] tracking-wide">Diagnóstico GEM</p>
                                <p className="text-[10px] text-text-muted mt-1">Matriz de decisión completa</p>
                            </Link>
                        </div>
                    </section>

                </div>
            </div>
        </AppLayout>
    );
}

function CockpitKPICard({ kpi }: { kpi: AdvancedKPISummary }) {
    const isPositive = kpi.delta >= 0;
    const isGood = (kpi.id === "cpa" || kpi.id === "costPerLead") ? !isPositive : isPositive;

    // Color logic: "Good" = Synced (Green), "Bad" = Red, "Neutral" = Muted
    const color = isGood ? "text-synced" : "text-red-400";
    const bg = isGood ? "bg-synced/5" : "bg-red-500/5";

    return (
        <div className={`card p-5 hover:border-classic/30 transition-all group ${bg}`}>
            <div className="flex justify-between items-start mb-2">
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest truncate">{kpi.label}</p>
                <div className={`px-1.5 py-0.5 rounded text-[9px] font-black ${isGood ? "bg-synced/10 text-synced" : "bg-red-500/10 text-red-500"}`}>
                    {isPositive ? "+" : ""}{kpi.delta.toFixed(1)}%
                </div>
            </div>

            <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-text-primary">
                    {kpi.prefix}{typeof kpi.current === 'number' ? kpi.current.toLocaleString() : kpi.current}{kpi.suffix}
                </span>
                <span className="text-[10px] text-text-muted font-medium">
                    vs {kpi.prefix}{typeof kpi.previous === 'number' ? kpi.previous.toLocaleString() : kpi.previous}{kpi.suffix}
                </span>
            </div>
        </div>
    );
}

function AlertCard({ alert }: { alert: Alert }) {
    const isCritical = alert.severity === "CRITICAL";
    return (
        <div className={`p-4 rounded-xl border flex gap-4 ${isCritical ? "bg-red-500/5 border-red-500/20" : "bg-yellow-500/5 border-yellow-500/20"}`}>
            <div className="text-xl pt-0.5">{isCritical ? "🚨" : "⚠️"}</div>
            <div className="flex-1">
                <div className="flex justify-between items-start">
                    <h4 className={`text-small font-black uppercase tracking-wide mb-1 ${isCritical ? "text-red-400" : "text-yellow-500"}`}>
                        {alert.title}
                    </h4>
                    <span className="text-[9px] font-bold text-text-muted uppercase bg-black/20 px-1.5 py-0.5 rounded">
                        {alert.level}
                    </span>
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed mb-2">
                    {alert.description}
                </p>
                {alert.evidence && alert.evidence.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {alert.evidence.map((ev, i) => (
                            <span key={i} className="text-[9px] font-medium text-text-muted bg-black/10 px-1.5 py-0.5 rounded border border-white/5">
                                {ev}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
