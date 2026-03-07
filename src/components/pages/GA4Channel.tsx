"use client";

import React, { useEffect, useState } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { useClient } from "@/contexts/ClientContext";
import { ChannelDailySnapshot } from "@/types/channel-snapshots";
import { UnifiedDateRange, resolvePreset, formatRangeLabel, getComparisonRange } from "@/lib/date-utils";
import DateRangePicker from "@/components/ui/DateRangePicker";
import KPICard, { calcDelta } from "@/components/ui/KPICard";
import { useAnalyst } from "@/contexts/AnalystContext";

function formatNumber(value: number | undefined, decimals = 1): string {
    if (value === undefined || value === null) return "\u2014";
    return value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

function formatPct(value: number | undefined): string {
    if (value === undefined || value === null) return "\u2014";
    return `${value.toFixed(2)}%`;
}

function formatCurrency(value: number | undefined, prefix = "$"): string {
    if (value === undefined || value === null) return "\u2014";
    if (value >= 1_000_000) return `${prefix}${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${prefix}${(value / 1_000).toFixed(1)}K`;
    return `${prefix}${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDuration(seconds: number | undefined): string {
    if (!seconds) return "\u2014";
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDate(dateStr: string): string {
    const [, m, d] = dateStr.split("-");
    const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    return `${parseInt(d)} ${months[parseInt(m) - 1]}`;
}

export default function GA4Channel() {
    const { selectedClientId: clientId } = useClient();
    const { openAnalyst } = useAnalyst();
    const [snapshots, setSnapshots] = useState<ChannelDailySnapshot[]>([]);
    const [prevSnapshots, setPrevSnapshots] = useState<ChannelDailySnapshot[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<UnifiedDateRange>(() => resolvePreset("mtd"));

    useEffect(() => {
        if (!clientId) return;
        setIsLoading(true);
        setError(null);

        const compRange = getComparisonRange(dateRange);
        Promise.all([
            fetch(`/api/channel-snapshots?clientId=${clientId}&channel=GA4&startDate=${dateRange.start}&endDate=${dateRange.end}`).then(r => r.json()),
            fetch(`/api/channel-snapshots?clientId=${clientId}&channel=GA4&startDate=${compRange.start}&endDate=${compRange.end}`).then(r => r.json()),
        ])
            .then(([curr, prev]) => {
                setSnapshots(curr.snapshots || []);
                setPrevSnapshots(prev.snapshots || []);
            })
            .catch(err => setError(err.message))
            .finally(() => setIsLoading(false));
    }, [clientId, dateRange.start, dateRange.end]);

    // Aggregate totals — additive metrics summed, rates weighted by sessions
    const totals = snapshots.reduce(
        (acc, s) => ({
            sessions: acc.sessions + (s.metrics.sessions || 0),
            totalUsers: acc.totalUsers + (s.metrics.totalUsers || 0),
            newUsers: acc.newUsers + (s.metrics.newUsers || 0),
            pageviews: acc.pageviews + (s.metrics.pageviews || 0),
            engagedSessions: acc.engagedSessions + (s.metrics.engagedSessions || 0),
            conversions: acc.conversions + (s.metrics.conversions || 0),
            revenue: acc.revenue + (s.metrics.revenue || 0),
            viewItem: acc.viewItem + (s.metrics.viewItem || 0),
            addToCart: acc.addToCart + (s.metrics.addToCart || 0),
            beginCheckout: acc.beginCheckout + (s.metrics.beginCheckout || 0),
            ecommercePurchases: acc.ecommercePurchases + (s.metrics.ecommercePurchases || 0),
            // Weighted accumulators
            wBounce: acc.wBounce + (s.metrics.bounceRate || 0) * (s.metrics.sessions || 0),
            wDuration: acc.wDuration + (s.metrics.avgSessionDuration || 0) * (s.metrics.sessions || 0),
            wEngagement: acc.wEngagement + (s.metrics.engagementRate || 0) * (s.metrics.sessions || 0),
            wPagesPerSession: acc.wPagesPerSession + (s.metrics.pageviewsPerSession || 0) * (s.metrics.sessions || 0),
        }),
        { sessions: 0, totalUsers: 0, newUsers: 0, pageviews: 0, engagedSessions: 0, conversions: 0, revenue: 0, viewItem: 0, addToCart: 0, beginCheckout: 0, ecommercePurchases: 0, wBounce: 0, wDuration: 0, wEngagement: 0, wPagesPerSession: 0 }
    );
    const bounceRate = totals.sessions > 0 ? totals.wBounce / totals.sessions : 0;
    const avgDuration = totals.sessions > 0 ? totals.wDuration / totals.sessions : 0;
    const engagementRate = totals.sessions > 0 ? totals.wEngagement / totals.sessions : 0;
    const pagesPerSession = totals.sessions > 0 ? totals.wPagesPerSession / totals.sessions : 0;
    const conversionRate = totals.sessions > 0 ? (totals.ecommercePurchases / totals.sessions) * 100 : 0;

    // Previous period
    const prevTotals = prevSnapshots.reduce(
        (acc, s) => ({
            sessions: acc.sessions + (s.metrics.sessions || 0),
            totalUsers: acc.totalUsers + (s.metrics.totalUsers || 0),
            conversions: acc.conversions + (s.metrics.conversions || 0),
            revenue: acc.revenue + (s.metrics.revenue || 0),
            wBounce: acc.wBounce + (s.metrics.bounceRate || 0) * (s.metrics.sessions || 0),
            wDuration: acc.wDuration + (s.metrics.avgSessionDuration || 0) * (s.metrics.sessions || 0),
            wPagesPerSession: acc.wPagesPerSession + (s.metrics.pageviewsPerSession || 0) * (s.metrics.sessions || 0),
            ecommercePurchases: acc.ecommercePurchases + (s.metrics.ecommercePurchases || 0),
        }),
        { sessions: 0, totalUsers: 0, conversions: 0, revenue: 0, wBounce: 0, wDuration: 0, wPagesPerSession: 0, ecommercePurchases: 0 }
    );
    const prevBounce = prevTotals.sessions > 0 ? prevTotals.wBounce / prevTotals.sessions : 0;
    const prevDuration = prevTotals.sessions > 0 ? prevTotals.wDuration / prevTotals.sessions : 0;
    const prevPagesPerSession = prevTotals.sessions > 0 ? prevTotals.wPagesPerSession / prevTotals.sessions : 0;
    const prevConvRate = prevTotals.sessions > 0 ? (prevTotals.ecommercePurchases / prevTotals.sessions) * 100 : 0;

    // Aggregate traffic sources from rawData across all snapshots
    const sourceMap = new Map<string, { sessions: number; conversions: number; revenue: number; wBounce: number }>();
    for (const s of snapshots) {
        const sources = (s.rawData?.trafficSources as any[]) || [];
        for (const src of sources) {
            const key = `${src.source} / ${src.medium}`;
            const existing = sourceMap.get(key);
            if (existing) {
                existing.sessions += src.sessions || 0;
                existing.conversions += src.conversions || 0;
                existing.revenue += src.revenue || 0;
                existing.wBounce += (src.bounceRate || 0) * (src.sessions || 0);
            } else {
                sourceMap.set(key, {
                    sessions: src.sessions || 0,
                    conversions: src.conversions || 0,
                    revenue: src.revenue || 0,
                    wBounce: (src.bounceRate || 0) * (src.sessions || 0),
                });
            }
        }
    }
    const trafficSources = Array.from(sourceMap.entries())
        .map(([name, data]) => ({ name, ...data, bounceRate: data.sessions > 0 ? data.wBounce / data.sessions : 0 }))
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 20);

    // Aggregate landing pages
    const pageMap = new Map<string, { sessions: number; conversions: number; revenue: number; wBounce: number }>();
    for (const s of snapshots) {
        const pages = (s.rawData?.topLandingPages as any[]) || [];
        for (const p of pages) {
            const key = p.pagePath;
            const existing = pageMap.get(key);
            if (existing) {
                existing.sessions += p.sessions || 0;
                existing.conversions += p.conversions || 0;
                existing.revenue += p.revenue || 0;
                existing.wBounce += (p.bounceRate || 0) * (p.sessions || 0);
            } else {
                pageMap.set(key, {
                    sessions: p.sessions || 0,
                    conversions: p.conversions || 0,
                    revenue: p.revenue || 0,
                    wBounce: (p.bounceRate || 0) * (p.sessions || 0),
                });
            }
        }
    }
    const landingPages = Array.from(pageMap.entries())
        .map(([path, data]) => ({ path, ...data, bounceRate: data.sessions > 0 ? data.wBounce / data.sessions : 0 }))
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 15);

    // Aggregate device breakdown
    const deviceMap = new Map<string, { sessions: number; conversions: number; wBounce: number; wDuration: number }>();
    for (const s of snapshots) {
        const devices = (s.rawData?.deviceBreakdown as any[]) || [];
        for (const d of devices) {
            const key = d.category;
            const existing = deviceMap.get(key);
            if (existing) {
                existing.sessions += d.sessions || 0;
                existing.conversions += d.conversions || 0;
                existing.wBounce += (d.bounceRate || 0) * (d.sessions || 0);
                existing.wDuration += (d.avgDuration || 0) * (d.sessions || 0);
            } else {
                deviceMap.set(key, {
                    sessions: d.sessions || 0,
                    conversions: d.conversions || 0,
                    wBounce: (d.bounceRate || 0) * (d.sessions || 0),
                    wDuration: (d.avgDuration || 0) * (d.sessions || 0),
                });
            }
        }
    }
    const devices = Array.from(deviceMap.entries())
        .map(([category, data]) => ({
            category,
            ...data,
            bounceRate: data.sessions > 0 ? data.wBounce / data.sessions : 0,
            avgDuration: data.sessions > 0 ? data.wDuration / data.sessions : 0,
        }))
        .sort((a, b) => b.sessions - a.sessions);

    const deviceLabels: Record<string, string> = { desktop: "Desktop", mobile: "Mobile", tablet: "Tablet" };
    const maxDeviceSessions = Math.max(...devices.map(d => d.sessions), 1);

    return (
        <AppLayout>
            <div className="space-y-8 pb-20">
                <header className="flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-text-primary uppercase tracking-tighter">
                            Google Analytics 4
                        </h1>
                        <p className="text-small text-text-muted font-bold uppercase tracking-widest mt-1">
                            Web Analytics &bull; {formatRangeLabel(dateRange)}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <DateRangePicker value={dateRange} onChange={setDateRange} />
                        <button onClick={() => openAnalyst('ga4')} className="px-3 py-2 bg-classic text-stellar font-black text-[10px] uppercase tracking-widest hover:bg-classic/90 transition-all whitespace-nowrap">Analizar con IA</button>
                    </div>
                </header>

                {isLoading && (
                    <div className="card p-12 flex items-center justify-center">
                        <div className="animate-spin w-6 h-6 border-2 border-classic border-t-transparent" />
                        <span className="ml-3 text-text-muted text-small">Cargando datos de GA4...</span>
                    </div>
                )}

                {error && (
                    <div className="card p-6 border-red-500/30">
                        <p className="text-red-400 text-small">{error}</p>
                    </div>
                )}

                {!isLoading && !error && snapshots.length === 0 && (
                    <div className="card p-12 border-dashed flex flex-col items-center gap-3">
                        <p className="text-text-muted text-small">No hay datos de GA4 para este per\u00edodo.</p>
                        <p className="text-[10px] text-text-muted">Verific\u00e1 que la integraci\u00f3n est\u00e9 activa y el cron haya corrido.</p>
                    </div>
                )}

                {!isLoading && !error && snapshots.length > 0 && (
                    <>
                        {/* KPI Row 1 — Traffic */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <KPICard
                                label="Sessions"
                                value={formatNumber(totals.sessions, 0)}
                                subtitle={`${formatNumber(totals.totalUsers, 0)} usuarios`}
                                delta={calcDelta(totals.sessions, prevTotals.sessions)}
                            />
                            <KPICard
                                label="Nuevos Usuarios"
                                value={formatNumber(totals.newUsers, 0)}
                                subtitle={totals.totalUsers > 0 ? `${((totals.newUsers / totals.totalUsers) * 100).toFixed(1)}% del total` : ""}
                                delta={calcDelta(totals.newUsers, prevTotals.totalUsers > 0 ? prevTotals.totalUsers - (prevTotals.totalUsers - totals.newUsers) : 0)}
                            />
                            <KPICard
                                label="Tasa de Rebote"
                                value={formatPct(bounceRate)}
                                subtitle={`Engagement: ${engagementRate.toFixed(1)}%`}
                                color={bounceRate < 40 ? "text-synced" : bounceRate < 60 ? "text-classic" : "text-red-400"}
                                delta={calcDelta(bounceRate, prevBounce)}
                                deltaInverse
                            />
                            <KPICard
                                label="Duraci\u00f3n Promedio"
                                value={formatDuration(avgDuration)}
                                subtitle={`${pagesPerSession.toFixed(1)} p\u00e1gs/sesi\u00f3n`}
                                delta={calcDelta(avgDuration, prevDuration)}
                            />
                        </div>

                        {/* KPI Row 2 — Conversions */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <KPICard
                                label="Compras"
                                value={formatNumber(totals.ecommercePurchases, 0)}
                                subtitle={`${formatNumber(totals.conversions, 0)} conversiones totales`}
                                color="text-synced"
                                delta={calcDelta(totals.ecommercePurchases, prevTotals.ecommercePurchases)}
                            />
                            <KPICard
                                label="Revenue (GA4)"
                                value={formatCurrency(totals.revenue)}
                                color="text-synced"
                                delta={calcDelta(totals.revenue, prevTotals.revenue)}
                            />
                            <KPICard
                                label="Tasa de Conversi\u00f3n"
                                value={formatPct(conversionRate)}
                                color={conversionRate >= 3 ? "text-synced" : conversionRate >= 1.5 ? "text-classic" : "text-red-400"}
                                delta={calcDelta(conversionRate, prevConvRate)}
                            />
                            <KPICard
                                label="P\u00e1gs / Sesi\u00f3n"
                                value={pagesPerSession.toFixed(2)}
                                delta={calcDelta(pagesPerSession, prevPagesPerSession)}
                            />
                        </div>

                        {/* Ecommerce Funnel */}
                        {totals.viewItem > 0 && (
                            <div className="card p-6">
                                <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                    Embudo de Conversi\u00f3n Ecommerce
                                </h2>
                                <div className="grid grid-cols-4 gap-4">
                                    {[
                                        { label: "View Item", value: totals.viewItem, color: "bg-classic/70" },
                                        { label: "Add to Cart", value: totals.addToCart, color: "bg-classic/50" },
                                        { label: "Checkout", value: totals.beginCheckout, color: "bg-classic/40" },
                                        { label: "Compra", value: totals.ecommercePurchases, color: "bg-synced/70" },
                                    ].map((step, i, arr) => {
                                        const barHeight = totals.viewItem > 0 ? (step.value / totals.viewItem) * 100 : 0;
                                        const dropOff = i > 0 && arr[i - 1].value > 0
                                            ? ((1 - step.value / arr[i - 1].value) * 100).toFixed(0)
                                            : null;
                                        return (
                                            <div key={step.label} className="text-center">
                                                <div className="h-32 flex items-end justify-center mb-2">
                                                    <div className={`w-full max-w-[60px] ${step.color} rounded-t`} style={{ height: `${Math.max(barHeight, 4)}%` }} />
                                                </div>
                                                <p className="text-lg font-black font-mono text-text-primary">{formatNumber(step.value, 0)}</p>
                                                <p className="text-[9px] text-text-muted uppercase font-bold">{step.label}</p>
                                                {dropOff && (
                                                    <p className="text-[9px] text-red-400 mt-1">-{dropOff}% drop</p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Traffic Sources Table */}
                        {trafficSources.length > 0 && (
                            <div className="card p-6">
                                <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                    Fuentes de Tr\u00e1fico ({trafficSources.length})
                                </h2>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-argent/50">
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest">Source / Medium</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Sessions</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">% Total</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Bounce</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Conv.</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Revenue</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {trafficSources.map((src, i) => (
                                                <tr key={i} className="border-b border-argent/10 hover:bg-classic/[0.03]">
                                                    <td className="p-3 text-[11px] text-text-primary font-medium max-w-[300px] truncate">{src.name}</td>
                                                    <td className="p-3 text-[11px] text-text-secondary font-mono text-right">{formatNumber(src.sessions, 0)}</td>
                                                    <td className="p-3 text-[11px] text-text-muted font-mono text-right">
                                                        {totals.sessions > 0 ? `${((src.sessions / totals.sessions) * 100).toFixed(1)}%` : "\u2014"}
                                                    </td>
                                                    <td className="p-3 text-[11px] font-mono text-right">
                                                        <span className={src.bounceRate < 40 ? "text-synced" : src.bounceRate < 60 ? "text-text-secondary" : "text-red-400"}>
                                                            {formatPct(src.bounceRate)}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-[11px] font-mono text-right">
                                                        <span className={src.conversions > 0 ? "text-synced" : "text-text-muted"}>
                                                            {src.conversions > 0 ? formatNumber(src.conversions, 0) : "\u2014"}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-[11px] text-synced font-mono text-right">
                                                        {src.revenue > 0 ? formatCurrency(src.revenue) : "\u2014"}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Landing Pages Table */}
                        {landingPages.length > 0 && (
                            <div className="card p-6">
                                <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                    Top Landing Pages ({landingPages.length})
                                </h2>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-argent/50">
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest">P\u00e1gina</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Sessions</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Bounce</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Conv.</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Revenue</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {landingPages.map((p, i) => (
                                                <tr key={i} className="border-b border-argent/10 hover:bg-classic/[0.03]">
                                                    <td className="p-3 text-[11px] text-text-primary font-mono max-w-[350px] truncate">{p.path}</td>
                                                    <td className="p-3 text-[11px] text-text-secondary font-mono text-right">{formatNumber(p.sessions, 0)}</td>
                                                    <td className="p-3 text-[11px] font-mono text-right">
                                                        <span className={p.bounceRate < 40 ? "text-synced" : p.bounceRate < 60 ? "text-text-secondary" : "text-red-400"}>
                                                            {formatPct(p.bounceRate)}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-[11px] font-mono text-right">
                                                        <span className={p.conversions > 0 ? "text-synced" : "text-text-muted"}>
                                                            {p.conversions > 0 ? formatNumber(p.conversions, 0) : "\u2014"}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-[11px] text-synced font-mono text-right">
                                                        {p.revenue > 0 ? formatCurrency(p.revenue) : "\u2014"}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Device Breakdown */}
                        {devices.length > 0 && (
                            <div className="card p-6">
                                <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                    Dispositivos
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {devices.map((d) => (
                                        <div key={d.category} className="border border-argent/30 rounded-lg p-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-body font-bold text-text-primary">{deviceLabels[d.category] || d.category}</span>
                                                <span className="text-[10px] text-text-muted">
                                                    {totals.sessions > 0 ? `${((d.sessions / totals.sessions) * 100).toFixed(1)}%` : ""}
                                                </span>
                                            </div>
                                            <div className="h-2 bg-argent/20 rounded overflow-hidden">
                                                <div className="h-full bg-classic/60 rounded" style={{ width: `${(d.sessions / maxDeviceSessions) * 100}%` }} />
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 text-center">
                                                <div>
                                                    <p className="text-sm font-black font-mono text-text-primary">{formatNumber(d.sessions, 0)}</p>
                                                    <p className="text-[9px] text-text-muted">Sessions</p>
                                                </div>
                                                <div>
                                                    <p className={`text-sm font-black font-mono ${d.bounceRate < 40 ? "text-synced" : d.bounceRate < 60 ? "text-text-primary" : "text-red-400"}`}>
                                                        {d.bounceRate.toFixed(1)}%
                                                    </p>
                                                    <p className="text-[9px] text-text-muted">Bounce</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black font-mono text-synced">{formatNumber(d.conversions, 0)}</p>
                                                    <p className="text-[9px] text-text-muted">Conv.</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Daily Trend */}
                        <div className="card p-6">
                            <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                Sessions por D\u00eda
                            </h2>
                            <div className="grid grid-cols-1 gap-2">
                                {snapshots.map((s) => {
                                    const maxSessions = Math.max(...snapshots.map(x => x.metrics.sessions || 0), 1);
                                    const barWidth = ((s.metrics.sessions || 0) / maxSessions) * 100;
                                    return (
                                        <div key={s.date} className="flex items-center gap-3 text-[11px]">
                                            <span className="text-text-muted font-mono w-16 shrink-0">{formatDate(s.date)}</span>
                                            <div className="flex-1 h-4 bg-argent/20 relative">
                                                <div className="h-full bg-classic/60" style={{ width: `${barWidth}%` }} />
                                            </div>
                                            <span className="text-text-secondary font-mono w-16 text-right">
                                                {formatNumber(s.metrics.sessions, 0)}
                                            </span>
                                            <span className="text-text-muted font-mono w-16 text-right">
                                                {formatPct(s.metrics.bounceRate)}
                                            </span>
                                            <span className={`font-mono w-12 text-right ${(s.metrics.conversions || 0) > 0 ? "text-synced" : "text-text-muted"}`}>
                                                {(s.metrics.conversions || 0) > 0 ? `${s.metrics.conversions} conv` : ""}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </AppLayout>
    );
}
