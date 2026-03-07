"use client";

import React, { useEffect, useState, useMemo } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { useClient } from "@/contexts/ClientContext";
import { ChannelDailySnapshot } from "@/types/channel-snapshots";
import { UnifiedDateRange, resolvePreset, getComparisonRange, formatRangeLabel } from "@/lib/date-utils";
import DateRangePicker from "@/components/ui/DateRangePicker";
import ExportMarkdownButton from "@/components/ui/ExportMarkdownButton";
import SlackExportButton from "@/components/slack-export/SlackExportButton";
import { useAnalyst } from "@/contexts/AnalystContext";
import SemaforoWidget from "@/components/semaforo/SemaforoWidget";
import Link from "next/link";

// ── Formatters ───────────────────────────────────────
function formatNumber(value: number, decimals = 0): string {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(decimals > 0 ? decimals : 2)}K`;
    return value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

function formatCurrency(value: number): string {
    return `$${formatNumber(value, 2)}`;
}

function formatPct(value: number): string {
    return `${value.toFixed(1)}%`;
}

// ── Delta Badge ──────────────────────────────────────
function DeltaBadge({ current, previous, isInverse }: { current: number; previous: number; isInverse?: boolean }) {
    if (previous === 0 && current === 0) return null;
    if (previous === 0) return null; // no comparison baseline

    const pctChange = ((current - previous) / previous) * 100;
    const isPositive = pctChange >= 0;
    const isGood = isInverse ? !isPositive : isPositive;

    return (
        <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-black ml-2 ${isGood ? "bg-synced/10 text-synced" : "bg-red-500/10 text-red-500"}`}>
            {isPositive ? "+" : ""}{pctChange.toFixed(1)}%
        </span>
    );
}

function DeltaRow({ label, value, prevValue, formatted, isInverse, color }: {
    label: string;
    value: number;
    prevValue: number;
    formatted: string;
    isInverse?: boolean;
    color?: string;
}) {
    return (
        <div className="flex justify-between items-center text-[10px]">
            <span className="text-text-muted">{label}</span>
            <span className="flex items-center">
                <span className={`font-mono ${color || "text-text-primary"}`}>{formatted}</span>
                <DeltaBadge current={value} previous={prevValue} isInverse={isInverse} />
            </span>
        </div>
    );
}


// ── Types ────────────────────────────────────────────
interface ChannelSummary {
    channel: string;
    label: string;
    href: string;
    spend: number;
    revenue: number;
    conversions: number;
    roas: number;
    days: number;
    sent?: number;
    delivered?: number;
    opens?: number;
    openRate?: number;
    emailClicks?: number;
    emailRevenue?: number;
    orders?: number;
    aov?: number;
    // GA4
    sessions?: number;
    totalUsers?: number;
    bounceRate?: number;
    avgSessionDuration?: number;
}

