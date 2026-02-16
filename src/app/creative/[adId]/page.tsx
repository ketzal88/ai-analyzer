"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import AppLayout from "@/components/layouts/AppLayout";
import { useClient } from "@/contexts/ClientContext";
import Link from "next/link";
import { CreativeDetailResponse } from "@/types/creative-analysis";
import CreativeVariationsDrawer from "@/components/creative/CreativeVariationsDrawer";

export default function CreativeDetailPage() {
    const { adId } = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { selectedClientId } = useClient();
    const range = searchParams.get("range") || "last_14d";

    const [data, setData] = useState<CreativeDetailResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isVariationsOpen, setIsVariationsOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchDetail = useCallback(async () => {
        if (!selectedClientId || !adId) return;

        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/creative/detail?clientId=${selectedClientId}&adId=${adId}&range=${range}`);
            if (!res.ok) throw new Error("Error al cargar detalle");
            const result: CreativeDetailResponse = await res.json();
            setData(result);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [selectedClientId, adId, range]);

    useEffect(() => {
        fetchDetail();
    }, [fetchDetail]);

    const runAnalysis = async () => {
        if (!selectedClientId || !adId) return;

        setIsAnalyzing(true);
        try {
            const res = await fetch("/api/creative/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientId: selectedClientId, adId, range })
            });

            if (!res.ok) throw new Error("Error en el análisis de IA");

            const result = await res.json();
            setData(prev => prev ? { ...prev, aiReport: result.report } : null);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    if (isLoading) {
        return (
            <AppLayout>
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-classic border-t-transparent rounded-full animate-spin" />
                    <p className="mt-4 text-text-muted font-bold uppercase tracking-widest text-[10px]">Cargando activo...</p>
                </div>
            </AppLayout>
        );
    }

    if (error || !data) {
        return (
            <AppLayout>
                <div className="p-8 border border-red-500/30 bg-red-500/5 rounded-xl text-center">
                    <h3 className="text-red-400 font-bold mb-2">Error de Carga</h3>
                    <p className="text-text-secondary text-sm">{error || "No se encontró el activo"}</p>
                    <button onClick={() => router.back()} className="mt-4 text-classic font-bold hover:underline">Volver</button>
                </div>
            </AppLayout>
        );
    }

    const { creative, kpis, cluster, aiReport } = data;

    return (
        <AppLayout>
            <div className="space-y-8 pb-20">

                {/* Breadcrumb & Navigation */}
                <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">
                    <Link href="/creative" className="hover:text-classic transition-colors">Librería</Link>
                    <span>/</span>
                    <span className="text-text-primary">Detalle de Activo</span>
                </div>

                {/* Header Section */}
                <div className="flex flex-col lg:flex-row justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <span className="px-2 py-0.5 bg-classic/10 text-classic text-[10px] font-black rounded uppercase">
                                {creative.creative.format}
                            </span>
                            <h1 className="text-2xl font-black text-text-primary uppercase tracking-tight">
                                {creative.ad.name}
                            </h1>
                        </div>
                        <p className="text-text-secondary text-sm font-medium">
                            Camp: <span className="text-text-primary">{creative.campaign.name}</span>
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Score IA</div>
                            <div className="text-3xl font-black text-classic">
                                {aiReport?.output?.score !== undefined
                                    ? aiReport.output.score
                                    : ((creative.score || 0) * 100).toFixed(0)}
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-3">
                            {/* <button
                                onClick={() => setIsVariationsOpen(true)}
                                className="px-6 py-3 border border-argent rounded-xl font-black text-[12px] uppercase tracking-widest text-text-secondary hover:bg-argent/10 hover:text-text-primary transition-all flex items-center gap-2"
                            >
                                <span className="text-lg">🧪</span>
                                Explorar Variaciones GEM
                            </button> */}

                            <button
                                onClick={runAnalysis}
                                disabled={isAnalyzing}
                                className={`px-6 py-3 rounded-xl font-black text-[12px] uppercase tracking-widest transition-all ${isAnalyzing
                                    ? "bg-stellar text-text-muted cursor-not-allowed"
                                    : "bg-classic text-special hover:brightness-110 active:scale-95 flex items-center gap-2"
                                    }`}
                            >
                                {isAnalyzing ? (
                                    <>
                                        <div className="w-3 h-3 border-2 border-text-muted border-t-transparent rounded-full animate-spin" />
                                        Analizando...
                                    </>
                                ) : (
                                    <>
                                        <span>✨</span>
                                        Generar Auditoría GEM
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Main Artifact Column */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* KPI Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-special border border-argent rounded-2xl">
                            <KPIBox label="Gasto" value={`$${kpis.spend.toLocaleString()}`} />
                            <KPIBox label="ROAS" value={`${kpis.roas.toFixed(2)}x`} color="text-synced" />
                            <KPIBox label="CPA" value={`$${kpis.cpa.toFixed(1)}`} />
                            <KPIBox label="Conv" value={kpis.primaryConversions.toFixed(0)} />
                            <KPIBox label="Impressions" value={kpis.impressions.toLocaleString()} />
                            <KPIBox label="CTR" value={`${kpis.ctr.toFixed(2)}%`} />
                            <KPIBox label="CPC" value={`$${kpis.cpc.toFixed(2)}`} />
                            <KPIBox label="Frequency" value={`${kpis.frequency?.toFixed(2)}x`} />
                        </div>

                        {/* AI Audit Report Render */}
                        {aiReport ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="flex items-center justify-between border-b border-argent pb-4">
                                    <h2 className="text-lg font-black text-text-primary uppercase tracking-widest flex items-center gap-3">
                                        <span className="w-8 h-8 bg-classic/10 rounded-lg flex items-center justify-center text-classic text-sm">✨</span>
                                        Auditoría Estratégica GEM
                                    </h2>
                                    <span className="text-[10px] font-bold text-text-muted uppercase">
                                        Generado: {new Date(aiReport.metadata.generatedAt).toLocaleDateString()} | Versión Prompt: v{aiReport.promptVersion || 1}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="p-6 bg-special border border-argent rounded-2xl space-y-4">
                                        <h3 className="text-[10px] font-black text-classic uppercase tracking-[0.2em]">Diagnóstico</h3>
                                        <p className="text-body text-text-primary leading-relaxed">{aiReport.output?.diagnosis || "Sin diagnóstico disponible."}</p>
                                    </div>

                                    <div className="p-6 bg-special border border-argent rounded-2xl space-y-4">
                                        <h3 className="text-[10px] font-black text-red-400 uppercase tracking-[0.2em]">Riesgos</h3>
                                        <div className="space-y-3">
                                            <div>
                                                <div className="text-[10px] font-bold text-text-muted mb-1">Fatiga</div>
                                                <p className="text-small text-text-secondary">{aiReport.output?.risks?.fatigue || "Sin datos"}</p>
                                            </div>
                                            <div>
                                                <div className="text-[10px] font-bold text-text-muted mb-1">Colisión</div>
                                                <p className="text-small text-text-secondary">{aiReport.output?.risks?.collision || "Sin datos"}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 bg-classic border border-classic/20 rounded-2xl shadow-xl shadow-classic/10">
                                    <h3 className="text-[10px] font-black text-white/70 uppercase tracking-[0.2em] mb-4">Plan de Acción Recomendado</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <ActionItem title="Siguientes 7d" desc={aiReport.output?.actions?.horizon7d || "N/A"} />
                                        <ActionItem title="Optimización 14d" desc={aiReport.output?.actions?.horizon14d || "N/A"} />
                                        <ActionItem title="Estrategia 30d" desc={aiReport.output?.actions?.horizon30d || "N/A"} />
                                    </div>
                                </div>
                            </div>
                        ) : !isAnalyzing && (
                            <div className="p-12 border-2 border-dashed border-argent rounded-2xl text-center space-y-4 bg-stellar/20">
                                <div className="w-16 h-16 bg-stellar/50 rounded-full flex items-center justify-center mx-auto text-2xl">🤖</div>
                                <h3 className="text-subheader font-bold text-text-primary uppercase tracking-widest">Sin Auditoría IA</h3>
                                <p className="text-body text-text-secondary max-w-sm mx-auto">
                                    Este activo no ha sido analizado por el motor GEM aún. Ejecuta el análisis para obtener insights accionables.
                                </p>
                                <button
                                    onClick={runAnalysis}
                                    className="px-6 py-2 bg-text-primary text-black font-black text-[10px] uppercase tracking-widest hover:bg-classic hover:text-special transition-all"
                                >
                                    Analizar ahora
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Sidebar Info Column */}
                    <div className="space-y-8">
                        {/* Copy Info */}
                        <div className="p-6 bg-special border border-argent rounded-2xl space-y-6">
                            <div>
                                <h3 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-3">Copy Principal</h3>
                                <p className="text-small text-text-primary line-clamp-[10]">{creative.creative.primaryText || "Sin texto"}</p>
                            </div>
                            <div>
                                <h3 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-3">Headline</h3>
                                <p className="text-small font-bold text-text-primary">{creative.creative.headline || "Sin título"}</p>
                            </div>
                        </div>

                        {/* Cluster / Copies */}
                        {cluster && cluster.size > 1 && (
                            <div className="p-6 bg-special border border-argent rounded-2xl space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Copias en Cluster</h3>
                                    <span className="px-2 py-0.5 bg-stellar text-[10px] font-bold rounded">{cluster.size}</span>
                                </div>
                                <div className="space-y-3">
                                    {cluster.members.map(member => (
                                        <Link
                                            key={member.adId}
                                            href={`/creative/${member.adId}?range=${range}`}
                                            className="block p-3 bg-stellar/30 border border-transparent hover:border-argent rounded-xl transition-all group"
                                        >
                                            <div className="text-[10px] font-bold text-text-primary group-hover:text-classic transition-colors truncate">{member.adName}</div>
                                            <div className="text-[9px] text-text-muted truncate">{member.campaignName}</div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                </div>

            </div>

            <CreativeVariationsDrawer
                isOpen={isVariationsOpen}
                onClose={() => setIsVariationsOpen(false)}
                clientId={selectedClientId!}
                adId={adId as string}
                range={data?.aiReport?.range || range as any}
            />
        </AppLayout>
    );
}

function KPIBox({ label, value, color = "text-text-primary" }: { label: string; value: string; color?: string }) {
    return (
        <div className="space-y-1">
            <div className="text-[9px] font-bold text-text-muted uppercase tracking-wider">{label}</div>
            <div className={`text-sm font-black tabular-nums ${color}`}>{value}</div>
        </div>
    );
}

function ActionItem({ title, desc }: { title: string; desc: string }) {
    return (
        <div className="space-y-2 py-3 px-4 bg-black/20 rounded-xl">
            <h4 className="text-[9px] font-black text-white/50 uppercase tracking-widest">{title}</h4>
            <p className="text-[11px] text-white/90 leading-snug">{desc || "Pendiente de definición"}</p>
        </div>
    );
}
