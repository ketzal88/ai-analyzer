"use client";

import React, { useEffect, useState } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { useClient } from "@/contexts/ClientContext";
import { ChannelDailySnapshot } from "@/types/channel-snapshots";
import { UnifiedDateRange, resolvePreset, formatRangeLabel, getComparisonRange } from "@/lib/date-utils";
import DateRangePicker from "@/components/ui/DateRangePicker";
import KPICard, { calcDelta } from "@/components/ui/KPICard";
import { useAnalyst } from "@/contexts/AnalystContext";

function formatCurrency(value: number | undefined, prefix = "$"): string {
    if (value === undefined || value === null) return "—";
    if (value >= 1_000_000) return `${prefix}${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${prefix}${(value / 1_000).toFixed(1)}K`;
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

function formatDate(dateStr: string): string {
    const [y, m, d] = dateStr.split("-");
    const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    return `${parseInt(d)} ${months[parseInt(m) - 1]}`;
}


export default function GoogleAdsChannel() {
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
            fetch(`/api/channel-snapshots?clientId=${clientId}&channel=GOOGLE&startDate=${dateRange.start}&endDate=${dateRange.end}`).then(r => r.json()),
            fetch(`/api/channel-snapshots?clientId=${clientId}&channel=GOOGLE&startDate=${compRange.start}&endDate=${compRange.end}`).then(r => r.json()),
        ])
            .then(([curr, prev]) => {
                setSnapshots(curr.snapshots || []);
                setPrevSnapshots(prev.snapshots || []);
            })
            .catch(err => setError(err.message))
            .finally(() => setIsLoading(false));
    }, [clientId, dateRange.start, dateRange.end]);

    // Aggregate totals from ALL snapshots in period
    const totals = snapshots.reduce(
        (acc, s) => ({
            spend: acc.spend + (s.metrics.spend || 0),
            revenue: acc.revenue + (s.metrics.revenue || 0),
            conversions: acc.conversions + (s.metrics.conversions || 0),
            impressions: acc.impressions + (s.metrics.impressions || 0),
            clicks: acc.clicks + (s.metrics.clicks || 0),
            allConversions: acc.allConversions + ((s.metrics as any).allConversions || 0),
            allConversionsValue: acc.allConversionsValue + ((s.metrics as any).allConversionsValue || 0),
            viewThroughConversions: acc.viewThroughConversions + ((s.metrics as any).viewThroughConversions || 0),
            videoViews: acc.videoViews + ((s.metrics as any).videoPlays || (s.metrics as any).videoViews || 0),
            // Video quartile weighted accumulators
            wVideoP25: acc.wVideoP25 + ((s.metrics as any).videoP25 || 0) * ((s.metrics as any).videoPlays || (s.metrics as any).videoViews || 0),
            wVideoP50: acc.wVideoP50 + ((s.metrics as any).videoP50 || 0) * ((s.metrics as any).videoPlays || (s.metrics as any).videoViews || 0),
            wVideoP75: acc.wVideoP75 + ((s.metrics as any).videoP75 || 0) * ((s.metrics as any).videoPlays || (s.metrics as any).videoViews || 0),
            wVideoP100: acc.wVideoP100 + ((s.metrics as any).videoP100 || 0) * ((s.metrics as any).videoPlays || (s.metrics as any).videoViews || 0),
            // Weighted accumulators for impression share, cpm, conversionRate
            wImpressionShare: acc.wImpressionShare + ((s.metrics as any).searchImpressionShare || 0) * (s.metrics.impressions || 0),
            wBudgetLostIS: acc.wBudgetLostIS + ((s.metrics as any).searchBudgetLostIS || 0) * (s.metrics.impressions || 0),
            wRankLostIS: acc.wRankLostIS + ((s.metrics as any).searchRankLostIS || 0) * (s.metrics.impressions || 0),
            wConversionRate: acc.wConversionRate + ((s.metrics as any).conversionRate || 0) * (s.metrics.impressions || 0),
            wCpm: acc.wCpm + ((s.metrics as any).cpm || 0) * (s.metrics.impressions || 0),
        }),
        { spend: 0, revenue: 0, conversions: 0, impressions: 0, clicks: 0, allConversions: 0, allConversionsValue: 0, viewThroughConversions: 0, videoViews: 0, wVideoP25: 0, wVideoP50: 0, wVideoP75: 0, wVideoP100: 0, wImpressionShare: 0, wBudgetLostIS: 0, wRankLostIS: 0, wConversionRate: 0, wCpm: 0 }
    );
    const roas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
    const cpa = totals.conversions > 0 ? totals.spend / totals.conversions : 0;
    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
    const avgImpressionShare = totals.impressions > 0 ? totals.wImpressionShare / totals.impressions : 0;
    const avgBudgetLostIS = totals.impressions > 0 ? totals.wBudgetLostIS / totals.impressions : 0;
    const avgRankLostIS = totals.impressions > 0 ? totals.wRankLostIS / totals.impressions : 0;
    const avgConversionRate = totals.impressions > 0 ? totals.wConversionRate / totals.impressions : 0;
    const avgCpm = totals.impressions > 0 ? totals.wCpm / totals.impressions : 0;

    // Video quartile averages
    const avgVideoP25 = totals.videoViews > 0 ? totals.wVideoP25 / totals.videoViews : 0;
    const avgVideoP50 = totals.videoViews > 0 ? totals.wVideoP50 / totals.videoViews : 0;
    const avgVideoP75 = totals.videoViews > 0 ? totals.wVideoP75 / totals.videoViews : 0;
    const avgVideoP100 = totals.videoViews > 0 ? totals.wVideoP100 / totals.videoViews : 0;

    // Previous period totals
    const prevTotals = prevSnapshots.reduce(
        (acc, s) => ({
            spend: acc.spend + (s.metrics.spend || 0),
            revenue: acc.revenue + (s.metrics.revenue || 0),
            conversions: acc.conversions + (s.metrics.conversions || 0),
            impressions: acc.impressions + (s.metrics.impressions || 0),
            clicks: acc.clicks + (s.metrics.clicks || 0),
        }),
        { spend: 0, revenue: 0, conversions: 0, impressions: 0, clicks: 0 }
    );
    const prevRoas = prevTotals.spend > 0 ? prevTotals.revenue / prevTotals.spend : 0;
    const prevCpa = prevTotals.conversions > 0 ? prevTotals.spend / prevTotals.conversions : 0;
    const prevCtr = prevTotals.impressions > 0 ? (prevTotals.clicks / prevTotals.impressions) * 100 : 0;
    const prevCpc = prevTotals.clicks > 0 ? prevTotals.spend / prevTotals.clicks : 0;

    // Search terms aggregated across snapshots (dedupe by term, keep highest values)
    const searchTermMap = new Map<string, { impressions: number; clicks: number; conversions: number; conversionsValue: number; spend: number }>();
    for (const s of snapshots) {
        const terms = (s.rawData?.searchTerms as any[]) || [];
        for (const t of terms) {
            const key = t.searchTerm;
            const existing = searchTermMap.get(key);
            if (existing) {
                existing.impressions += t.impressions || 0;
                existing.clicks += t.clicks || 0;
                existing.conversions += t.conversions || 0;
                existing.conversionsValue += t.conversionsValue || 0;
                existing.spend += t.spend || 0;
            } else {
                searchTermMap.set(key, {
                    impressions: t.impressions || 0,
                    clicks: t.clicks || 0,
                    conversions: t.conversions || 0,
                    conversionsValue: t.conversionsValue || 0,
                    spend: t.spend || 0,
                });
            }
        }
    }
    const searchTerms = Array.from(searchTermMap.entries())
        .map(([term, data]) => ({
            term,
            ...data,
            ctr: data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0,
            cpa: data.conversions > 0 ? data.spend / data.conversions : 0,
        }))
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 30);

    // Aggregate campaigns across all snapshots (deduplicate by id+date → aggregate by id)
    const campaignMap = new Map<string, { name: string; status: string; spend: number; conversions: number; revenue: number; impressions: number; clicks: number }>();
    for (const s of snapshots) {
        const campaigns = (s.rawData?.campaigns as any[]) || [];
        for (const c of campaigns) {
            const key = c.id || c.name;
            const existing = campaignMap.get(key);
            const revenue = c.conversionsValue || ((c.roas || 0) * (c.spend || 0));
            if (existing) {
                existing.spend += c.spend || 0;
                existing.conversions += c.conversions || 0;
                existing.revenue += revenue;
                existing.impressions += c.impressions || 0;
                existing.clicks += c.clicks || 0;
            } else {
                campaignMap.set(key, {
                    name: c.name || c.campaignName,
                    status: c.status || c.campaignStatus,
                    spend: c.spend || 0,
                    conversions: c.conversions || 0,
                    revenue,
                    impressions: c.impressions || 0,
                    clicks: c.clicks || 0,
                });
            }
        }
    }
    const aggregatedCampaigns = Array.from(campaignMap.values())
        .sort((a, b) => b.spend - a.spend);

    return (
        <AppLayout>
            <div className="space-y-8 pb-20">
                <header className="flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-text-primary uppercase tracking-tighter">
                            Google Ads
                        </h1>
                        <p className="text-small text-text-muted font-bold uppercase tracking-widest mt-1">
                            Canal de Publicidad &bull; {formatRangeLabel(dateRange)}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <DateRangePicker value={dateRange} onChange={setDateRange} />
                        <button onClick={() => openAnalyst('google_ads')} className="px-3 py-2 bg-classic text-stellar font-black text-[10px] uppercase tracking-widest hover:bg-classic/90 transition-all whitespace-nowrap">Analizar con IA</button>
                    </div>
                </header>

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
                        <p className="text-text-muted text-small">No hay datos de Google Ads para este período.</p>
                        <p className="text-[10px] text-text-muted">Verificá que la integración esté activa y el cron haya corrido.</p>
                    </div>
                )}

                {!isLoading && !error && snapshots.length > 0 && (
                    <>
                        {/* KPI Grid */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <KPICard
                                label="Inversión"
                                value={formatCurrency(totals.spend)}
                                subtitle={`${snapshots.length} días con data`}
                                delta={calcDelta(totals.spend, prevTotals.spend)}
                            />
                            <KPICard
                                label="Revenue"
                                value={formatCurrency(totals.revenue)}
                                subtitle={`${formatNumber(totals.conversions, 0)} conversiones`}
                                color="text-synced"
                                delta={calcDelta(totals.revenue, prevTotals.revenue)}
                            />
                            <KPICard
                                label="ROAS"
                                value={`${roas.toFixed(2)}x`}
                                subtitle="Revenue / Inversión"
                                color={roas >= 3 ? "text-synced" : roas >= 1 ? "text-classic" : "text-red-400"}
                                delta={calcDelta(roas, prevRoas)}
                            />
                            <KPICard
                                label="CPA"
                                value={formatCurrency(cpa)}
                                subtitle="Costo por conversión"
                                color={cpa > 0 ? "text-text-primary" : "text-text-muted"}
                                delta={calcDelta(cpa, prevCpa)}
                                deltaInverse
                            />
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <KPICard
                                label="Impresiones"
                                value={formatNumber(totals.impressions, 0)}
                                delta={calcDelta(totals.impressions, prevTotals.impressions)}
                            />
                            <KPICard
                                label="Clicks"
                                value={formatNumber(totals.clicks, 0)}
                                delta={calcDelta(totals.clicks, prevTotals.clicks)}
                            />
                            <KPICard
                                label="CTR"
                                value={formatPct(ctr)}
                                color={ctr > 2 ? "text-synced" : "text-text-primary"}
                                delta={calcDelta(ctr, prevCtr)}
                            />
                            <KPICard
                                label="CPC"
                                value={formatCurrency(cpc)}
                                delta={calcDelta(cpc, prevCpc)}
                                deltaInverse
                            />
                        </div>

                        {/* KPI Row 3 - Expanded Metrics */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <KPICard
                                label="Impression Share"
                                value={formatPct(avgImpressionShare)}
                                subtitle={`Lost: ${avgBudgetLostIS.toFixed(1)}% budget, ${avgRankLostIS.toFixed(1)}% rank`}
                                color={avgImpressionShare > 50 ? "text-synced" : avgImpressionShare > 20 ? "text-classic" : "text-red-400"}
                            />
                            <KPICard
                                label="CPM"
                                value={formatCurrency(avgCpm)}
                            />
                            <KPICard
                                label="View-Through Conv."
                                value={formatNumber(totals.viewThroughConversions, 0)}
                            />
                            <KPICard
                                label="Conv. Rate"
                                value={formatPct(avgConversionRate)}
                                color={avgConversionRate > 5 ? "text-synced" : "text-text-primary"}
                            />
                        </div>

                        {/* Impression Share Analysis Bar */}
                        {avgImpressionShare > 0 && (
                            <div className="card p-6">
                                <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                    Impression Share Analysis
                                </h2>
                                <div className="flex items-center h-8 w-full rounded overflow-hidden">
                                    {avgImpressionShare > 0 && (
                                        <div
                                            className="h-full bg-synced/70 flex items-center justify-center text-[10px] font-bold text-stellar"
                                            style={{ width: `${avgImpressionShare}%` }}
                                        >
                                            {avgImpressionShare >= 8 ? `${avgImpressionShare.toFixed(1)}%` : ""}
                                        </div>
                                    )}
                                    {avgBudgetLostIS > 0 && (
                                        <div
                                            className="h-full bg-yellow-500/70 flex items-center justify-center text-[10px] font-bold text-stellar"
                                            style={{ width: `${avgBudgetLostIS}%` }}
                                        >
                                            {avgBudgetLostIS >= 8 ? `${avgBudgetLostIS.toFixed(1)}%` : ""}
                                        </div>
                                    )}
                                    {avgRankLostIS > 0 && (
                                        <div
                                            className="h-full bg-red-500/70 flex items-center justify-center text-[10px] font-bold text-stellar"
                                            style={{ width: `${avgRankLostIS}%` }}
                                        >
                                            {avgRankLostIS >= 8 ? `${avgRankLostIS.toFixed(1)}%` : ""}
                                        </div>
                                    )}
                                    {/* Remaining (unaccounted) share */}
                                    {(100 - avgImpressionShare - avgBudgetLostIS - avgRankLostIS) > 0 && (
                                        <div
                                            className="h-full bg-argent/20"
                                            style={{ width: `${100 - avgImpressionShare - avgBudgetLostIS - avgRankLostIS}%` }}
                                        />
                                    )}
                                </div>
                                <div className="flex items-center gap-6 mt-3 text-[10px] text-text-muted">
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-sm bg-synced/70" /> Won: {avgImpressionShare.toFixed(1)}%
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-sm bg-yellow-500/70" /> Lost Budget: {avgBudgetLostIS.toFixed(1)}%
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-sm bg-red-500/70" /> Lost Rank: {avgRankLostIS.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Campaign Table */}
                        {aggregatedCampaigns.length > 0 && (
                            <div className="card p-6">
                                <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                    Campañas ({aggregatedCampaigns.length})
                                </h2>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-argent/50">
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest">Campaña</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Inversión</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Conv.</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Revenue</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">ROAS</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">CPA</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {aggregatedCampaigns.map((c, i) => {
                                                const campRoas = c.spend > 0 ? c.revenue / c.spend : 0;
                                                const campCpa = c.conversions > 0 ? c.spend / c.conversions : 0;
                                                return (
                                                    <tr key={i} className="border-b border-argent/10 hover:bg-classic/[0.03]">
                                                        <td className="p-3 text-[11px] text-text-primary font-medium max-w-[300px] truncate">{c.name}</td>
                                                        <td className="p-3 text-[11px] text-text-secondary font-mono text-right">{formatCurrency(c.spend)}</td>
                                                        <td className="p-3 text-[11px] text-text-secondary font-mono text-right">{formatNumber(c.conversions, 0)}</td>
                                                        <td className="p-3 text-[11px] text-synced font-mono text-right">
                                                            {c.revenue > 0 ? formatCurrency(c.revenue) : "—"}
                                                        </td>
                                                        <td className="p-3 text-[11px] font-mono text-right">
                                                            <span className={campRoas >= 3 ? "text-synced" : campRoas >= 1 ? "text-classic" : "text-red-400"}>
                                                                {campRoas > 0 ? `${campRoas.toFixed(2)}x` : "—"}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-[11px] text-text-secondary font-mono text-right">
                                                            {campCpa > 0 ? formatCurrency(campCpa) : "—"}
                                                        </td>
                                                        <td className="p-3 text-[11px] text-right">
                                                            <span className={`px-2 py-0.5 text-[9px] font-bold uppercase ${c.status === "ENABLED" || String(c.status) === "2" ? "text-synced bg-synced/10" : "text-text-muted bg-argent/20"}`}>
                                                                {c.status === "ENABLED" || String(c.status) === "2" ? "activa" : c.status === "PAUSED" || String(c.status) === "3" ? "pausada" : String(c.status || "—")}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Video Completion Funnel */}
                        {totals.videoViews > 0 && avgVideoP25 > 0 && (
                            <div className="card p-6">
                                <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                    Video Completion Funnel
                                </h2>
                                <div className="grid grid-cols-5 gap-2 text-center mb-4">
                                    <div>
                                        <p className="text-lg font-black font-mono text-text-primary">{formatNumber(totals.videoViews, 0)}</p>
                                        <p className="text-[9px] text-text-muted">Views</p>
                                    </div>
                                    <div>
                                        <p className="text-lg font-black font-mono text-classic">{formatPct(avgVideoP25)}</p>
                                        <p className="text-[9px] text-text-muted">25% visto</p>
                                    </div>
                                    <div>
                                        <p className="text-lg font-black font-mono text-classic">{formatPct(avgVideoP50)}</p>
                                        <p className="text-[9px] text-text-muted">50% visto</p>
                                    </div>
                                    <div>
                                        <p className="text-lg font-black font-mono text-classic">{formatPct(avgVideoP75)}</p>
                                        <p className="text-[9px] text-text-muted">75% visto</p>
                                    </div>
                                    <div>
                                        <p className="text-lg font-black font-mono text-synced">{formatPct(avgVideoP100)}</p>
                                        <p className="text-[9px] text-text-muted">Completado</p>
                                    </div>
                                </div>
                                <div className="flex items-center h-6 w-full overflow-hidden">
                                    <div className="h-full bg-classic/70 flex items-center justify-center text-[9px] font-bold text-stellar" style={{ width: `${avgVideoP25}%` }}>
                                        {avgVideoP25 >= 10 ? `${avgVideoP25.toFixed(0)}%` : ""}
                                    </div>
                                    <div className="h-full bg-classic/50 flex items-center justify-center text-[9px] font-bold text-stellar" style={{ width: `${Math.max(avgVideoP50 - avgVideoP25, 0)}%` }} />
                                    <div className="h-full bg-classic/30 flex items-center justify-center text-[9px] font-bold text-stellar" style={{ width: `${Math.max(avgVideoP75 - avgVideoP50, 0)}%` }} />
                                    <div className="h-full bg-synced/50 flex items-center justify-center text-[9px] font-bold text-stellar" style={{ width: `${Math.max(avgVideoP100 - avgVideoP75, 0)}%` }} />
                                    <div className="h-full bg-argent/20" style={{ width: `${Math.max(100 - avgVideoP25, 0)}%` }} />
                                </div>
                                <div className="flex gap-4 mt-2 text-[9px] text-text-muted">
                                    <span>Drop P25→P50: {avgVideoP25 > 0 ? ((1 - avgVideoP50 / avgVideoP25) * 100).toFixed(0) : 0}%</span>
                                    <span>Drop P50→P75: {avgVideoP50 > 0 ? ((1 - avgVideoP75 / avgVideoP50) * 100).toFixed(0) : 0}%</span>
                                    <span>Drop P75→P100: {avgVideoP75 > 0 ? ((1 - avgVideoP100 / avgVideoP75) * 100).toFixed(0) : 0}%</span>
                                </div>
                            </div>
                        )}

                        {/* Search Terms */}
                        {searchTerms.length > 0 && (
                            <div className="card p-6">
                                <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                    Top Search Terms ({searchTerms.length})
                                </h2>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-argent/50">
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest">Término</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Impresiones</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Clicks</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">CTR</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Conv.</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Inversión</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">CPA</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {searchTerms.map((t, i) => (
                                                <tr key={i} className="border-b border-argent/10 hover:bg-classic/[0.03]">
                                                    <td className="p-3 text-[11px] text-text-primary font-medium max-w-[300px] truncate">{t.term}</td>
                                                    <td className="p-3 text-[11px] text-text-secondary font-mono text-right">{formatNumber(t.impressions, 0)}</td>
                                                    <td className="p-3 text-[11px] text-text-secondary font-mono text-right">{formatNumber(t.clicks, 0)}</td>
                                                    <td className="p-3 text-[11px] text-text-secondary font-mono text-right">{formatPct(t.ctr)}</td>
                                                    <td className="p-3 text-[11px] font-mono text-right">
                                                        <span className={t.conversions > 0 ? "text-synced" : "text-text-muted"}>
                                                            {t.conversions > 0 ? formatNumber(t.conversions, 0) : "—"}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-[11px] text-text-secondary font-mono text-right">{formatCurrency(t.spend)}</td>
                                                    <td className="p-3 text-[11px] text-text-secondary font-mono text-right">
                                                        {t.cpa > 0 ? formatCurrency(t.cpa) : "—"}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Daily Trend */}
                        <div className="card p-6">
                            <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                Actividad por Día
                            </h2>
                            <div className="grid grid-cols-1 gap-2">
                                {snapshots.map((s) => {
                                    const maxSpend = Math.max(...snapshots.map(x => x.metrics.spend || 0), 1);
                                    const barWidth = ((s.metrics.spend || 0) / maxSpend) * 100;
                                    const dayRoas = (s.metrics.spend || 0) > 0 ? (s.metrics.revenue || 0) / (s.metrics.spend || 1) : 0;
                                    return (
                                        <div key={s.date} className="flex items-center gap-3 text-[11px]">
                                            <span className="text-text-muted font-mono w-16 shrink-0">{formatDate(s.date)}</span>
                                            <div className="flex-1 h-4 bg-argent/20 relative">
                                                <div className="h-full bg-classic/60" style={{ width: `${barWidth}%` }} />
                                            </div>
                                            <span className="text-text-secondary font-mono w-16 text-right">
                                                {formatCurrency(s.metrics.spend)}
                                            </span>
                                            <span className="text-text-muted font-mono w-12 text-right">
                                                {(s.metrics.conversions || 0).toFixed(0)} conv
                                            </span>
                                            <span className={`font-mono w-16 text-right ${dayRoas >= 3 ? "text-synced" : dayRoas >= 1 ? "text-classic" : "text-red-400"}`}>
                                                {dayRoas > 0 ? `${dayRoas.toFixed(1)}x` : ""}
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
