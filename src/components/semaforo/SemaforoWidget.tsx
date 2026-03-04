"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useClient } from "@/contexts/ClientContext";
import { SemaforoSnapshot, SemaforoStatus } from "@/types/semaforo";

function getStatusColor(status: SemaforoStatus): string {
    switch (status) {
        case 'green': return 'text-emerald-500';
        case 'yellow': return 'text-yellow-500';
        case 'red': return 'text-red-500';
    }
}

function getStatusBg(status: SemaforoStatus): string {
    switch (status) {
        case 'green': return 'bg-emerald-500';
        case 'yellow': return 'bg-yellow-500';
        case 'red': return 'bg-red-500';
    }
}

function getStatusLabel(status: SemaforoStatus): string {
    switch (status) {
        case 'green': return 'EN RITMO';
        case 'yellow': return 'ATENCIÓN';
        case 'red': return 'EN RIESGO';
    }
}

/**
 * Compact semáforo widget for embedding in sidebar, dashboard, etc.
 * Shows: general traffic light + score + worst metric + days remaining.
 * Clicks through to /semaforo.
 */
export default function SemaforoWidget() {
    const { selectedClientId: clientId } = useClient();
    const [snapshot, setSnapshot] = useState<SemaforoSnapshot | null>(null);

    useEffect(() => {
        if (!clientId) return;

        fetch(`/api/semaforo?clientId=${clientId}`)
            .then(res => res.json())
            .then(data => setSnapshot(data.snapshot || null))
            .catch(() => setSnapshot(null));
    }, [clientId]);

    if (!snapshot) return null;

    // Find the worst metric
    const metricValues = Object.values(snapshot.metrics);
    const worstMetric = metricValues.length > 0
        ? metricValues.reduce((worst, m) => m.pacingRatio < worst.pacingRatio ? m : worst)
        : null;

    const daysRemaining = snapshot.quarterProgress.daysTotal - snapshot.quarterProgress.daysElapsed;

    return (
        <Link href="/semaforo" className="block">
            <div className="card p-3 hover:border-classic/30 transition-all cursor-pointer">
                <div className="flex items-center gap-3">
                    {/* Mini traffic light */}
                    <div className="flex flex-col gap-0.5">
                        <div className={`w-2 h-2 ${snapshot.general.status === 'red' ? 'bg-red-500' : 'bg-argent/30'}`} />
                        <div className={`w-2 h-2 ${snapshot.general.status === 'yellow' ? 'bg-yellow-500' : 'bg-argent/30'}`} />
                        <div className={`w-2 h-2 ${snapshot.general.status === 'green' ? 'bg-emerald-500' : 'bg-argent/30'}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black uppercase ${getStatusColor(snapshot.general.status)}`}>
                                {getStatusLabel(snapshot.general.status)}
                            </span>
                            <span className="text-[9px] text-text-muted font-mono">
                                {snapshot.quarterRef.replace('_', ' ')}
                            </span>
                        </div>
                        {worstMetric && worstMetric.status !== 'green' && (
                            <p className="text-[9px] text-text-muted truncate mt-0.5">
                                {worstMetric.metric}: {worstMetric.pctAchieved.toFixed(0)}% (need {worstMetric.pctExpected.toFixed(0)}%)
                            </p>
                        )}
                    </div>

                    <div className="text-right shrink-0">
                        <p className={`text-lg font-black font-mono leading-none ${getStatusColor(snapshot.general.status)}`}>
                            {snapshot.general.score}
                        </p>
                        <p className="text-[8px] text-text-muted">{daysRemaining}d left</p>
                    </div>
                </div>
            </div>
        </Link>
    );
}