function aggregateChannels(channelData: Record<string, ChannelDailySnapshot[]>): ChannelSummary[] {
    const summaries: ChannelSummary[] = [];

    const metaSnaps = channelData["META"] || [];
    if (metaSnaps.length > 0) {
        const spend = metaSnaps.reduce((s, x) => s + (x.metrics.spend || 0), 0);
        const revenue = metaSnaps.reduce((s, x) => s + (x.metrics.revenue || 0), 0);
        const conversions = metaSnaps.reduce((s, x) => s + (x.metrics.conversions || 0), 0);
        summaries.push({
            channel: "META", label: "Meta Ads", href: "/creative",
            spend, revenue, conversions,
            roas: spend > 0 ? revenue / spend : 0,
            days: metaSnaps.length,
        });
    }

    const googleSnaps = channelData["GOOGLE"] || [];
    if (googleSnaps.length > 0) {
        const spend = googleSnaps.reduce((s, x) => s + (x.metrics.spend || 0), 0);
        const revenue = googleSnaps.reduce((s, x) => s + (x.metrics.revenue || 0), 0);
        const conversions = googleSnaps.reduce((s, x) => s + (x.metrics.conversions || 0), 0);
        summaries.push({
            channel: "GOOGLE", label: "Google Ads", href: "/google-ads",
            spend, revenue, conversions,
            roas: spend > 0 ? revenue / spend : 0,
            days: googleSnaps.length,
        });
    }

    const ecomSnaps = channelData["ECOMMERCE"] || [];
    if (ecomSnaps.length > 0) {
        const revenue = ecomSnaps.reduce((s, x) => s + (x.metrics.revenue || 0), 0);
        const orders = ecomSnaps.reduce((s, x) => s + (x.metrics.orders || 0), 0);
        summaries.push({
            channel: "ECOMMERCE", label: "Ecommerce", href: "/ecommerce",
            spend: 0, revenue, conversions: orders,
            roas: 0, days: ecomSnaps.length,
            orders, aov: orders > 0 ? revenue / orders : 0,
        });
    }

    const emailSnaps = channelData["EMAIL"] || [];
    if (emailSnaps.length > 0) {
        const sent = emailSnaps.reduce((s, x) => s + (x.metrics.sent || 0), 0);
        const delivered = emailSnaps.reduce((s, x) => s + (x.metrics.delivered || 0), 0);
        const opens = emailSnaps.reduce((s, x) => s + (x.metrics.opens || 0), 0);
        const emailClicks = emailSnaps.reduce((s, x) => s + (x.metrics.emailClicks || 0), 0);
        const emailRevenue = emailSnaps.reduce((s, x) => s + (x.metrics.emailRevenue || 0), 0);
        const openRate = delivered > 0 ? (opens / delivered) * 100 : 0;
        summaries.push({
            channel: "EMAIL", label: "Email", href: "/email",
            spend: 0, revenue: emailRevenue, conversions: sent,
            roas: 0, days: emailSnaps.length,
            sent, delivered, opens, openRate, emailClicks, emailRevenue,
        });
    }

    const ga4Snaps = channelData["GA4"] || [];
    if (ga4Snaps.length > 0) {
        const sessions = ga4Snaps.reduce((s, x) => s + (x.metrics.sessions || 0), 0);
        const totalUsers = ga4Snaps.reduce((s, x) => s + (x.metrics.totalUsers || 0), 0);
        const totalBounce = ga4Snaps.reduce((s, x) => s + (x.metrics.bounceRate || 0) * (x.metrics.sessions || 0), 0);
        const bounceRate = sessions > 0 ? totalBounce / sessions : 0;
        const totalDuration = ga4Snaps.reduce((s, x) => s + (x.metrics.avgSessionDuration || 0) * (x.metrics.sessions || 0), 0);
        const avgSessionDuration = sessions > 0 ? totalDuration / sessions : 0;
        summaries.push({
            channel: "GA4", label: "GA4", href: "/ga4",
            spend: 0, revenue: 0, conversions: 0,
            roas: 0, days: ga4Snaps.length,
            sessions, totalUsers, bounceRate, avgSessionDuration,
        });
    }

    return summaries;
}

function fetchChannels(clientId: string, startDate: string, endDate: string): Promise<Record<string, ChannelDailySnapshot[]>> {
    const channels = ["META", "GOOGLE", "ECOMMERCE", "EMAIL", "GA4"];
    return Promise.all(
        channels.map(ch =>
            fetch(`/api/channel-snapshots?clientId=${clientId}&channel=${ch}&startDate=${startDate}&endDate=${endDate}`)
                .then(res => res.json())
                .then(data => ({ channel: ch, snapshots: (data.snapshots || []) as ChannelDailySnapshot[] }))
                .catch(() => ({ channel: ch, snapshots: [] as ChannelDailySnapshot[] }))
        )
    ).then(results => {
        const map: Record<string, ChannelDailySnapshot[]> = {};
        for (const r of results) map[r.channel] = r.snapshots;
        return map;
    });
}

