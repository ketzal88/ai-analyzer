"use client";

import React, { useEffect, useState } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { useClient } from "@/contexts/ClientContext";
import { useAnalyst } from "@/contexts/AnalystContext";
import { WinningPatterns, PatternInsight } from "@/lib/creative-pattern-service";

function formatCurrency(value: number | undefined, prefix = "$"): string {
    if (value === undefined || value === null) return "—";
    if (value >= 1_000_000) return `${prefix}${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${prefix}${(value / 1_000).toFixed(1)}K`;
    return `${prefix}${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const CATEGORY_LABELS: Record<string, { label: string; color: string; desc: string }> = {
    DOMINANT_SCALABLE: { label: "Dominante Escalable", color: "bg-synced/60", desc: "Alto gasto + CPA eficiente" },
    HIDDEN_BOFU: { label: "BOFU Oculto", color: "bg-classic/60", desc: "Bajo gasto + excelente conversión" },
    WINNER_SATURATING: { label: "Ganador Saturando", color: "bg-yellow-400/60", desc: "Eficiente pero con fatiga" },
    INEFFICIENT_TOFU: { label: "TOFU Ineficiente", color: "bg-red-400/60", desc: "Alto gasto + baja eficiencia" },
    ZOMBIE: { label: "Zombie", color: "bg-gray-500/60", desc: "Gasto mínimo, resultados mínimos" },
    NEW_INSUFFICIENT_DATA: { label: "Nuevo / Sin Datos", color: "bg-argent/40", desc: "Muy reciente para clasificar" },
};

interface PatternLabData {
    patterns: WinningPatterns;
    categoryDistribution: Record<string, number>;
    totalAds: number;
    computedDate: string;
}

export default function PatternLab() {
    const { selectedClientId: clientId } = useClient();
    const { openAnalyst } = useAnalyst();
    const [data, setData] = useState<PatternLabData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!clientId) return;
        setIsLoading(true);
        setError(null);

        fetch(`/api/intelligence/patterns?clientId=${clientId}`)
            .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then(d => setData(d))
            .catch(err => setError(err.message))
            .finally(() => setIsLoading(false));
    }, [clientId]);

    const p = data?.patterns;

    return (
        <AppLayout>
            <div className="space-y-6 pb-20">
            {/* Page Title */}
            <div>
                <h1 className="text-display font-black text-text-primary mb-2">PATTERN LAB</h1>
                <p className="text-subheader text-text-secondary uppercase tracking-widest font-bold text-[12px]">
                    Patrones Ganadores de Creativos
                </p>
            </div>

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    {data && (
                        <span className="text-[9px] font-mono text-text-muted">
                            Última actualización: {data.computedDate}
                        </span>
                    )}
                    <button
                        onClick={() => openAnalyst("meta_ads", "Analiza los patrones ganadores de los creativos: qué formatos, hooks y estilos funcionan mejor.")}
                        className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-classic/10 text-classic border border-classic/30 hover:bg-classic/20 transition-colors"
                    >
                        Analizar con IA
                    </button>
                </div>
            </div>

            {!clientId && (
                <div className="card p-12 text-center">
                    <p className="text-text-muted text-sm">Selecciona un cliente para ver patrones de creativos.</p>
                </div>
            )}

            {clientId && isLoading && (
                <div className="card p-12 text-center">
                    <div className="inline-block w-6 h-6 border-2 border-classic/30 border-t-classic animate-spin" />
                    <p className="text-text-muted text-xs mt-3">Analizando patrones...</p>
                </div>
            )}

            {clientId && error && (
                <div className="card p-6 border-red-500/30 bg-red-500/5">
                    <p className="text-red-400 text-sm">Error: {error}</p>
                </div>
            )}

            {clientId && !isLoading && !error && p && (
                <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="card p-5">
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Total Ganadores</p>
                            <p className="text-2xl font-black font-mono text-synced mt-2">{p.totalWinners}</p>
                            <p className="text-[10px] text-text-muted mt-1">de {data!.totalAds} creativos activos</p>
                        </div>
                        <div className="card p-5">
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Formato Dominante</p>
                            <p className="text-2xl font-black font-mono text-classic mt-2">{p.dominantFormat}</p>
                            <p className="text-[10px] text-text-muted mt-1">entre ganadores</p>
                        </div>
                        <div className="card p-5">
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Etapa Funnel</p>
                            <p className="text-2xl font-black font-mono text-yellow-400 mt-2">{p.dominantFunnelStage}</p>
                            <p className="text-[10px] text-text-muted mt-1">dominante en ganadores</p>
                        </div>
                        <div className="card p-5">
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">CPA Promedio</p>
                            <p className="text-2xl font-black font-mono text-synced mt-2">{formatCurrency(p.avgCPA)}</p>
                            <p className="text-[10px] text-text-muted mt-1">ganadores 7d</p>
                        </div>
                        <div className="card p-5">
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">ROAS Promedio</p>
                            <p className="text-2xl font-black font-mono text-classic mt-2">{p.avgROAS.toFixed(2)}x</p>
                            <p className="text-[10px] text-text-muted mt-1">ganadores 7d</p>
                        </div>
                    </div>

                    {/* Category Distribution */}
                    <div className="card p-6">
                        <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                            Distribución de Categorías
                        </h2>
                        <div className="space-y-3">
                            {Object.entries(data!.categoryDistribution)
                                .sort((a, b) => b[1] - a[1])
                                .map(([cat, count]) => {
                                    const info = CATEGORY_LABELS[cat] || { label: cat, color: "bg-argent/40", desc: "" };
                                    const pct = data!.totalAds > 0 ? (count / data!.totalAds) * 100 : 0;
                                    return (
                                        <div key={cat}>
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-3 h-3 ${info.color}`} />
                                                    <span className="text-xs text-text-secondary font-bold">{info.label}</span>
                                                    <span className="text-[9px] text-text-muted">{info.desc}</span>
                                                </div>
                                                <span className="text-xs font-mono font-bold text-text-secondary">{count} ({pct.toFixed(0)}%)</span>
                                            </div>
                                            <div className="w-full h-3 bg-argent/10">
                                                <div className={`h-full ${info.color} transition-all`} style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>

                    {/* Top Hooks */}
                    {p.topHooks.length > 0 && (
                        <div className="card p-6">
                            <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                Top Hooks (tokens recurrentes en ganadores)
                            </h2>
                            <div className="flex flex-wrap gap-2">
                                {p.topHooks.map((hook, i) => (
                                    <span key={hook} className="px-3 py-1.5 bg-classic/10 text-classic border border-classic/20 text-xs font-mono font-bold">
                                        #{i + 1} {hook}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Pattern Insights */}
                    {p.patterns.length > 0 && (
                        <div className="card p-6">
                            <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                Insights de Patrones
                            </h2>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {p.patterns.map((insight: PatternInsight, i: number) => (
                                    <div key={i} className="bg-stellar border border-argent p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold text-text-secondary">{insight.label}</span>
                                            <span className="text-[9px] font-mono text-classic font-bold">{insight.frequency}% de ganadores</span>
                                        </div>
                                        <p className="text-[11px] text-text-muted">{insight.value}</p>
                                        {/* Frequency bar */}
                                        <div className="w-full h-1.5 bg-argent/20 mt-3">
                                            <div className="h-full bg-classic/50" style={{ width: `${insight.frequency}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Empty state for patterns */}
                    {p.totalWinners === 0 && (
                        <div className="card p-12 text-center">
                            <p className="text-text-muted text-sm">No se encontraron creativos ganadores en el snapshot actual.</p>
                            <p className="text-text-muted text-xs mt-2">
                                Los ganadores son creativos clasificados como DOMINANT_SCALABLE o HIDDEN_BOFU.
                                Asegurate de que haya creativos activos con suficiente data (&gt;4 días, &gt;2000 impresiones).
                            </p>
                        </div>
                    )}
                </div>
            )}
            </div>
        </AppLayout>
    );
}
