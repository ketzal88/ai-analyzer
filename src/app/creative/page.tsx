"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { useClient } from "@/contexts/ClientContext";
import { SelectedCreative, CreativeSelectionResponse } from "@/types/creative-kpi";
import CreativeFilters from "@/components/creative/CreativeFilters";
import CreativeGrid from "@/components/creative/CreativeGrid";

export default function CreativeIntelligencePage() {
    const { selectedClientId } = useClient();

    // States
    const [data, setData] = useState<CreativeSelectionResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filter States
    const [range, setRange] = useState("last_14d");
    const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
    const [search, setSearch] = useState("");
    const [format, setFormat] = useState("");
    const [reason, setReason] = useState("");

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
                        <h1 className="text-display font-black text-text-primary mb-2">CREATIVE INTELLIGENCE</h1>
                        <p className="text-subheader text-text-secondary uppercase tracking-widest font-bold text-[12px]">
                            Librería Activa y Análisis de Activos
                        </p>
                    </div>

                    {data && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-special border border-argent rounded-lg">
                            <div className={`w-2 h-2 rounded-full ${data.cacheHit ? "bg-synced" : "bg-classic"} animate-pulse`} />
                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                                {data.cacheHit ? "Datos en Cache" : "Cálculo en vivo"}
                            </span>
                        </div>
                    )}
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
                    {error ? (
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
