"use client";

import React from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { KPISummary, DiagnosticFinding, DiagnosticReport } from "@/types";

interface DashboardProps {
    report?: DiagnosticReport;
    isLoading?: boolean;
    error?: string | null;
    onRefresh?: () => void;
}

export default function Dashboard({
    report,
    isLoading = false,
    error = null,
    onRefresh
}: DashboardProps) {
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (isLoading) {
        return (
            <AppLayout>
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="animate-pulse text-text-secondary">Analizando señales de la cuenta...</div>
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
                </div>
            </AppLayout>
        );
    }

    if (!report) {
        return (
            <AppLayout>
                <div className="text-center p-12">
                    <p className="text-text-secondary">No hay datos de reporte disponibles.</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="space-y-8">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-hero text-text-primary mb-2">Panel de Auditoría</h1>
                        <p className="text-body text-text-secondary">
                            Reporte generado el {mounted ? new Date(report.generatedAt).toLocaleString('es-ES') : "..."}
                        </p>
                    </div>
                    {onRefresh && (
                        <button
                            onClick={onRefresh}
                            className="btn-secondary flex items-center gap-2 text-small py-2 px-4 shadow-sm hover:shadow-md transition-all active:scale-95"
                            title="Actualizar datos"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Refrescar
                        </button>
                    )}
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {report.kpis.map((kpi, index) => (
                        <KPICard key={index} kpi={kpi} />
                    ))}
                </div>

                {/* Findings */}
                <div className="space-y-4">
                    <h2 className="text-subheader text-text-primary">Hallazgos Diagnósticos</h2>
                    <div className="grid grid-cols-1 gap-4">
                        {report.findings.map(finding => (
                            <FindingCard key={finding.id} finding={finding} />
                        ))}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

function KPICard({ kpi }: { kpi: KPISummary }) {
    return (
        <div className="card space-y-2">
            <div className="flex justify-between items-start text-small text-text-muted uppercase font-bold tracking-wider">
                <span>{kpi.label}</span>
                {kpi.trend === "up" && <span className="text-synced">↑</span>}
                {kpi.trend === "down" && <span className="text-red-400">↓</span>}
            </div>
            <div className="flex items-baseline gap-2">
                <span className="text-hero text-text-primary">{kpi.value}{kpi.suffix}</span>
                {kpi.change && (
                    <span className={`text-small font-bold ${kpi.trend === "up" ? "text-synced" : "text-red-400"}`}>
                        {kpi.trend === "up" ? "+" : "-"}{kpi.change}%
                    </span>
                )}
            </div>
            {kpi.limit && <div className="text-small text-text-muted italic">{kpi.limit}</div>}
        </div>
    );
}

function FindingCard({ finding }: { finding: DiagnosticFinding }) {
    const severityColors = {
        CRITICAL: "border-red-500/30 bg-red-500/5",
        WARNING: "border-yellow-500/30 bg-yellow-500/5",
        HEALTHY: "border-green-500/30 bg-green-500/5",
        INACTIVE: "border-argent/30 bg-argent/5",
    };

    return (
        <div className={`card flex items-start gap-4 border-l-4 ${severityColors[finding.severity]}`}>
            <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${finding.severity === "CRITICAL" ? "bg-red-500" :
                        finding.severity === "WARNING" ? "bg-yellow-500" : "bg-green-500"
                        }`} />
                    <h3 className="text-body font-bold text-text-primary">{finding.title}</h3>
                </div>
                <p className="text-body text-text-secondary">{finding.description}</p>
            </div>
            {/* {finding.actionLabel && (
                <button className="btn-secondary text-small py-2 px-4 whitespace-nowrap">
                    {finding.actionLabel}
                </button>
            )} */}
        </div>
    );
}
