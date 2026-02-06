"use client";

import React from "react";
import { SelectionReason } from "@/types/creative-kpi";

interface CreativeFiltersProps {
    range: string;
    onRangeChange: (range: string) => void;
    viewMode: "cards" | "table";
    onViewModeChange: (mode: "cards" | "table") => void;
    search: string;
    onSearchChange: (search: string) => void;
    format: string;
    onFormatChange: (format: string) => void;
    reason: string;
    onReasonChange: (reason: string) => void;
}

export default function CreativeFilters({
    range,
    onRangeChange,
    viewMode,
    onViewModeChange,
    search,
    onSearchChange,
    format,
    onFormatChange,
    reason,
    onReasonChange
}: CreativeFiltersProps) {
    return (
        <div className="bg-special border border-argent rounded-xl p-4 mb-8">
            <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between">

                {/* Left: Search & Simple Filters */}
                <div className="flex flex-wrap gap-3 flex-1">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </span>
                        <input
                            type="text"
                            placeholder="Buscar por anuncio o campaña..."
                            className="w-full bg-stellar border border-argent rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-classic transition-colors"
                            value={search}
                            onChange={(e) => onSearchChange(e.target.value)}
                        />
                    </div>

                    {/* Format Filter */}
                    <select
                        className="bg-stellar border border-argent rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-classic font-bold"
                        value={format}
                        onChange={(e) => onFormatChange(e.target.value)}
                    >
                        <option value="">Todos los Formatos</option>
                        <option value="VIDEO">Video</option>
                        <option value="IMAGE">Imagen</option>
                        <option value="CAROUSEL">Carousel</option>
                        <option value="CATALOG">Catálogo</option>
                    </select>

                    {/* Reason Filter */}
                    <select
                        className="bg-stellar border border-argent rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-classic font-bold uppercase text-[10px] tracking-wider"
                        value={reason}
                        onChange={(e) => onReasonChange(e.target.value)}
                    >
                        <option value="">Cualquier Señal</option>
                        <option value="TOP_SPEND">Top Spend</option>
                        <option value="HIGH_FATIGUE_RISK">Riesgo Fatiga</option>
                        <option value="UNDERFUNDED_WINNER">Oportunidad Gema</option>
                        <option value="NEW_CREATIVE">Lanzamiento Reciente</option>
                    </select>
                </div>

                {/* Right: Mode & Range */}
                <div className="flex items-center gap-4 border-t lg:border-t-0 border-argent pt-4 lg:pt-0">

                    {/* View Mode Switcher */}
                    <div className="flex bg-stellar border border-argent rounded-lg p-1">
                        <button
                            onClick={() => onViewModeChange("cards")}
                            className={`px-3 py-1.5 rounded-md transition-all duration-200 ${viewMode === "cards" ? "bg-special text-text-primary shadow-sm" : "text-text-muted hover:text-text-secondary"
                                }`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                        </button>
                        <button
                            onClick={() => onViewModeChange("table")}
                            disabled
                            className={`px-3 py-1.5 rounded-md transition-all duration-200 cursor-not-allowed ${viewMode === "table" ? "bg-special text-text-primary shadow-sm" : "text-text-muted opacity-50"
                                }`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                            </svg>
                        </button>
                    </div>

                    {/* Range Selector */}
                    <div className="flex bg-stellar border border-argent rounded-lg p-1">
                        {["last_7d", "last_14d", "last_30d"].map((r) => (
                            <button
                                key={r}
                                onClick={() => onRangeChange(r)}
                                className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${range === r ? "bg-classic text-white shadow-md shadow-classic/20" : "text-text-muted hover:text-text-secondary"
                                    }`}
                            >
                                {r.replace("last_", "").toUpperCase()}
                            </button>
                        ))}
                    </div>

                </div>

            </div>
        </div>
    );
}
