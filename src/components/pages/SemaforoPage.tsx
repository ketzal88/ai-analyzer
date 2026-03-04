"use client";

import React, { useEffect, useState } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { useClient } from "@/contexts/ClientContext";
import { SemaforoSnapshot, MetricSemaforo, SemaforoStatus } from "@/types/semaforo";

// ── Helpers ──────────────────────────────────────────
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

function getStatusBgLight(status: SemaforoStatus): string {
    switch (status) {
        case 'green': return 'bg-emerald-500/10 border-emerald-500/20';
        case 'yellow': return 'bg-yellow-500/10 border-yellow-500/20';
        case 'red': return 'bg-red-500/10 border-red-500/20';
    }
}

function getStatusLabel(status: SemaforoStatus): string {
    switch (status) {
        case 'green': return 'EN RITMO';
        case 'yellow': return 'ATENCIÓN';
        case 'red': return 'EN RIESGO';
    }
}

function getTrendIcon(trend: string): string {
    switch (trend) {
        case 'accelerating': return '↗';
        case 'decelerating': return '↘';
        default: return '→';
    }
}

function formatNumber(value: number, decimals = 0): string {
    return value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

// ── Traffic Light Component ──────────────────────────
function TrafficLight({ status, size = 'lg' }: { status: SemaforoStatus; size?: 'sm' | 'lg' }) {
    const dotSize = size === 'lg' ? 'w-6 h-6' : 'w-3 h-3';
    return (
        <div className="flex flex-col gap-1.5 items-center">
            <div className={`${dotSize} ${status === 'red' ? 'bg-red-500 shadow-lg shadow-red-500/50' : 'bg-argent/30'}`} />
            <div className={`${dotSize} ${status === 'yellow' ? 'bg-yellow-500 shadow-lg shadow-yellow-500/50' : 'bg-argent/30'}`} />
            <div className={`${dotSize} ${status === 'green' ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50' : 'bg-argent/30'}`} />
        </div>
    );
}

// ── Metric Card Component ────────────────────────────
function MetricCard({ metric }: { metric: MetricSemaforo }) {
    const progressPct = Math.min(metric.pctAchieved, 100);

    return (
        <div className={`card p-5 border ${getStatusBgLight(metric.status)}`}>
            {/* Header */}
            <div className="flex justify-between items-start mb-3">
                <div>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">{metric.metric}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <div className={`w-2 h-2 ${getStatusBg(metric.status)}`} />
                        <span className={`text-[9px] font-black uppercase ${getStatusColor(metric.status)}`}>
                            {getStatusLabel(metric.status)}
                        </span>
                    </div>
                </div>
                <span className="text-[11px] text-text-muted font-mono">
                    {getTrendIcon(metric.trend)} {metric.trend}
                </span>
            </div>

            {/* Progress */}
            <div className="mb-3">
                <div className="flex justify-between text-[10px] text-text-muted mb-1">
                    <span>{formatNumber(metric.current)} / {formatNumber(metric.target)}</span>
                    <span>{metric.pctAchieved.toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-argent/30 w-full">
                    <div
                        className={`h-full ${getStatusBg(metric.status)} transition-all`}
                        style={{ width: `${progressPct}%` }}
                    />
                </div>
                {/* Expected marker */}
                <div className="relative h-0">
                    <div
                        className="absolute -top-2 w-0.5 h-2 bg-text-muted"
                        style={{ left: `${Math.min(metric.pctExpected, 100)}%` }}
                    />
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mt-4">
                <div>
                    <p className="text-[9px] text-text-muted uppercase">Ritmo semanal</p>
                    <p className="text-[13px] font-black text-text-primary font-mono">
                        {formatNumber(metric.weeklyRate, 1)}/sem
                    </p>
                </div>
                <div>
                    <p className="text-[9px] text-text-muted uppercase">Necesario</p>
                    <p className={`text-[13px] font-black font-mono ${metric.requiredWeeklyRate > metric.weeklyRate ? 'text-red-400' : 'text-synced'}`}>
                        {formatNumber(metric.requiredWeeklyRate, 1)}/sem
                    </p>
                </div>
                <div className="col-span-2">
                    <p className="text-[9px] text-text-muted uppercase">Proyección al cierre</p>
                    <p className={`text-[13px] font-black font-mono ${metric.projectedEnd >= metric.target ? 'text-synced' : 'text-red-400'}`}>
                        {formatNumber(metric.projectedEnd, 0)}
                        <span className="text-[9px] text-text-muted ml-1">
                            (target: {formatNumber(metric.target)})
                        </span>
                    </p>
                </div>
            </div>
        </div>
    );
}

// ── Main Page ────────────────────────────────────────
export default function SemaforoPage() {
    const { selectedClientId: clientId } = useClient();
    const [snapshot, setSnapshot] = useState<SemaforoSnapshot | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!clientId) return;
        setIsLoading(true);
        setError(null);

        fetch(`/api/semaforo?clientId=${clientId}`)
            .then(res => {
                if (!res.ok) throw new Error("No semáforo data");
                return res.json();
            })
            .then(data => setSnapshot(data.snapshot || null))
            .catch(err => setError(err.message))
            .finally(() => setIsLoading(false));
    }, [clientId]);

    return (
        <AppLayout>
            <div className="space-y-8 pb-20">
                <header>
                    <h1 className="text-3xl font-black text-text-primary uppercase tracking-tighter">
                        Semáforo
                    </h1>
                    <p className="text-small text-text-muted font-bold uppercase tracking-widest mt-1">
                        Pacing de Objetivos Trimestrales
                    </p>
                </header>

                {isLoading && (
                    <div className="card p-12 flex items-center justify-center">
                        <div className="animate-spin w-6 h-6 border-2 border-classic border-t-transparent" />
                        <span className="ml-3 text-text-muted text-small">Cargando semáforo...</span>
                    </div>
                )}

                {error && (
                    <div className="card p-12 border-dashed flex flex-col items-center gap-3">
                        <p className="text-text-muted text-small">No hay objetivos trimestrales configurados para este cliente.</p>
                        <p className="text-[10px] text-text-muted">Configurá los objetivos en Administración para activar el semáforo.</p>
                    </div>
                )}

                {!isLoading && !error && snapshot && (
                    <>
                        {/* Quarter Header + General Traffic Light */}
                        <div className="card p-6 flex items-center gap-6">
                            <TrafficLight status={snapshot.general.status} size="lg" />
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                    <h2 className="text-xl font-black text-text-primary uppercase">
                                        {snapshot.quarterRef.replace('_', ' ')}
                                    </h2>
                                    <span className={`px-2 py-0.5 text-[9px] font-black uppercase ${getStatusBgLight(snapshot.general.status)} ${getStatusColor(snapshot.general.status)}`}>
                                        {getStatusLabel(snapshot.general.status)}
                                    </span>
                                </div>
                                <p className="text-[11px] text-text-secondary">{snapshot.general.summary}</p>
                                <div className="flex gap-4 mt-2 text-[10px] text-text-muted font-mono">
                                    <span>{snapshot.quarterProgress.daysElapsed} / {snapshot.quarterProgress.daysTotal} días</span>
                                    <span>Semana {snapshot.quarterProgress.currentWeek} / {snapshot.quarterProgress.weeksTotal}</span>
                                    <span>{snapshot.quarterProgress.pctElapsed.toFixed(0)}% transcurrido</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-text-muted uppercase tracking-widest">Score</p>
                                <p className={`text-[48px] font-black font-mono leading-none ${getStatusColor(snapshot.general.status)}`}>
                                    {snapshot.general.score}
                                </p>
                            </div>
                        </div>

                        {/* Metric Cards Grid */}
                        <div>
                            <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                Objetivos por Métrica
                            </h2>
                            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                                {Object.values(snapshot.metrics).map((metric) => (
                                    <MetricCard key={metric.metric} metric={metric} />
                                ))}
                            </div>
                        </div>

                        {/* Channel Grid */}
                        {Object.keys(snapshot.channels).length > 0 && (
                            <div>
                                <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                    Semáforo por Canal
                                </h2>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    {Object.entries(snapshot.channels).map(([channel, channelData]) => (
                                        <div key={channel} className={`card p-4 border ${getStatusBgLight(channelData!.status)}`}>
                                            <div className="flex items-center gap-2 mb-3">
                                                <TrafficLight status={channelData!.status} size="sm" />
                                                <div>
                                                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">{channel}</p>
                                                    <p className={`text-[9px] font-black uppercase ${getStatusColor(channelData!.status)}`}>
                                                        {getStatusLabel(channelData!.status)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                {Object.values(channelData!.metrics).map((m) => (
                                                    <div key={m.metric} className="flex justify-between text-[10px]">
                                                        <span className="text-text-muted">{m.metric}</span>
                                                        <span className={`font-mono ${getStatusColor(m.status)}`}>
                                                            {m.pctAchieved.toFixed(0)}%
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </AppLayout>
    );
}