// ── Component ────────────────────────────────────────
export default function OverviewDashboard() {
    const { selectedClientId: clientId } = useClient();
    const { openAnalyst } = useAnalyst();
    const [channelData, setChannelData] = useState<Record<string, ChannelDailySnapshot[]>>({});
    const [prevChannelData, setPrevChannelData] = useState<Record<string, ChannelDailySnapshot[]>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [dateRange, setDateRange] = useState<UnifiedDateRange>(() => resolvePreset("mtd"));
    const [compareRange, setCompareRange] = useState<UnifiedDateRange | null>(() => getComparisonRange(resolvePreset("mtd")));

    useEffect(() => {
        if (!clientId) return;
        setIsLoading(true);

        const fetches = [fetchChannels(clientId, dateRange.start, dateRange.end)];
        if (compareRange) {
            fetches.push(fetchChannels(clientId, compareRange.start, compareRange.end));
        }

        Promise.all(fetches).then(([current, previous]) => {
            setChannelData(current);
            setPrevChannelData(previous || {});
            setIsLoading(false);
        });
    }, [clientId, dateRange.start, dateRange.end, compareRange?.start, compareRange?.end]);

    // ── Current period aggregation ───────────────────
    const summaries = useMemo(() => aggregateChannels(channelData), [channelData]);
    const prevSummaries = useMemo(() => aggregateChannels(prevChannelData), [prevChannelData]);

    // Helper to find previous channel summary
    const prev = (channel: string): ChannelSummary | undefined => prevSummaries.find(s => s.channel === channel);

    // ── Cross-channel totals ─────────────────────────
    const adChannels = summaries.filter(s => s.channel === "META" || s.channel === "GOOGLE");
    const prevAdChannels = prevSummaries.filter(s => s.channel === "META" || s.channel === "GOOGLE");

    const totalAdSpend = adChannels.reduce((t, s) => t + s.spend, 0);
    const totalAdRevenue = adChannels.reduce((t, s) => t + s.revenue, 0);
    const totalAdConversions = adChannels.reduce((t, s) => t + s.conversions, 0);
    const totalEcomRevenue = summaries.find(s => s.channel === "ECOMMERCE")?.revenue || 0;
    const blendedRoas = totalAdSpend > 0 ? totalAdRevenue / totalAdSpend : 0;
    const blendedCpa = totalAdConversions > 0 ? totalAdSpend / totalAdConversions : 0;

    const prevTotalAdSpend = prevAdChannels.reduce((t, s) => t + s.spend, 0);
    const prevTotalAdRevenue = prevAdChannels.reduce((t, s) => t + s.revenue, 0);
    const prevTotalAdConversions = prevAdChannels.reduce((t, s) => t + s.conversions, 0);
    const prevTotalEcomRevenue = prevSummaries.find(s => s.channel === "ECOMMERCE")?.revenue || 0;
    const prevBlendedRoas = prevTotalAdSpend > 0 ? prevTotalAdRevenue / prevTotalAdSpend : 0;
    const prevBlendedCpa = prevTotalAdConversions > 0 ? prevTotalAdSpend / prevTotalAdConversions : 0;

    return (
        <AppLayout>
            <div className="space-y-8 pb-20">
                {/* Header + Period Selector */}
                <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-text-primary uppercase tracking-tighter">
                            Overview
                        </h1>
                        <p className="text-small text-text-muted font-bold uppercase tracking-widest mt-1">
                            Vista unificada &bull; {formatRangeLabel(dateRange)}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {clientId && <SlackExportButton clientId={clientId} channelId="cross_channel" startDate={dateRange.start} endDate={dateRange.end} />}
                        {clientId && <ExportMarkdownButton clientId={clientId} channelId="cross_channel" startDate={dateRange.start} endDate={dateRange.end} />}
                        <button onClick={() => openAnalyst('cross_channel')} className="px-3 py-2 bg-classic text-stellar font-black text-[10px] uppercase tracking-widest hover:bg-classic/90 transition-all whitespace-nowrap">
                            Analizar con IA
                        </button>
                        <DateRangePicker
                            value={dateRange}
                            onChange={setDateRange}
                            enableCompare
                            compareValue={compareRange}
                            onCompareChange={setCompareRange}
                        />
                    </div>
                </header>

                {isLoading && (
                    <div className="card p-12 flex items-center justify-center">
                        <div className="animate-spin w-6 h-6 border-2 border-classic border-t-transparent" />
                        <span className="ml-3 text-text-muted text-small">Cargando datos...</span>
                    </div>
                )}

                {!isLoading && (
                    <>
                        {/* Semaforo Widget */}
                        <SemaforoWidget />

                        {/* Cross-Channel KPIs */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="card p-5 hover:border-classic/30 transition-all">
                                <div className="flex justify-between items-start mb-2">
                                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                                        Inversion Publicitaria
                                    </p>
                                    <DeltaBadge current={totalAdSpend} previous={prevTotalAdSpend} />
                                </div>
                                <p className="text-2xl font-black font-mono text-text-primary">
                                    {formatCurrency(totalAdSpend)}
                                </p>
                                <p className="text-[10px] text-text-muted mt-1">
                                    {adChannels.map(c => c.label).join(" + ") || "Sin ads"}
                                </p>
                            </div>

                            <div className="card p-5 hover:border-classic/30 transition-all">
                                <div className="flex justify-between items-start mb-2">
                                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                                        Revenue Ads
                                    </p>
                                    <DeltaBadge current={totalAdRevenue} previous={prevTotalAdRevenue} />
                                </div>
                                <p className="text-2xl font-black font-mono text-synced">
                                    {formatCurrency(totalAdRevenue)}
                                </p>
                                <p className="text-[10px] text-text-muted mt-1">Atribuido a ads</p>
                            </div>

                            {totalEcomRevenue > 0 && (
                                <div className="card p-5 hover:border-classic/30 transition-all">
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                                            Revenue Ecommerce
                                        </p>
                                        <DeltaBadge current={totalEcomRevenue} previous={prevTotalEcomRevenue} />
                                    </div>
                                    <p className="text-2xl font-black font-mono text-classic">
                                        {formatCurrency(totalEcomRevenue)}
                                    </p>
                                    <p className="text-[10px] text-text-muted mt-1">Fuente de verdad (Tienda)</p>
                                </div>
                            )}

                            <div className="card p-5 hover:border-classic/30 transition-all">
                                <div className="flex justify-between items-start mb-2">
                                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                                        Blended ROAS
                                    </p>
                                    <DeltaBadge current={blendedRoas} previous={prevBlendedRoas} />
                                </div>
                                <p className={`text-2xl font-black font-mono ${blendedRoas >= 3 ? "text-synced" : blendedRoas >= 2 ? "text-classic" : "text-red-400"}`}>
                                    {blendedRoas > 0 ? `${blendedRoas.toFixed(2)}x` : "\u2014"}
                                </p>
                                <p className="text-[10px] text-text-muted mt-1">Ad Revenue / Ad Spend</p>
                            </div>

                            {blendedCpa > 0 && (
                                <div className="card p-5 hover:border-classic/30 transition-all">
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                                            CPA Blended
                                        </p>
                                        <DeltaBadge current={blendedCpa} previous={prevBlendedCpa} isInverse />
                                    </div>
                                    <p className="text-2xl font-black font-mono text-text-primary">
                                        {formatCurrency(blendedCpa)}
                                    </p>
                                    <p className="text-[10px] text-text-muted mt-1">
                                        {formatNumber(totalAdConversions)} conversiones
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Channel Cards */}
                        {summaries.length > 0 && (
                            <div className="card p-6">
                                <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                    Canales Activos
                                </h2>
                                <div className={`grid grid-cols-1 md:grid-cols-2 ${summaries.length > 4 ? "lg:grid-cols-5" : "lg:grid-cols-4"} gap-4`}>
                                    {summaries.map(s => {
                                        const p = prev(s.channel);
                                        return (
                                            <Link key={s.channel} href={s.href} className="block">
                                                <div className="border border-argent/50 p-4 hover:border-classic/30 transition-all cursor-pointer">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <span className="text-[11px] font-black text-text-primary uppercase tracking-widest">
                                                            {s.label}
                                                        </span>
                                                        <span className="text-[9px] text-text-muted font-mono">{s.days}d</span>
                                                    </div>

                                                    {(s.channel === "META" || s.channel === "GOOGLE") && (
                                                        <div className="space-y-2">
                                                            <DeltaRow label="Spend" value={s.spend} prevValue={p?.spend || 0} formatted={formatCurrency(s.spend)} />
                                                            <DeltaRow label="Revenue" value={s.revenue} prevValue={p?.revenue || 0} formatted={formatCurrency(s.revenue)} color="text-synced" />
                                                            <DeltaRow
                                                                label="ROAS" value={s.roas} prevValue={p?.roas || 0}
                                                                formatted={`${s.roas.toFixed(2)}x`}
                                                                color={s.roas >= 3 ? "text-synced" : s.roas >= 2 ? "text-classic" : "text-red-400"}
                                                            />
                                                            <DeltaRow label="Conversiones" value={s.conversions} prevValue={p?.conversions || 0} formatted={formatNumber(s.conversions)} />
                                                        </div>
                                                    )}

                                                    {s.channel === "ECOMMERCE" && (
                                                        <div className="space-y-2">
                                                            <DeltaRow label="Revenue" value={s.revenue} prevValue={p?.revenue || 0} formatted={formatCurrency(s.revenue)} color="text-synced" />
                                                            <DeltaRow label="Ordenes" value={s.orders || 0} prevValue={p?.orders || 0} formatted={formatNumber(s.orders || 0)} />
                                                            <DeltaRow label="AOV" value={s.aov || 0} prevValue={p?.aov || 0} formatted={s.aov ? formatCurrency(s.aov) : "\u2014"} />
                                                        </div>
                                                    )}

                                                    {s.channel === "EMAIL" && (
                                                        <div className="space-y-2">
                                                            <DeltaRow label="Enviados" value={s.sent || 0} prevValue={p?.sent || 0} formatted={formatNumber(s.sent || 0)} />
                                                            <DeltaRow
                                                                label="Open Rate" value={s.openRate || 0} prevValue={p?.openRate || 0}
                                                                formatted={formatPct(s.openRate || 0)}
                                                                color={(s.openRate || 0) > 20 ? "text-synced" : undefined}
                                                            />
                                                            <DeltaRow label="Entregados" value={s.delivered || 0} prevValue={p?.delivered || 0} formatted={formatNumber(s.delivered || 0)} />
                                                            {(s.emailRevenue || 0) > 0 && (
                                                                <DeltaRow label="Revenue" value={s.emailRevenue || 0} prevValue={p?.emailRevenue || 0} formatted={formatCurrency(s.emailRevenue || 0)} color="text-synced" />
                                                            )}
                                                        </div>
                                                    )}

                                                    {s.channel === "GA4" && (
                                                        <div className="space-y-2">
                                                            <DeltaRow label="Sessions" value={s.sessions || 0} prevValue={p?.sessions || 0} formatted={formatNumber(s.sessions || 0)} />
                                                            <DeltaRow label="Users" value={s.totalUsers || 0} prevValue={p?.totalUsers || 0} formatted={formatNumber(s.totalUsers || 0)} />
                                                            <DeltaRow label="Bounce Rate" value={s.bounceRate || 0} prevValue={p?.bounceRate || 0} formatted={formatPct(s.bounceRate || 0)} isInverse />
                                                            <DeltaRow label="Avg Duration" value={s.avgSessionDuration || 0} prevValue={p?.avgSessionDuration || 0} formatted={`${Math.round(s.avgSessionDuration || 0)}s`} />
                                                        </div>
                                                    )}
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {summaries.length === 0 && (
                            <div className="card p-12 border-dashed flex flex-col items-center gap-3">
                                <p className="text-text-muted text-small">No hay datos de canales para este periodo.</p>
                                <p className="text-[10px] text-text-muted">
                                    Ejecuta los crons de sync para comenzar a recopilar datos.
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </AppLayout>
    );
}
