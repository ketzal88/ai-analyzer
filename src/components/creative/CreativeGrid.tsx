"use client";

import React from "react";
import { SelectedCreative } from "@/types/creative-kpi";
import CreativeCard from "./CreativeCard";

interface CreativeGridProps {
    creatives: SelectedCreative[];
    isLoading: boolean;
    range: string;
}

export default function CreativeGrid({ creatives, isLoading, range }: CreativeGridProps) {
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-pulse">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-special border border-argent rounded-xl overflow-hidden h-96 flex flex-col">
                        <div className="aspect-video bg-stellar/50" />
                        <div className="p-4 space-y-3">
                            <div className="h-4 bg-stellar/50 rounded w-3/4" />
                            <div className="h-3 bg-stellar/50 rounded w-1/2" />
                            <div className="h-20 bg-stellar/30 rounded" />
                            <div className="h-8 bg-stellar/50 rounded" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (creatives.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-argent rounded-xl bg-special/30 text-center">
                <div className="w-16 h-16 bg-stellar rounded-full flex items-center justify-center mb-4 text-2xl">
                    🔍
                </div>
                <h3 className="text-subheader font-bold text-text-primary mb-2 uppercase tracking-widest">
                    Sin Resultados
                </h3>
                <p className="text-body text-text-secondary max-w-sm mx-auto">
                    No encontramos creativos que coincidan con los filtros aplicados en este periodo.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {creatives.map((creative) => (
                <CreativeCard key={creative.adId} creative={creative} range={range} />
            ))}
        </div>
    );
}
