"use client";

import React from "react";
import Link from "next/link";
import { SelectedCreative } from "@/types/creative-kpi";

interface CreativeCardProps {
    creative: SelectedCreative;
    range: string;
}

export default function CreativeCard({ creative, range }: CreativeCardProps) {
    const { kpis, reasons, cluster, score } = creative;

    // Placeholder logic for thumbnail
    const formatIcon = (format: string) => {
        switch (format) {
            case "VIDEO": return "🎬";
            case "CAROUSEL": return "🎠";
            case "CATALOG": return "🛍️";
            default: return "🖼️";
        }
    };

    return (
        <div className="bg-special border border-argent rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300 group flex flex-col h-full">
            {/* Thumbnail Area */}
            <div className="aspect-video bg-stellar/30 relative flex items-center justify-center border-b border-argent overflow-hidden">
                <span className="text-4xl filter grayscale group-hover:grayscale-0 transition-all duration-500">
                    {formatIcon(creative.format)}
                </span>

                {/* Format Badge */}
                <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[10px] uppercase font-bold text-white tracking-widest border border-white/10">
                    {creative.format}
                </div>

                {/* Cluster Badge */}
                {cluster && cluster.size > 1 && (
                    <div className="absolute top-3 right-3 px-2 py-1 bg-classic text-[10px] font-bold text-special border border-argent/20">
                        {cluster.size} COPIAS
                    </div>
                )}

                {/* Score Overlay */}
                <div className="absolute bottom-3 right-3 text-right">
                    <div className="text-[10px] text-text-muted font-bold uppercase tracking-widest mb-0.5">Score</div>
                    <div className="text-xl font-bold text-classic leading-none tabular-nums drop-shadow-sm">
                        {(score * 100).toFixed(0)}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="p-4 flex-1 flex flex-col">
                {/* Titles */}
                <div className="mb-4">
                    <h3 className="text-sm font-bold text-text-primary line-clamp-1 mb-0.5" title={creative.adName}>
                        {creative.adName}
                    </h3>
                    <p className="text-[10px] text-text-muted font-medium line-clamp-1 uppercase tracking-tight">
                        {creative.campaignName} • {creative.adsetName}
                    </p>
                </div>

                {/* Reason Chips */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                    {reasons.map((reason) => (
                        <span
                            key={reason}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${reason === "TOP_SPEND" ? "bg-red-500/10 text-red-500 border border-red-500/20" :
                                reason === "HIGH_FATIGUE_RISK" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" :
                                    reason === "UNDERFUNDED_WINNER" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
                                        reason === "NEW_CREATIVE" ? "bg-blue-500/10 text-blue-500 border border-blue-500/20" :
                                            "bg-argent text-text-muted border border-transparent"
                                }`}
                        >
                            {reason.replace(/_/g, " ")}
                        </span>
                    ))}
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-2 gap-y-3 gap-x-4 py-3 border-y border-argent/50 mb-auto">
                    <div>
                        <div className="text-[10px] text-text-muted font-bold uppercase tracking-widest mb-0.5">Gasto</div>
                        <div className="text-xs font-bold text-text-primary tabular-nums">
                            ${kpis.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] text-text-muted font-bold uppercase tracking-widest mb-0.5">Impressions</div>
                        <div className="text-xs font-bold text-text-primary tabular-nums">
                            {kpis.impressions.toLocaleString()}
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] text-text-muted font-bold uppercase tracking-widest mb-0.5">Frequency</div>
                        <div className="text-xs font-bold text-text-primary tabular-nums">
                            {kpis.frequency?.toFixed(2)}x
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] text-text-muted font-bold uppercase tracking-widest mb-0.5">ROAS</div>
                        <div className={`text-xs font-bold tabular-nums ${kpis.roas >= 2 ? "text-emerald-500" : "text-text-primary"}`}>
                            {kpis.roas.toFixed(2)}x
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] text-text-muted font-bold uppercase tracking-widest mb-0.5">Conv</div>
                        <div className="text-xs font-bold text-text-primary tabular-nums">
                            {kpis.primaryConversions.toFixed(0)}
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] text-text-muted font-bold uppercase tracking-widest mb-0.5">CPA</div>
                        <div className="text-xs font-bold text-text-primary tabular-nums">
                            ${kpis.cpa.toFixed(1)}
                        </div>
                    </div>
                </div>

                {/* Action Button */}
                <Link
                    href={`/creative/${creative.adId}?range=${range}`}
                    className="w-full mt-4 py-2 border border-argent text-[11px] font-bold uppercase tracking-widest text-text-secondary hover:bg-classic hover:text-special hover:border-classic transition-all duration-200 text-center block"
                >
                    Ver Detalle
                </Link>
            </div>
        </div>
    );
}
