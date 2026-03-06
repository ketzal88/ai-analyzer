"use client";

import React, { useEffect, useState, useMemo } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { useClient } from "@/contexts/ClientContext";
import { ChannelDailySnapshot } from "@/types/channel-snapshots";
import { UnifiedDateRange, resolvePreset, formatRangeLabel } from "@/lib/date-utils";
import DateRangePicker from "@/components/ui/DateRangePicker";
import { useAnalyst } from "@/contexts/AnalystContext";
import Link from "next/link";
import { EntityRollingMetrics, EntityLevel } from "@/types/performance-snapshots";
import { EntityClassification, FinalDecision, IntentStage, LearningState, FatigueState } from "@/types/classifications";
import { RecommendationDoc } from "@/types/ai-recommendations";

function formatCurrency(value: number | undefined, prefix = "$"): string {
    if (value === undefined || value === null) return "\u2014";
    if (value >= 1_000_000) return `${prefix}${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${prefix}${(value / 1_000).toFixed(1)}K`;
    return `${prefix}${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatNumber(value: number | undefined, decimals = 1): string {
    if (value === undefined || value === null) return "\u2014";
    return value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

function formatPct(value: number | undefined): string {
    if (value === undefined || value === null) return "\u2014";
    return `${value.toFixed(2)}%`;
}

function formatDate(dateStr: string): string {
    const [, m, d] = dateStr.split("-");
    const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    return `${parseInt(d)} ${months[parseInt(m) - 1]}`;
}

interface KPICardProps {
    label: string;
    value: string;
    subtitle?: string;
    color?: string;
}

function KPICard({ label, value, subtitle, color }: KPICardProps) {
    return (
        <div className="card p-5 hover:border-classic/30 transition-all">
            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">{label}</p>
            <p className={`text-2xl font-black mt-2 font-mono ${color || "text-text-primary"}`}>{value}</p>
            {subtitle && <p className="text-[10px] text-text-muted mt-1">{subtitle}</p>}
        </div>
    );
}


export default function MetaAdsChannel() {
    const { openAnalyst } = useAnalyst();
    const {
        selectedClientId: clientId,
        activeClients,
        performanceData,
        isPerformanceLoading,
        refreshPerformance
    } = useClient();
    const [snapshots, setSnapshots] = useState<ChannelDailySnapshot[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<UnifiedDateRange>(() => resolvePreset("mtd"));

    // Entity table state
    const rollingMetrics = performanceData?.rolling || [];
    const classifications = performanceData?.classifications || [];
    const alerts = performanceData?.alerts || [];

    const client = useMemo(() => activeClients.find(c => c.id === clientId), [clientId, activeClients]);
    const businessType = client?.businessType || 'ecommerce';
    const [level, setLevel] = useState<EntityLevel>("ad");

    const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [recommendation, setRecommendation] = useState<RecommendationDoc | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
        key: 'impactScore',
        direction: 'desc'
    });

    useEffect(() => {
        if (!clientId) return;
        setIsLoading(true);
        setError(null);

        fetch(`/api/channel-snapshots?clientId=${clientId}&channel=META&startDate=${dateRange.start}&endDate=${dateRange.end}`)
            .then(res => res.json())
            .then(data => setSnapshots(data.snapshots || []))
            .catch(err => setError(err.message))
            .finally(() => setIsLoading(false));
    }, [clientId, dateRange.start, dateRange.end]);

    // Aggregate totals
    const totals = snapshots.reduce(
        (acc, s) => ({
            spend: acc.spend + (s.metrics.spend || 0),
            revenue: acc.revenue + (s.metrics.revenue || 0),
            conversions: acc.conversions + (s.metrics.conversions || 0),
            impressions: acc.impressions + (s.metrics.impressions || 0),
            clicks: acc.clicks + (s.metrics.clicks || 0),
            reach: acc.reach + ((s.metrics as any).reach || 0),
            inlineLinkClicks: acc.inlineLinkClicks + (s.metrics.inlineLinkClicks || 0),
            uniqueClicks: acc.uniqueClicks + (s.metrics.uniqueClicks || 0),
            addToCart: acc.addToCart + (s.metrics.addToCart || 0),
            initiateCheckout: acc.initiateCheckout + (s.metrics.initiateCheckout || 0),
            viewContent: acc.viewContent + (s.metrics.viewContent || 0),
            videoPlays: acc.videoPlays + (s.metrics.videoPlays || 0),
            videoP25: acc.videoP25 + (s.metrics.videoP25 || 0),
            videoP50: acc.videoP50 + (s.metrics.videoP50 || 0),
            videoP75: acc.videoP75 + (s.metrics.videoP75 || 0),
            videoP100: acc.videoP100 + (s.metrics.videoP100 || 0),
            // Weighted sums for averaging
            cpmWeighted: acc.cpmWeighted + (s.metrics.cpm || 0) * (s.metrics.impressions || 0),
            costPerInlineLinkClickWeighted: acc.costPerInlineLinkClickWeighted + (s.metrics.costPerInlineLinkClick || 0) * (s.metrics.inlineLinkClicks || 0),
        }),
        {
            spend: 0, revenue: 0, conversions: 0, impressions: 0, clicks: 0, reach: 0,
            inlineLinkClicks: 0, uniqueClicks: 0,
            addToCart: 0, initiateCheckout: 0, viewContent: 0,
            videoPlays: 0, videoP25: 0, videoP50: 0, videoP75: 0, videoP100: 0,
            cpmWeighted: 0, costPerInlineLinkClickWeighted: 0,
        }
    );
    const roas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
    const cpa = totals.conversions > 0 ? totals.spend / totals.conversions : 0;
    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
    const avgCpm = totals.impressions > 0 ? totals.cpmWeighted / totals.impressions : 0;
    const avgCostPerLinkClick = totals.inlineLinkClicks > 0 ? totals.costPerInlineLinkClickWeighted / totals.inlineLinkClicks : 0;

    // Sort snapshots by date ascending for the daily chart
    const sortedSnapshots = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));

    // Last snapshot quality rankings
    const lastSnapshot = sortedSnapshots.length > 0 ? sortedSnapshots[sortedSnapshots.length - 1] : null;
    const qualityRanking = lastSnapshot?.metrics.qualityRanking;
    const engagementRateRanking = lastSnapshot?.metrics.engagementRateRanking;
    const conversionRateRanking = lastSnapshot?.metrics.conversionRateRanking;
    const hasQualityData = qualityRanking || engagementRateRanking || conversionRateRanking;

    // Funnel data
    const hasFunnelData = totals.addToCart > 0 || totals.viewContent > 0;

    // Video data
    const hasVideoData = totals.videoPlays > 0;

    // Aggregate campaigns across all snapshots
    const campaignMap = new Map<string, { name: string; objective: string; spend: number; conversions: number; revenue: number; impressions: number; clicks: number }>();
    for (const s of snapshots) {
        const campaigns = (s.rawData?.campaigns as any[]) || [];
        for (const c of campaigns) {
            const key = c.id || c.campaign_id || c.name;
            const existing = campaignMap.get(key);
            const revenue = c.revenue || c.conversionsValue || ((c.roas || 0) * (c.spend || 0));
            if (existing) {
                existing.spend += c.spend || 0;
                existing.conversions += c.conversions || 0;
                existing.revenue += revenue;
                existing.impressions += c.impressions || 0;
                existing.clicks += c.clicks || 0;
            } else {
                campaignMap.set(key, {
                    name: c.name || c.campaign_name || c.campaignName || key,
                    objective: c.objective || c.campaign_objective || "",
                    spend: c.spend || 0,
                    conversions: c.conversions || 0,
                    revenue,
                    impressions: c.impressions || 0,
                    clicks: c.clicks || 0,
                });
            }
        }
    }
    const aggregatedCampaigns = Array.from(campaignMap.values()).sort((a, b) => b.spend - a.spend);

    // Entity table logic
    const filteredRolling = useMemo(() => {
        const list = rollingMetrics.filter(m => m.level === level);
        return list.sort((a, b) => {
            const clA = classifications.find(c => c.entityId === a.entityId && c.level === a.level);
            const clB = classifications.find(c => c.entityId === b.entityId && c.level === b.level);
            let valA: any;
            let valB: any;
            switch (sortConfig.key) {
                case 'name': valA = a.name; valB = b.name; break;
                case 'spend_7d': valA = a.rolling.spend_7d; valB = b.rolling.spend_7d; break;
                case 'impressions_7d': valA = a.rolling.impressions_7d; valB = b.rolling.impressions_7d; break;
                case 'ctr_7d': valA = a.rolling.ctr_7d; valB = b.rolling.ctr_7d; break;
                case 'hook_rate_7d': valA = a.rolling.hook_rate_7d; valB = b.rolling.hook_rate_7d; break;
                case 'funnel': valA = clA?.intentStage; valB = clB?.intentStage; break;
                case 'fitr_7d': valA = a.rolling.fitr_7d; valB = b.rolling.fitr_7d; break;
                case 'cpa_7d': valA = a.rolling.cpa_7d; valB = b.rolling.cpa_7d; break;
                case 'roas_7d': valA = a.rolling.roas_7d; valB = b.rolling.roas_7d; break;
                case 'learningState': valA = clA?.learningState; valB = clB?.learningState; break;
                case 'fatigueState': valA = clA?.fatigueState; valB = clB?.fatigueState; break;
                case 'finalDecision': valA = clA?.finalDecision; valB = clB?.finalDecision; break;
                case 'impactScore': valA = clA?.impactScore; valB = clB?.impactScore; break;
                default: valA = 0; valB = 0;
            }
            if (valA === valB) return 0;
            if (valA === undefined || valA === null) return 1;
            if (valB === undefined || valB === null) return -1;
            const multiplier = sortConfig.direction === 'asc' ? 1 : -1;
            return valA < valB ? -1 * multiplier : 1 * multiplier;
        });
    }, [rollingMetrics, level, sortConfig, classifications]);

    const handleSort = (key: string) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const handleRowClick = async (entityId: string) => {
        setSelectedEntityId(entityId);
        setIsDrawerOpen(true);
        setRecommendation(null);
        try {
            const today = new Date().toISOString().split("T")[0];
            const res = await fetch(`/api/recommendations/detail?clientId=${clientId}&level=${level}&entityId=${entityId}&rangeStart=${today}&rangeEnd=${today}`);
            const data = await res.json();
            if (data.status === 'success') {
                setRecommendation(data.recommendation);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const generateRecommendation = async () => {
        if (!selectedEntityId || !clientId) return;
        setIsGenerating(true);
        try {
            const today = new Date().toISOString().split("T")[0];
            const res = await fetch('/api/recommendations/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId,
                    range: { start: today, end: today },
                    level,
                    entityId: selectedEntityId
                })
            });
            const data = await res.json();
            if (data.status === 'generated' || data.status === 'cached') {
                setRecommendation(data.recommendation);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsGenerating(false);
        }
    };

    const selectedMetrics = useMemo(() => rollingMetrics.find(m => m.entityId === selectedEntityId), [rollingMetrics, selectedEntityId]);
    const selectedClass = useMemo(() => classifications.find(c => c.entityId === selectedEntityId && c.level === level), [classifications, selectedEntityId, level]);
    const entityAlerts = useMemo(() => alerts.filter(a => a.entityId === selectedEntityId), [alerts, selectedEntityId]);

    return (
        <AppLayout>
            <div className="space-y-8 pb-20">
                <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-text-primary uppercase tracking-tighter">
                            Meta Ads
                        </h1>
                        <p className="text-small text-text-muted font-bold uppercase tracking-widest mt-1">
                            Facebook & Instagram &bull; {formatRangeLabel(dateRange)}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <DateRangePicker value={dateRange} onChange={setDateRange} />
                        <button onClick={() => openAnalyst('meta_ads')} className="px-3 py-2 bg-classic text-stellar font-black text-[10px] uppercase tracking-widest hover:bg-classic/90 transition-all whitespace-nowrap">Analizar con IA</button>
                    </div>
                </header>

                {isLoading && (
                    <div className="card p-12 flex items-center justify-center">
                        <div className="animate-spin w-6 h-6 border-2 border-classic border-t-transparent" />
                        <span className="ml-3 text-text-muted text-small">Cargando datos de Meta Ads...</span>
                    </div>
                )}

                {error && (
                    <div className="card p-6 border-red-500/30">
                        <p className="text-red-400 text-small">{error}</p>
                    </div>
                )}

                {!isLoading && !error && snapshots.length === 0 && (
                    <div className="card p-12 border-dashed flex flex-col items-center gap-3">
                        <p className="text-text-muted text-small">No hay datos de Meta Ads para este periodo.</p>
                        <p className="text-[10px] text-text-muted">Verifica que la integracion este activa y el cron haya corrido.</p>
                    </div>
                )}

                {!isLoading && !error && snapshots.length > 0 && (
                    <>
                        {/* KPI Row 1 */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <KPICard
                                label="Inversion"
                                value={formatCurrency(totals.spend)}
                                subtitle={`${snapshots.length} dias con data`}
                            />
                            <KPICard
                                label="Revenue"
                                value={formatCurrency(totals.revenue)}
                                subtitle={`${formatNumber(totals.conversions, 0)} conversiones`}
                                color="text-synced"
                            />
                            <KPICard
                                label="ROAS"
                                value={`${roas.toFixed(2)}x`}
                                subtitle="Revenue / Inversion"
                                color={roas >= 3 ? "text-synced" : roas >= 1 ? "text-classic" : "text-red-400"}
                            />
                            <KPICard
                                label="CPA"
                                value={formatCurrency(cpa)}
                                subtitle="Costo por conversion"
                                color={cpa > 0 ? "text-text-primary" : "text-text-muted"}
                            />
                        </div>

                        {/* KPI Row 2 */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <KPICard
                                label="Impresiones"
                                value={formatNumber(totals.impressions, 0)}
                            />
                            <KPICard
                                label="Clicks"
                                value={formatNumber(totals.clicks, 0)}
                            />
                            <KPICard
                                label="CTR"
                                value={formatPct(ctr)}
                                color={ctr > 2 ? "text-synced" : "text-text-primary"}
                            />
                            <KPICard
                                label="Alcance"
                                value={formatNumber(totals.reach, 0)}
                            />
                        </div>

                        {/* KPI Row 3 — Extended Metrics */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <KPICard
                                label="Link Clicks"
                                value={formatNumber(totals.inlineLinkClicks, 0)}
                                subtitle={avgCostPerLinkClick > 0 ? `Costo: ${formatCurrency(avgCostPerLinkClick)}` : undefined}
                            />
                            <KPICard
                                label="CPM"
                                value={avgCpm > 0 ? formatCurrency(avgCpm) : "\u2014"}
                                subtitle="Costo por 1000 impresiones"
                            />
                            <KPICard
                                label="CPC"
                                value={cpc > 0 ? formatCurrency(cpc) : "\u2014"}
                                subtitle="Costo por click"
                            />
                            <KPICard
                                label="Clicks Unicos"
                                value={formatNumber(totals.uniqueClicks, 0)}
                            />
                        </div>

                        {/* Quality Ranking Badges */}
                        {hasQualityData && (
                            <div className="card p-6">
                                <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                    Quality Rankings
                                </h2>
                                <div className="grid grid-cols-3 gap-4">
                                    <QualityBadge label="Quality" value={qualityRanking} />
                                    <QualityBadge label="Engagement" value={engagementRateRanking} />
                                    <QualityBadge label="Conversion" value={conversionRateRanking} />
                                </div>
                            </div>
                        )}

                        {/* Conversion Funnel */}
                        {hasFunnelData && (
                            <div className="card p-6">
                                <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                    Funnel de Conversion
                                </h2>
                                {(() => {
                                    const funnelSteps = [
                                        { label: "View Content", value: totals.viewContent },
                                        { label: "Add to Cart", value: totals.addToCart },
                                        { label: "Initiate Checkout", value: totals.initiateCheckout },
                                        { label: "Purchase", value: totals.conversions },
                                    ].filter(s => s.value > 0);
                                    const maxVal = Math.max(...funnelSteps.map(s => s.value), 1);
                                    return (
                                        <div className="space-y-3">
                                            {funnelSteps.map((step) => (
                                                <div key={step.label} className="flex items-center gap-3">
                                                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest w-32 shrink-0">{step.label}</span>
                                                    <div className="flex-1 h-6 bg-argent/20 relative">
                                                        <div className="h-full bg-classic/50" style={{ width: `${(step.value / maxVal) * 100}%` }} />
                                                    </div>
                                                    <span className="text-[11px] font-black text-text-primary font-mono w-16 text-right">{formatNumber(step.value, 0)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {/* Video Performance */}
                        {hasVideoData && (
                            <div className="card p-6">
                                <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                    Video Performance
                                </h2>
                                {(() => {
                                    const videoSteps = [
                                        { label: "Plays", value: totals.videoPlays },
                                        { label: "25%", value: totals.videoP25 },
                                        { label: "50%", value: totals.videoP50 },
                                        { label: "75%", value: totals.videoP75 },
                                        { label: "100%", value: totals.videoP100 },
                                    ];
                                    const maxVal = Math.max(totals.videoPlays, 1);
                                    // Compute avg watch time from last snapshot if available
                                    const avgWatchTime = lastSnapshot?.metrics.videoAvgWatchTime;
                                    return (
                                        <div className="space-y-3">
                                            {videoSteps.map((step) => {
                                                const pct = totals.videoPlays > 0 ? (step.value / totals.videoPlays) * 100 : 0;
                                                return (
                                                    <div key={step.label} className="flex items-center gap-3">
                                                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest w-16 shrink-0">{step.label}</span>
                                                        <div className="flex-1 h-5 bg-argent/20 relative">
                                                            <div className="h-full bg-purple-500/50" style={{ width: `${(step.value / maxVal) * 100}%` }} />
                                                        </div>
                                                        <span className="text-[11px] font-black text-text-primary font-mono w-20 text-right">
                                                            {formatNumber(step.value, 0)}
                                                        </span>
                                                        <span className="text-[10px] text-text-muted font-mono w-12 text-right">
                                                            {step.label !== "Plays" ? `${pct.toFixed(0)}%` : ""}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                            {avgWatchTime != null && avgWatchTime > 0 && (
                                                <p className="text-[10px] text-text-muted mt-2">
                                                    Tiempo promedio de visualizacion: <span className="font-black text-text-primary font-mono">{avgWatchTime.toFixed(1)}s</span>
                                                </p>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {/* Campaign Breakdown */}
                        {aggregatedCampaigns.length > 0 && (
                            <div className="card p-6">
                                <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                    Campanas ({aggregatedCampaigns.length})
                                </h2>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-argent/50">
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest">Campana</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest">Objetivo</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Inversion</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Conv.</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Revenue</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">ROAS</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">CPA</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">CTR</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {aggregatedCampaigns.map((c, i) => {
                                                const campRoas = c.spend > 0 ? c.revenue / c.spend : 0;
                                                const campCpa = c.conversions > 0 ? c.spend / c.conversions : 0;
                                                const campCtr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
                                                return (
                                                    <tr key={i} className="border-b border-argent/10 hover:bg-classic/[0.03]">
                                                        <td className="p-3 text-[11px] text-text-primary font-medium max-w-[250px] truncate">{c.name}</td>
                                                        <td className="p-3">
                                                            {c.objective && (
                                                                <span className="text-[9px] font-black uppercase tracking-widest bg-argent/20 text-text-secondary px-1.5 py-0.5">
                                                                    {c.objective}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="p-3 text-[11px] text-text-secondary font-mono text-right">{formatCurrency(c.spend)}</td>
                                                        <td className="p-3 text-[11px] text-text-secondary font-mono text-right">{formatNumber(c.conversions, 0)}</td>
                                                        <td className="p-3 text-[11px] text-synced font-mono text-right">
                                                            {c.revenue > 0 ? formatCurrency(c.revenue) : "\u2014"}
                                                        </td>
                                                        <td className="p-3 text-[11px] font-mono text-right">
                                                            <span className={campRoas >= 3 ? "text-synced" : campRoas >= 1 ? "text-classic" : "text-red-400"}>
                                                                {campRoas > 0 ? `${campRoas.toFixed(2)}x` : "\u2014"}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-[11px] text-text-secondary font-mono text-right">
                                                            {campCpa > 0 ? formatCurrency(campCpa) : "\u2014"}
                                                        </td>
                                                        <td className="p-3 text-[11px] text-text-secondary font-mono text-right">
                                                            {campCtr > 0 ? `${campCtr.toFixed(2)}%` : "\u2014"}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Daily Trend */}
                        <div className="card p-6">
                            <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                Actividad por Dia
                            </h2>
                            <div className="grid grid-cols-1 gap-2">
                                {sortedSnapshots.map((s) => {
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

                {/* ──── Entity Table (Campaigns / AdSets / Ads) ──── */}
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                            Motor GEM &mdash; Entidades Meta
                        </h2>
                        <div className="flex bg-special border border-argent p-0.5">
                            {(['account', 'campaign', 'adset', 'ad'] as EntityLevel[]).map((l) => (
                                <button
                                    key={l}
                                    onClick={() => setLevel(l)}
                                    className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${level === l ? 'bg-classic text-stellar' : 'text-text-muted hover:text-text-primary hover:bg-argent/10'}`}
                                >
                                    {l === 'ad' ? 'Anuncios' : l === 'adset' ? 'Conjuntos' : l === 'campaign' ? 'Campanas' : 'Cuenta'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {isPerformanceLoading && !rollingMetrics.length && (
                        <div className="card p-12 flex items-center justify-center">
                            <div className="animate-spin w-6 h-6 border-2 border-classic border-t-transparent" />
                            <span className="ml-3 text-text-muted text-small">Cargando entidades...</span>
                        </div>
                    )}

                    {!isPerformanceLoading && filteredRolling.length === 0 && (
                        <div className="card p-12 border-dashed flex flex-col items-center gap-3">
                            <p className="text-text-muted text-small">No se detectaron entidades activas para este nivel.</p>
                            <p className="text-[10px] text-text-muted">Asegurate de haber corrido la sincronizacion y agregacion de datos.</p>
                            <button
                                onClick={() => refreshPerformance()}
                                className="px-4 py-2 border border-argent text-[10px] font-bold hover:bg-argent/10 transition-colors"
                            >
                                Reintentar
                            </button>
                        </div>
                    )}

                    {filteredRolling.length > 0 && (
                        <div className="card overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse min-w-[1200px]">
                                    <thead>
                                        <tr className="border-b border-argent/50">
                                            <th onClick={() => handleSort('name')} className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest cursor-pointer hover:text-text-primary transition-colors sticky left-0 bg-special z-10 border-r border-argent/20 min-w-[240px]">
                                                <div className="flex items-center gap-1">Entidad <SortIcon active={sortConfig.key === 'name'} direction={sortConfig.direction} /></div>
                                            </th>
                                            <th onClick={() => handleSort('spend_7d')} className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right cursor-pointer hover:text-text-primary transition-colors">
                                                <div className="flex items-center justify-end gap-1">Inversion <SortIcon active={sortConfig.key === 'spend_7d'} direction={sortConfig.direction} /></div>
                                            </th>
                                            <th onClick={() => handleSort('impressions_7d')} className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right cursor-pointer hover:text-text-primary transition-colors">
                                                <div className="flex items-center justify-end gap-1">Imps <SortIcon active={sortConfig.key === 'impressions_7d'} direction={sortConfig.direction} /></div>
                                            </th>
                                            <th onClick={() => handleSort('ctr_7d')} className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right cursor-pointer hover:text-text-primary transition-colors">
                                                <div className="flex items-center justify-end gap-1">CTR <SortIcon active={sortConfig.key === 'ctr_7d'} direction={sortConfig.direction} /></div>
                                            </th>
                                            <th onClick={() => handleSort('hook_rate_7d')} className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right cursor-pointer hover:text-text-primary transition-colors">
                                                <div className="flex items-center justify-end gap-1">Hook <SortIcon active={sortConfig.key === 'hook_rate_7d'} direction={sortConfig.direction} /></div>
                                            </th>
                                            <th onClick={() => handleSort('funnel')} className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-center cursor-pointer hover:text-text-primary transition-colors">
                                                <div className="flex items-center justify-center gap-1">Funnel <SortIcon active={sortConfig.key === 'funnel'} direction={sortConfig.direction} /></div>
                                            </th>
                                            <th onClick={() => handleSort('cpa_7d')} className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right cursor-pointer hover:text-text-primary transition-colors">
                                                <div className="flex items-center justify-end gap-1">
                                                    {businessType === 'ecommerce' ? 'CPA' : businessType === 'leads' ? 'CPL' : 'CPC'}
                                                    <SortIcon active={sortConfig.key === 'cpa_7d'} direction={sortConfig.direction} />
                                                </div>
                                            </th>
                                            {businessType === 'ecommerce' && (
                                                <th onClick={() => handleSort('roas_7d')} className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right cursor-pointer hover:text-text-primary transition-colors">
                                                    <div className="flex items-center justify-end gap-1">ROAS <SortIcon active={sortConfig.key === 'roas_7d'} direction={sortConfig.direction} /></div>
                                                </th>
                                            )}
                                            <th onClick={() => handleSort('learningState')} className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-center cursor-pointer hover:text-text-primary transition-colors">
                                                <div className="flex items-center justify-center gap-1">Fase <SortIcon active={sortConfig.key === 'learningState'} direction={sortConfig.direction} /></div>
                                            </th>
                                            <th onClick={() => handleSort('fatigueState')} className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-center cursor-pointer hover:text-text-primary transition-colors">
                                                <div className="flex items-center justify-center gap-1">Fatiga <SortIcon active={sortConfig.key === 'fatigueState'} direction={sortConfig.direction} /></div>
                                            </th>
                                            <th onClick={() => handleSort('finalDecision')} className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest cursor-pointer hover:text-text-primary transition-colors">
                                                <div className="flex items-center gap-1">Decision GEM <SortIcon active={sortConfig.key === 'finalDecision'} direction={sortConfig.direction} /></div>
                                            </th>
                                            <th onClick={() => handleSort('impactScore')} className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-center cursor-pointer hover:text-text-primary transition-colors">
                                                <div className="flex items-center justify-center gap-1">Impacto <SortIcon active={sortConfig.key === 'impactScore'} direction={sortConfig.direction} /></div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRolling.map((m) => {
                                            const cl = classifications.find(c => c.entityId === m.entityId && c.level === m.level);
                                            const entityAlertCount = alerts.filter(a => a.entityId === m.entityId).length;
                                            return (
                                                <tr
                                                    key={m.entityId}
                                                    onClick={() => handleRowClick(m.entityId)}
                                                    className="group/row border-b border-argent/10 hover:bg-classic/[0.05] cursor-pointer transition-all"
                                                >
                                                    <td className="p-3 sticky left-0 bg-second group-hover/row:bg-second z-10 border-r border-argent/20 min-w-[240px]">
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[11px] font-bold text-text-primary truncate max-w-[200px] group-hover/row:text-classic transition-colors" title={m.name || m.entityId}>
                                                                    {m.name || m.entityId}
                                                                </span>
                                                                {entityAlertCount > 0 && (
                                                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className="text-[8px] font-black bg-argent/30 text-text-secondary px-1 py-0.5 uppercase">{level}</span>
                                                                <span className="text-[8px] text-text-muted font-mono truncate max-w-[120px]">{m.entityId}</span>
                                                                {cl?.conceptId && <span className="text-[8px] font-black text-classic uppercase truncate max-w-[80px]">{cl.conceptId}</span>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <span className="text-[11px] font-bold text-text-primary font-mono">${m.rolling.spend_7d?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "0.00"}</span>
                                                    </td>
                                                    <td className="p-3 text-right text-[11px] text-text-secondary font-mono">
                                                        {m.rolling.impressions_7d?.toLocaleString() || "-"}
                                                    </td>
                                                    <td className="p-3 text-right text-[11px] font-bold text-text-secondary font-mono">
                                                        {m.rolling.ctr_7d ? `${m.rolling.ctr_7d.toFixed(2)}%` : "-"}
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[11px] font-black text-text-primary font-mono">{m.rolling.hook_rate_7d ? `${m.rolling.hook_rate_7d.toFixed(1)}%` : "-"}</span>
                                                            <DeltaTag val={m.rolling.hook_rate_delta_pct} />
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <IntentBadge stage={cl?.intentStage} />
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <span className="text-[11px] font-black text-text-primary font-mono">
                                                            {m.rolling.cpa_7d ? `$${m.rolling.cpa_7d.toLocaleString(undefined, { maximumFractionDigits: 1 })}` : "-"}
                                                        </span>
                                                    </td>
                                                    {businessType === 'ecommerce' && (
                                                        <td className="p-3 text-right">
                                                            <span className={`text-[11px] font-black font-mono ${(m.rolling.roas_7d || 0) > 2 ? 'text-synced' : 'text-text-primary'}`}>
                                                                {m.rolling.roas_7d ? `${m.rolling.roas_7d.toFixed(2)}x` : "-"}
                                                            </span>
                                                        </td>
                                                    )}
                                                    <td className="p-3 text-center">
                                                        <PhaseTag state={cl?.learningState} />
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <FatigueTag state={cl?.fatigueState} />
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-2">
                                                            <DecisionTag decision={cl?.finalDecision} confidence={cl?.confidenceScore} />
                                                            <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                                                {alerts.filter(a => a.entityId === m.entityId).slice(0, 2).map(a => (
                                                                    <span key={a.id} className={`w-1.5 h-1.5 rounded-full ${a.severity === 'CRITICAL' ? 'bg-red-500' : 'bg-yellow-500'}`} title={a.title} />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[11px] font-black text-text-primary">{cl?.impactScore || 0}</span>
                                                            <div className="w-8 h-1 bg-argent/20 mt-0.5 overflow-hidden">
                                                                <div className="h-full bg-synced" style={{ width: `${cl?.impactScore || 0}%` }} />
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Entity Detail Drawer */}
            {isDrawerOpen && (
                <div className="fixed inset-0 z-[100] flex justify-end">
                    <div className="absolute inset-0 bg-stellar/80 backdrop-blur-md" onClick={() => setIsDrawerOpen(false)} />
                    <div className="relative w-full max-w-2xl bg-second h-full shadow-[-30px_0_80px_rgba(0,0,0,0.5)] border-l border-argent/30 flex flex-col overflow-hidden">
                        <header className="p-8 border-b border-argent/20 bg-special/40 flex justify-between items-start shrink-0">
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <span className="px-2 py-1 bg-classic text-stellar text-[9px] font-black uppercase tracking-widest">{level}</span>
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Diagnostico Operativo</span>
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-text-primary uppercase tracking-tighter leading-tight">{selectedMetrics?.name || selectedEntityId}</h2>
                                    <p className="text-[9px] font-mono text-text-muted mt-1">{selectedEntityId}</p>
                                    {selectedClass?.conceptId && (
                                        <p className="text-[11px] font-black text-classic uppercase mt-2 border-l-2 border-classic/30 pl-2">Concepto: {selectedClass.conceptId}</p>
                                    )}
                                </div>
                            </div>
                            <button onClick={() => setIsDrawerOpen(false)} className="w-10 h-10 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-argent/20 transition-all text-2xl font-light">&times;</button>
                        </header>

                        <div className="flex-1 overflow-y-auto p-8 space-y-10 pb-20">
                            {/* Performance Grid */}
                            <section className="grid grid-cols-2 gap-4">
                                <MetricDetailBox label="Eficiencia" sub="CPA Promedio" curr={selectedMetrics?.rolling.cpa_7d} prev={selectedMetrics?.rolling.cpa_14d} prefix="$" reverse />
                                <MetricDetailBox label="Escalabilidad" sub="Inversion Rolling" curr={selectedMetrics?.rolling.spend_7d} prev={selectedMetrics?.rolling.spend_14d} prefix="$" />
                            </section>

                            {/* Signal Indicators */}
                            <section className="space-y-3">
                                <h3 className="text-[10px] font-black text-text-muted uppercase tracking-widest border-b border-argent/20 pb-2">Senales Operativas</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <SignalCard label="Vel. Conv" value={selectedMetrics?.rolling.conversion_velocity_7d?.toFixed(2)} suffix="/dia" prev={selectedMetrics?.rolling.conversion_velocity_14d} />
                                    <SignalCard label="Frecuencia 7d" value={selectedMetrics?.rolling.frequency_7d?.toFixed(1)} warn={(selectedMetrics?.rolling.frequency_7d || 0) > 4} />
                                    <SignalCard label="Delta Budget 3d" value={selectedMetrics?.rolling.budget_change_3d_pct != null ? `${selectedMetrics.rolling.budget_change_3d_pct.toFixed(0)}%` : undefined} warn={Math.abs(selectedMetrics?.rolling.budget_change_3d_pct || 0) > 30} />
                                    <SignalCard label="Concentracion" value={selectedMetrics?.rolling.spend_top1_ad_pct != null ? `${(selectedMetrics.rolling.spend_top1_ad_pct * 100).toFixed(0)}%` : undefined} warn={(selectedMetrics?.rolling.spend_top1_ad_pct || 0) > 0.6} />
                                </div>
                            </section>

                            {/* Entity Alerts */}
                            {entityAlerts.length > 0 && (
                                <section className="space-y-3">
                                    <h3 className="text-[10px] font-black text-text-muted uppercase tracking-widest border-b border-argent/20 pb-2">
                                        Alertas ({entityAlerts.length})
                                    </h3>
                                    <div className="space-y-2">
                                        {entityAlerts.map((alert) => (
                                            <div key={alert.id} className={`p-3 border ${alert.severity === 'CRITICAL' ? 'bg-red-500/5 border-red-500/20' : alert.severity === 'WARNING' ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-synced/5 border-synced/20'}`}>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-[8px] font-black px-1.5 py-0.5 uppercase ${alert.severity === 'CRITICAL' ? 'bg-red-500 text-white' : alert.severity === 'WARNING' ? 'bg-yellow-500 text-black' : 'bg-synced/20 text-synced'}`}>{alert.severity}</span>
                                                    <span className="text-[10px] font-bold text-text-primary">{alert.title}</span>
                                                </div>
                                                <p className="text-[9px] text-text-muted leading-relaxed">{alert.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Intelligence Rationale */}
                            <section className="space-y-4">
                                <div className="flex justify-between items-end border-b border-argent/20 pb-2">
                                    <h3 className="text-[10px] font-black text-text-muted uppercase tracking-widest">Racional de Inteligencia</h3>
                                    {selectedClass?.confidenceScore !== undefined && (
                                        <span className="text-[9px] font-black text-synced bg-synced/10 px-2 py-0.5 border border-synced/20">
                                            {Math.round(selectedClass.confidenceScore * 100)}% conf
                                        </span>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    {selectedClass?.evidence?.map((fact, i) => (
                                        <div key={i} className="flex gap-3 p-3 bg-special/20 border border-argent/20 hover:border-classic/30 transition-all">
                                            <div className="mt-0.5 w-4 h-4 bg-classic/10 flex items-center justify-center flex-shrink-0">
                                                <div className="w-1.5 h-1.5 bg-classic" />
                                            </div>
                                            <p className="text-[11px] font-bold text-text-primary leading-relaxed">{fact}</p>
                                        </div>
                                    ))}
                                    {!selectedClass?.evidence?.length && (
                                        <div className="p-8 text-center border border-dashed border-argent/20">
                                            <p className="text-[11px] text-text-muted italic">Esperando procesamiento de senales...</p>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* AI Playbook */}
                            <section>
                                <button
                                    onClick={generateRecommendation}
                                    disabled={isGenerating}
                                    className="w-full bg-special border border-argent text-text-primary hover:bg-classic hover:text-stellar font-black py-4 uppercase tracking-widest transition-all flex items-center justify-center gap-3 text-[11px] disabled:opacity-50"
                                >
                                    {isGenerating ? (
                                        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    ) : null}
                                    {isGenerating ? "Generando..." : "Generar AI Operational Playbook"}
                                </button>

                                {recommendation && (
                                    <div className="mt-6 border border-argent/30 p-6 space-y-4">
                                        <div className="flex items-center gap-3 border-b border-argent/20 pb-3">
                                            <div className="w-8 h-8 bg-classic/10 border border-classic/20 flex items-center justify-center text-classic font-black text-[11px]">P</div>
                                            <div>
                                                <h4 className="text-[11px] font-black text-text-primary uppercase tracking-widest">Playbook Estrategico</h4>
                                                <p className="text-[8px] text-text-muted font-black uppercase tracking-widest">GEM High-Intelligence</p>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            {recommendation.actions?.map((act, i) => (
                                                <div key={i} className="flex gap-3 p-3 bg-argent/5 border border-argent/10 hover:border-classic/30 transition-all">
                                                    <span className="flex-shrink-0 w-6 h-6 bg-argent/20 flex items-center justify-center text-[9px] font-black text-text-secondary">0{i + 1}</span>
                                                    <p className="text-[11px] font-bold text-text-primary leading-relaxed">{act}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </section>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}

// ─── Helper Components ─────────────────────────────────────

function SortIcon({ active, direction }: { active: boolean, direction: 'asc' | 'desc' }) {
    return (
        <div className={`flex flex-col -space-y-1 transition-opacity ${active ? 'opacity-100' : 'opacity-20'}`}>
            <span className={`text-[8px] ${active && direction === 'asc' ? 'text-classic' : ''}`}>&#9650;</span>
            <span className={`text-[8px] ${active && direction === 'desc' ? 'text-classic' : ''}`}>&#9660;</span>
        </div>
    );
}

function QualityBadge({ label, value }: { label: string; value?: string }) {
    if (!value) return (
        <div className="p-4 bg-special/20 border border-argent/20 text-center">
            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">{label}</p>
            <p className="text-[11px] font-bold text-text-muted mt-2">{"\u2014"}</p>
        </div>
    );
    const colorClass = value.includes("ABOVE") ? "text-synced" : value === "AVERAGE" ? "text-yellow-400" : "text-red-400";
    const displayValue = value.replace(/_/g, " ");
    return (
        <div className="p-4 bg-special/20 border border-argent/20 text-center hover:border-classic/30 transition-all">
            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">{label}</p>
            <p className={`text-[11px] font-black mt-2 uppercase tracking-widest ${colorClass}`}>{displayValue}</p>
        </div>
    );
}

function DeltaTag({ val }: { val?: number }) {
    if (val === undefined || Math.abs(val) < 0.1) return null;
    const isImproved = val > 0;
    return (
        <span className={`text-[9px] font-black ${isImproved ? 'text-synced' : 'text-red-500'} flex items-center gap-0.5`}>
            {isImproved ? '\u2191' : '\u2193'} {Math.abs(val).toFixed(0)}%
        </span>
    );
}

function IntentBadge({ stage }: { stage?: IntentStage }) {
    if (!stage) return null;
    const stages = { TOFU: 'TOP', MOFU: 'MID', BOFU: 'BTTM' };
    const styles = {
        TOFU: 'bg-argent/30 text-text-secondary border-argent/40',
        MOFU: 'bg-classic/20 text-classic border-classic/40',
        BOFU: 'bg-synced/20 text-synced border-synced/40'
    };
    return (
        <span className={`text-[8px] font-black px-1.5 py-0.5 border ${styles[stage]}`}>
            {stages[stage]}
        </span>
    );
}

function PhaseTag({ state }: { state?: LearningState }) {
    if (!state) return <span className="text-text-muted font-bold text-[10px]">---</span>;
    const config = {
        EXPLORATION: { label: 'EXPLORACION', color: 'text-blue-400' },
        STABILIZING: { label: 'ESTABILIZANDO', color: 'text-purple-400' },
        EXPLOITATION: { label: 'OPTIMIZACION', color: 'text-synced' },
        UNSTABLE: { label: 'INESTABLE', color: 'text-orange-500' }
    };
    return <span className={`text-[9px] font-black uppercase tracking-tighter ${config[state].color}`}>{config[state].label}</span>;
}

function FatigueTag({ state }: { state?: FatigueState }) {
    if (!state || state === 'NONE') return <span className="text-text-muted font-bold text-[10px]">OK</span>;
    const config = {
        REAL: { label: 'FATIGA', color: 'bg-red-500 text-white' },
        CONCEPT_DECAY: { label: 'DECAIMIENTO', color: 'bg-orange-500 text-white' },
        AUDIENCE_SATURATION: { label: 'SATURACION', color: 'bg-yellow-500 text-black' },
        HEALTHY_REPETITION: { label: 'REPETICION', color: 'bg-synced/20 text-synced border border-synced/30' },
        NONE: { label: '', color: '' }
    };
    return <span className={`text-[8px] font-black px-2 py-0.5 uppercase tracking-widest ${config[state].color}`}>{config[state].label}</span>;
}

function DecisionTag({ decision, confidence }: { decision?: FinalDecision, confidence?: number }) {
    if (!decision) return <span className="text-[10px] font-black text-text-muted uppercase">HOLD</span>;
    const labels = {
        SCALE: "ESCALAR",
        ROTATE_CONCEPT: "ROTAR",
        CONSOLIDATE: "CONSOLIDAR",
        INTRODUCE_BOFU_VARIANTS: "UPSELL",
        KILL_RETRY: "ELIMINAR",
        HOLD: "MANTENER"
    };
    const styles = {
        SCALE: "bg-synced text-stellar",
        ROTATE_CONCEPT: "bg-red-500 text-white",
        CONSOLIDATE: "bg-yellow-500 text-black",
        INTRODUCE_BOFU_VARIANTS: "bg-classic text-stellar",
        KILL_RETRY: "bg-red-900 text-white",
        HOLD: "bg-argent/20 text-text-muted"
    };
    return (
        <div className="flex items-center gap-2">
            <span className={`px-2 py-1 font-black text-[9px] uppercase tracking-tighter ${styles[decision]}`}>
                {labels[decision]}
            </span>
            {confidence !== undefined && (
                <span className="text-[8px] font-black text-text-muted">{Math.round(confidence * 100)}%</span>
            )}
        </div>
    );
}

function SignalCard({ label, value, suffix, prev, warn }: { label: string, value?: string, suffix?: string, prev?: number, warn?: boolean }) {
    return (
        <div className={`p-3 border transition-all ${warn ? 'bg-red-500/5 border-red-500/20' : 'bg-special/20 border-argent/20'}`}>
            <p className="text-[8px] font-black text-text-muted uppercase tracking-widest">{label}</p>
            <div className="flex items-baseline gap-1 mt-1">
                <span className={`text-[13px] font-black ${warn ? 'text-red-400' : 'text-text-primary'}`}>{value || "-"}</span>
                {suffix && <span className="text-[9px] text-text-muted">{suffix}</span>}
            </div>
            {prev !== undefined && prev > 0 && value && (
                <p className="text-[8px] text-text-muted mt-0.5">prev: {prev.toFixed(2)}</p>
            )}
        </div>
    );
}

function MetricDetailBox({ label, sub, curr, prev, prefix = "", reverse = false }: any) {
    const delta = prev && prev > 0 ? ((curr - prev) / prev) * 100 : 0;
    const isImproved = reverse ? delta < -2 : delta > 2;
    return (
        <div className="bg-special/40 border border-argent/20 p-5 hover:border-classic/30 transition-all">
            <div className="flex justify-between items-start mb-2">
                <div>
                    <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">{label}</p>
                    <p className="text-[8px] font-bold text-classic uppercase">{sub}</p>
                </div>
                {Math.abs(delta) > 1 && (
                    <span className={`text-[9px] font-black ${isImproved ? 'text-synced' : 'text-red-500'}`}>
                        {delta > 0 ? '\u2191' : '\u2193'} {Math.abs(delta).toFixed(0)}%
                    </span>
                )}
            </div>
            <span className="text-2xl font-black text-text-primary font-mono">{prefix}{curr?.toLocaleString(undefined, { maximumFractionDigits: 1 }) || "0"}</span>
            <div className="mt-3 pt-3 border-t border-argent/10 flex justify-between text-[8px]">
                <div>
                    <p className="font-black text-text-muted uppercase">Previo (14d)</p>
                    <p className="font-black text-text-secondary mt-0.5">{prefix}{prev?.toLocaleString(undefined, { maximumFractionDigits: 1 }) || "-"}</p>
                </div>
                <div className="text-right">
                    <p className="font-black text-text-muted uppercase">Trend</p>
                    <div className="w-10 h-1 bg-argent/20 mt-1 overflow-hidden">
                        <div className={`h-full ${isImproved ? 'bg-synced' : 'bg-red-500'}`} style={{ width: `${Math.min(Math.abs(delta) + 20, 100)}%` }} />
                    </div>
                </div>
            </div>
        </div>
    );
}
