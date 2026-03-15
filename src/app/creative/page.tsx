"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/layouts/AppLayout";
import { useClient } from "@/contexts/ClientContext";
import { CreativeSelectionResponse } from "@/types/creative-kpi";
import { CreativeDNA, DiversityScore } from "@/types/creative-dna";
import CreativeFilters from "@/components/creative/CreativeFilters";
import CreativeGrid from "@/components/creative/CreativeGrid";

export default function CreativeIntelligencePage() {
    const { selectedClientId } = useClient();
    const router = useRouter();

    // States
    const [data, setData] = useState<CreativeSelectionResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filter States
    const [range, setRange] = useState("last_14d");
    const [viewMode, setViewMode] = useState<"cards" | "table" | "dna">("cards");
    const [search, setSearch] = useState("");
    const [format, setFormat] = useState("");
    const [reason, setReason] = useState("");

    // DNA View State
    const [dnaRecords, setDnaRecords] = useState<CreativeDNA[]>([]);
    const [diversityScore, setDiversityScore] = useState<DiversityScore | null>(null);
    const [dnaLoading, setDnaLoading] = useState(false);
    const [dnaFilter, setDnaFilter] = useState<{ visualStyle: string; hookType: string; emotionalTone: string }>({ visualStyle: "", hookType: "", emotionalTone: "" });

    const fetchData = useCallback(async () => {
        if (!selectedClientId) return;

        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/creative/active?clientId=${selectedClientId}&range=${range}&limit=40`);

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Error al cargar creativos");
            }

            const result: CreativeSelectionResponse = await res.json();
            setData(result);
        } catch (err: any) {
            console.error("Creative fetch error:", err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [selectedClientId, range]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Fetch DNA data when switching to DNA view
    useEffect(() => {
        if (viewMode !== "dna" || !selectedClientId) return;
        setDnaLoading(true);
        fetch(`/api/creative/dna?clientId=${selectedClientId}`)
            .then(r => r.json())
            .then(d => {
                setDnaRecords(d.dnaRecords || []);
                setDiversityScore(d.diversityScore || null);
            })
            .catch(() => {})
            .finally(() => setDnaLoading(false));
    }, [viewMode, selectedClientId]);

    // Filtered DNA records
    const filteredDna = useMemo(() => {
        return dnaRecords.filter(d => {
            if (dnaFilter.visualStyle && d.vision.visualStyle !== dnaFilter.visualStyle) return false;
            if (dnaFilter.hookType && d.vision.hookType !== dnaFilter.hookType) return false;
            if (dnaFilter.emotionalTone && d.vision.emotionalTone !== dnaFilter.emotionalTone) return false;
            if (search && !d.adId.toLowerCase().includes(search.toLowerCase())) return false;
            if (format && d.format !== format) return false;
            return true;
        });
    }, [dnaRecords, dnaFilter, search, format]);

    // Frontend Filtering
    const filteredCreatives = useMemo(() => {
        if (!data) return [];

        return data.selected.filter(c => {
            // Search filter (name or campaign)
            const matchesSearch = !search ||
                c.adName.toLowerCase().includes(search.toLowerCase()) ||
                c.campaignName.toLowerCase().includes(search.toLowerCase()) ||
                c.headline?.toLowerCase().includes(search.toLowerCase());

            // Format filter
            const matchesFormat = !format || c.format === format;

            // Reason filter
            const matchesReason = !reason || c.reasons.includes(reason as any);

            return matchesSearch && matchesFormat && matchesReason;
        });
    }, [data, search, format, reason]);

    return (
        <AppLayout>
            <div className="space-y-6 pb-20">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-display font-black text-text-primary mb-2">BIBLIOTECA DE CREATIVOS</h1>
                        <p className="text-subheader text-text-secondary uppercase tracking-widest font-bold text-[12px]">
                            Libreria y Analisis de Activos
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button onClick={() => router.push('/creative/briefs')} className="px-3 py-2 bg-classic text-stellar font-black text-[10px] uppercase tracking-widest hover:bg-classic/90 transition-all whitespace-nowrap">Generar Bajadas</button>
                        {data && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-special border border-argent rounded-lg">
                                <div className={`w-2 h-2 rounded-full ${data.cacheHit ? "bg-synced" : "bg-classic"} animate-pulse`} />
                                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                                    {data.cacheHit ? "Datos en Cache" : "Cálculo en vivo"}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Filters */}
                <CreativeFilters
                    range={range}
                    onRangeChange={setRange}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    search={search}
                    onSearchChange={setSearch}
                    format={format}
                    onFormatChange={setFormat}
                    reason={reason}
                    onReasonChange={setReason}
                />

                {/* Content Wrapper */}
                <div className="min-h-[400px]">
                    {viewMode === "dna" ? (
                        /* ── DNA VIEW ── */
                        <div className="space-y-6">
                            {/* Diversity Score Header */}
                            {diversityScore && (
                                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                                    <div className="card p-4">
                                        <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Diversity Score</p>
                                        <p className={`text-2xl font-black font-mono mt-1 ${diversityScore.score >= 0.5 ? "text-synced" : diversityScore.score >= 0.3 ? "text-yellow-400" : "text-red-400"}`}>
                                            {(diversityScore.score * 100).toFixed(0)}%
                                        </p>
                                    </div>
                                    <div className="card p-4">
                                        <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Entity Groups</p>
                                        <p className="text-2xl font-black font-mono text-classic mt-1">{diversityScore.uniqueEntityGroups}</p>
                                    </div>
                                    <div className="card p-4">
                                        <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Ads Activos</p>
                                        <p className="text-2xl font-black font-mono text-text-primary mt-1">{diversityScore.totalActiveAds}</p>
                                    </div>
                                    <div className="card p-4">
                                        <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Estilo Dominante</p>
                                        <p className="text-lg font-black text-text-secondary mt-1 capitalize">{diversityScore.dominantStyle || "—"}</p>
                                    </div>
                                    <div className="card p-4">
                                        <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Hook Dominante</p>
                                        <p className="text-lg font-black text-text-secondary mt-1 capitalize">{diversityScore.dominantHookType || "—"}</p>
                                    </div>
                                </div>
                            )}

                            {/* DNA Filters */}
                            <div className="flex flex-wrap gap-3">
                                <select value={dnaFilter.visualStyle} onChange={e => setDnaFilter(f => ({ ...f, visualStyle: e.target.value }))} className="bg-stellar border border-argent px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider">
                                    <option value="">Visual Style</option>
                                    {["ugc", "polished", "meme", "testimonial", "product-shot", "lifestyle"].map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                                <select value={dnaFilter.hookType} onChange={e => setDnaFilter(f => ({ ...f, hookType: e.target.value }))} className="bg-stellar border border-argent px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider">
                                    <option value="">Hook Type</option>
                                    {["question", "shock", "problem", "social-proof", "offer", "curiosity"].map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                                <select value={dnaFilter.emotionalTone} onChange={e => setDnaFilter(f => ({ ...f, emotionalTone: e.target.value }))} className="bg-stellar border border-argent px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider">
                                    <option value="">Emotional Tone</option>
                                    {["urgency", "trust", "excitement", "fear", "calm"].map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                                <span className="text-[10px] text-text-muted self-center font-mono">{filteredDna.length} / {dnaRecords.length} creativos</span>
                            </div>

                            {/* DNA Cards Grid */}
                            {dnaLoading ? (
                                <div className="card p-12 text-center">
                                    <div className="inline-block w-6 h-6 border-2 border-classic/30 border-t-classic animate-spin" />
                                    <p className="text-text-muted text-xs mt-3">Cargando DNA...</p>
                                </div>
                            ) : filteredDna.length === 0 ? (
                                <div className="card p-12 text-center">
                                    <p className="text-text-muted text-sm">No hay datos de DNA para este cliente.</p>
                                    <p className="text-text-muted text-xs mt-2">El análisis DNA se ejecuta diariamente vía cron después del sync de creativos.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredDna.map(d => (
                                        <div key={`${d.clientId}__${d.adId}`} className="card p-4 hover:border-classic/30 transition-all">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-text-secondary truncate" title={d.adId}>{d.adId}</p>
                                                    <p className="text-[9px] text-text-muted font-mono">{d.format}</p>
                                                </div>
                                                {d.meta?.thumbnailUrl && (
                                                    <img src={d.meta.thumbnailUrl} alt="" className="w-10 h-10 object-cover border border-argent ml-2 shrink-0" />
                                                )}
                                            </div>
                                            {/* Vision badges */}
                                            <div className="flex flex-wrap gap-1 mb-2">
                                                <span className="px-1.5 py-0.5 bg-classic/10 text-classic text-[9px] font-bold">{d.vision.visualStyle}</span>
                                                <span className="px-1.5 py-0.5 bg-synced/10 text-synced text-[9px] font-bold">{d.vision.hookType}</span>
                                                <span className="px-1.5 py-0.5 bg-yellow-400/10 text-yellow-400 text-[9px] font-bold">{d.vision.emotionalTone}</span>
                                                <span className="px-1.5 py-0.5 bg-purple-400/10 text-purple-400 text-[9px] font-bold">{d.vision.settingType}</span>
                                            </div>
                                            {/* Attribute flags */}
                                            <div className="flex gap-2 text-[9px] text-text-muted mb-2">
                                                {d.vision.hasFace && <span className="text-synced">Face</span>}
                                                {d.vision.hasText && <span className="text-classic">Text</span>}
                                                {d.vision.hasProduct && <span className="text-yellow-400">Product</span>}
                                                <span>Color: {d.vision.dominantColor}</span>
                                            </div>
                                            {/* Copy attributes */}
                                            <div className="border-t border-argent pt-2 mt-2">
                                                <div className="flex flex-wrap gap-1">
                                                    <span className="px-1.5 py-0.5 bg-argent/20 text-text-secondary text-[9px] font-bold">{d.copy.messageType}</span>
                                                    <span className="px-1.5 py-0.5 bg-argent/20 text-text-secondary text-[9px] font-bold">{d.copy.ctaType}</span>
                                                    <span className="px-1.5 py-0.5 bg-argent/20 text-text-muted text-[9px]">{d.copy.wordCount}w</span>
                                                    {d.copy.hasNumbers && <span className="px-1.5 py-0.5 bg-argent/20 text-text-muted text-[9px]">#123</span>}
                                                    {d.copy.hasEmoji && <span className="px-1.5 py-0.5 bg-argent/20 text-text-muted text-[9px]">emoji</span>}
                                                </div>
                                            </div>
                                            {/* Entity group */}
                                            {d.estimatedEntityGroup && (
                                                <p className="text-[8px] font-mono text-text-muted mt-2 truncate" title={d.estimatedEntityGroup}>
                                                    Entity: {d.estimatedEntityGroup}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : error ? (
                        <div className="p-8 border border-red-500/30 bg-red-500/5 rounded-xl text-center">
                            <h3 className="text-red-400 font-bold mb-2 uppercase tracking-widest text-sm">Error de Conexión</h3>
                            <p className="text-text-secondary text-sm mb-4">{error}</p>
                            <button
                                onClick={fetchData}
                                className="px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all"
                            >
                                Reintentar
                            </button>
                        </div>
                    ) : (
                        <CreativeGrid
                            creatives={filteredCreatives}
                            isLoading={isLoading}
                            range={range}
                        />
                    )}
                </div>

                {/* Stats Footer */}
                {data && !isLoading && !error && (
                    <div className="flex flex-wrap gap-6 pt-8 border-t border-argent mt-12">
                        <div className="flex gap-2 items-baseline">
                            <span className="text-xs font-black text-text-primary uppercase tracking-widest">Evaluados:</span>
                            <span className="text-sm font-bold text-text-muted tabular-nums">{data.meta.totalCreativesEvaluated}</span>
                        </div>
                        <div className="flex gap-2 items-baseline">
                            <span className="text-xs font-black text-text-primary uppercase tracking-widest">Clusters:</span>
                            <span className="text-sm font-bold text-text-muted tabular-nums">{data.skipped.dedupedCount}</span>
                        </div>
                        <div className="flex gap-2 items-baseline">
                            <span className="text-xs font-black text-text-primary uppercase tracking-widest">Score Promedio:</span>
                            <span className="text-sm font-bold text-classic tabular-nums">{(data.meta.avgScore * 100).toFixed(0)}</span>
                        </div>
                    </div>
                )}

            </div>
        </AppLayout>
    );
}
