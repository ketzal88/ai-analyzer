"use client";

import React from "react";
import AppLayout from "@/components/layouts/AppLayout";

import { useEffect, useState } from "react";
import { useClient } from "@/contexts/ClientContext";
import { DiagnosticFinding } from "@/types";
import { DateRangeOption } from "@/components/pages/Dashboard";

export default function FindingsPage() {
    const { selectedClientId } = useClient();
    const [findings, setFindings] = useState<DiagnosticFinding[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [range, setRange] = useState<DateRangeOption>("last_14d");

    const fetchActiveFindings = async () => {
        if (!selectedClientId) return;
        setIsLoading(true);
        setError(null);
        try {
            // Use unified Analyze Endpoint to get findings
            // We use 'forceRefresh: false' to get cached findings if available
            const res = await fetch("/api/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientId: selectedClientId,
                    currentRangePreset: range,
                    compareMode: "previous_period",
                    flags: {
                        syncIfMissing: false // Don't auto-sync here, rely on Dashboard or user action
                    }
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Error al cargar hallazgos");
            }

            const data = await res.json();
            const loadedFindings = data.findingsRun?.findings || [];

            // Filter out those without valid severity just in case
            setFindings(loadedFindings);

        } catch (err: any) {
            console.error("Findings fetch error:", err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (selectedClientId) {
            fetchActiveFindings();
        }
    }, [selectedClientId, range]);

    return (
        <AppLayout>
            <div className="space-y-6 pb-20">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-display font-black text-text-primary mb-2">HALLAZGOS DIAGNÓSTICOS</h1>
                        <p className="text-subheader text-text-secondary uppercase tracking-widest font-bold text-[12px]">
                            SEÑALES AUTOMÁTICAS CON EVIDENCIA
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <select
                            value={range}
                            onChange={(e) => setRange(e.target.value as DateRangeOption)}
                            className="bg-stellar border border-argent rounded-lg px-3 py-2 text-small font-bold text-text-primary focus:border-classic outline-none min-w-[160px]"
                        >
                            <option value="last_7d">Últimos 7 días</option>
                            <option value="last_14d">Últimos 14 días</option>
                            <option value="last_30d">Últimos 30 días</option>
                            <option value="last_90d">Últimos 90 días</option>
                            <option value="this_month">Este Mes</option>
                            <option value="last_month">Mes Pasado</option>
                        </select>

                        <button
                            onClick={fetchActiveFindings}
                            className="p-2 bg-stellar border border-argent rounded-lg hover:border-classic text-text-muted hover:text-classic transition-colors"
                            title="Recargar Hallazgos"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-10 h-10 border-4 border-classic border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-text-muted mt-4 font-bold text-[12px] uppercase">Analizando...</p>
                    </div>
                ) : error ? (
                    <div className="p-8 border border-red-500/30 bg-red-500/5 rounded-xl text-center">
                        <h3 className="text-red-400 font-bold mb-2">Error de Carga</h3>
                        <p className="text-text-secondary text-small">{error}</p>
                    </div>
                ) : findings.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {findings.map((finding) => (
                            <FindingCard key={finding.id} finding={finding} />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6">
                        <div className="card p-12 text-center border-dashed border-2 border-argent bg-special/30">
                            <div className="w-16 h-16 bg-classic/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-classic" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                            </div>
                            <h3 className="text-subheader text-text-primary font-bold mb-2">SIN SEÑALES CRÍTICAS</h3>
                            <p className="text-body text-text-secondary max-w-sm mx-auto">
                                No se encontraron anomalías graves en este periodo. La cuenta parece estable según las reglas de diagnóstico actuales.
                            </p>
                            <button onClick={fetchActiveFindings} className="mt-4 text-classic text-small font-bold hover:underline">
                                Forzar Re-análisis
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
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
        <div className={`card flex items-start gap-4 border-l-4 ${severityColors[finding.severity || "WARNING"]}`}>
            <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${finding.severity === "CRITICAL" ? "bg-red-500" :
                        finding.severity === "WARNING" ? "bg-yellow-500" : "bg-green-500"
                        }`} />
                    <h3 className="text-body font-bold text-text-primary">{finding.title}</h3>
                </div>
                <p className="text-body text-text-secondary">{finding.description}</p>
                {finding.evidence && (
                    <div className="mt-3 flex gap-4 text-[10px] font-bold text-text-muted uppercase bg-black/20 p-2 rounded inline-flex">
                        <span>Actual: {Number(finding.evidence.current).toFixed(2)}</span>
                        <span>Umbral: {finding.evidence.threshold ? Number(finding.evidence.threshold).toFixed(2) : "N/A"}</span>
                        <span className={finding.evidence.delta > 0 ? "text-synced" : "text-red-400"}>
                            Dif: {finding.evidence.delta?.toFixed(1)}%
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
