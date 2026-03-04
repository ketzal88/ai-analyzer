"use client";

import React, { useEffect, useState } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { useClient } from "@/contexts/ClientContext";
import { ChannelDailySnapshot } from "@/types/channel-snapshots";

function formatCurrency(value: number | undefined, prefix = "$"): string {
    if (value === undefined || value === null) return "—";
    return `${prefix}${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatNumber(value: number | undefined, decimals = 1): string {
    if (value === undefined || value === null) return "—";
    return value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

function formatPct(value: number | undefined): string {
    if (value === undefined || value === null) return "—";
    return `${value.toFixed(2)}%`;
}

interface KPICardProps {
    label: string;
    value: string;
    subtitle?: string;
}

function KPICard({ label, value, subtitle }: KPICardProps) {
    return (
        <div className="card p-5 hover:border-classic/30 transition-all">
            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">{label}</p>
            <p className="text-2xl font-black text-text-primary mt-2 font-mono">{value}</p>
            {subtitle && <p className="text-[10px] text-text-muted mt-1">{subtitle}</p>}
        </div>
    );
}

export default function GoogleAdsChannel() {
    const { selectedClientId: clientId } = useClient();
    const [snapshots, setSnapshots] = useState<ChannelDailySnapshot[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!clientId) return;
        setIsLoading(true);
        setError(null);

        fetch(`/api/channel-snapshots?clientId=${clientId}&channel=GOOGLE&days=30`)
            .then(res => res.json())
            .then(data => {
                setSnapshots(data.snapshots || []);
            })
            .catch(err => setError(err.message))
            .finally(() => setIsLoading(false));
    }, [clientId]);

    // Compute aggregated KPIs from last 7 days
    const last7 = snapshots.slice(0, 7);
    const totals = last7.reduce(
        (acc, s) => ({
            spend: acc.spend + (s.metrics.spend || 0),
            revenue: acc.revenue + (s.metrics.revenue || 0),
            conversions: acc.conversions + (s.metrics.conversions || 0),
            impressions: acc.impressions + (s.metrics.impressions || 0),
            clicks: acc.clicks + (s.metrics.clicks || 0),
        }),
        { spend: 0, revenue: 0, conversions: 0, impressions: 0, clicks: 0 }
    );
    const roas7d = totals.spend > 0 ? totals.revenue / totals.spend : 0;
    const cpa7d = totals.conversions > 0 ? totals.spend / totals.conversions : 0;
    const ctr7d = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;

    // Campaign breakdown from most recent snapshot
    const latestCampaigns = (snapshots[0]?.rawData?.campaigns as any[]) || [];

    return (
        <AppLayout>
            <div className="space-y-8 pb-20">
                {/* Header */}
                <header>
                    <h1 className="text-3xl font-black text-text-primary uppercase tracking-tighter">
                        Google Ads
                    </h1>
                    <p className="text-small text-text-muted font-bold uppercase tracking-widest mt-1">
                        Canal de Publicidad • Últimos 7 días
                    </p>
                </header>

                {/* Loading / Error States */}
                {isLoading && (
                    <div className="card p-12 flex items-center justify-center">
                        <div className="animate-spin w-6 h-6 border-2 border-classic border-t-transparent" />
                        <span className="ml-3 text-text-muted text-small">Cargando datos de Google Ads...</span>
                    </div>
                )}

                {error && (
                    <div className="card p-6 border-red-500/30">
                        <p className="text-red-400 text-small">{error}</p>
                    </div>
                )}

                {!isLoading && !error && snapshots.length === 0 && (
                    <div className="card p-12 border-dashed flex flex-col items-center gap-3">
                        <p className="text-text-muted text-small">No hay datos de Google Ads para este cliente.</p>
                        <p className="text-[10px] text-text-muted">Verificá que la integración esté activa y el cron haya corrido.</p>
                    </div>
                )}

                {!isLoading && !error && snapshots.length > 0 && (
                    <>
                        {/* KPI Grid */}
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                            <KPICard label="Inversión" value={formatCurrency(totals.spend)} subtitle="Últimos 7d" />
                            <KPICard label="Conversiones" value={formatNumber(totals.conversions, 0)} subtitle="Últimos 7d" />
                            <KPICard label="ROAS" value={`${roas7d.toFixed(2)}x`} subtitle="Revenue / Spend" />
                            <KPICard label="CPA" value={formatCurrency(cpa7d)} subtitle="Costo por conversión" />
                            <KPICard label="CTR" value={formatPct(ctr7d)} subtitle="Click-through rate" />
                        </div>

                        {/* Daily Trend */}
                        <div className="card p-6">
                            <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                Tendencia Diaria (últimos 30d)
                            </h2>
                            <div className="grid grid-cols-1 gap-2">
                                {snapshots.map((s) => {
                                    const maxSpend = Math.max(...snapshots.map(x => x.metrics.spend || 0), 1);
                                    const barWidth = ((s.metrics.spend || 0) / maxSpend) * 100;
                                    return (
                                        <div key={s.date} className="flex items-center gap-3 text-[11px]">
                                            <span className="text-text-muted font-mono w-20 shrink-0">{s.date}</span>
                                            <div className="flex-1 h-4 bg-argent/20 relative">
                                                <div
                                                    className="h-full bg-classic/60"
                                                    style={{ width: `${barWidth}%` }}
                                                />
                                            </div>
                                            <span className="text-text-secondary font-mono w-16 text-right">
                                                {formatCurrency(s.metrics.spend)}
                                            </span>
                                            <span className="text-text-muted font-mono w-12 text-right">
                                                {s.metrics.conversions?.toFixed(0) || "0"} conv
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Campaign Breakdown */}
                        {latestCampaigns.length > 0 && (
                            <div className="card p-6">
                                <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                    Campañas (día más reciente)
                                </h2>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-argent/50">
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest">Campaña</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Inversión</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Conv.</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">ROAS</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {latestCampaigns.map((c: any, i: number) => (
                                                <tr key={i} className="border-b border-argent/10 hover:bg-classic/[0.03]">
                                                    <td className="p-3 text-[11px] text-text-primary font-medium max-w-[300px] truncate">{c.name}</td>
                                                    <td className="p-3 text-[11px] text-text-secondary font-mono text-right">{formatCurrency(c.spend)}</td>
                                                    <td className="p-3 text-[11px] text-text-secondary font-mono text-right">{formatNumber(c.conversions, 0)}</td>
                                                    <td className="p-3 text-[11px] text-text-secondary font-mono text-right">{c.roas?.toFixed(2) || "—"}x</td>
                                                    <td className="p-3 text-[11px] text-right">
                                                        <span className={`px-2 py-0.5 text-[9px] font-bold uppercase ${c.status === "ENABLED" ? "text-synced bg-synced/10" : "text-text-muted bg-argent/20"}`}>
                                                            {c.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </AppLayout>
    );
}
