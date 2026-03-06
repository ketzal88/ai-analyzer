"use client";

import React, { useEffect, useState } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { useClient } from "@/contexts/ClientContext";
import { ChannelDailySnapshot } from "@/types/channel-snapshots";
import { UnifiedDateRange, resolvePreset, formatRangeLabel, getComparisonRange } from "@/lib/date-utils";
import DateRangePicker from "@/components/ui/DateRangePicker";
import KPICard, { calcDelta } from "@/components/ui/KPICard";
import { useAnalyst } from "@/contexts/AnalystContext";

function formatNumber(value: number | undefined, decimals = 0): string {
    if (value === undefined || value === null) return "—";
    return value.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

function formatCurrency(value: number | undefined): string {
    if (value === undefined || value === null) return "—";
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
}

function formatPct(value: number | undefined): string {
    if (value === undefined || value === null) return "—";
    return `${value.toFixed(1)}%`;
}

function formatDate(dateStr: string): string {
    const [y, m, d] = dateStr.split("-");
    const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    return `${parseInt(d)} ${months[parseInt(m) - 1]}`;
}


const AUTOMATION_TYPE_LABELS: Record<string, string> = {
    abandoned_cart: "Carrito Abandonado",
    welcome: "Bienvenida",
    visit_recovery: "Remarketing Visita",
    loyalty: "Fidelización",
    coupon: "Cupón",
    other: "Otro",
};


export default function EmailChannel() {
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
            fetch(`/api/channel-snapshots?clientId=${clientId}&channel=EMAIL&startDate=${dateRange.start}&endDate=${dateRange.end}`).then(r => r.json()),
            fetch(`/api/channel-snapshots?clientId=${clientId}&channel=EMAIL&startDate=${compRange.start}&endDate=${compRange.end}`).then(r => r.json()),
        ])
            .then(([curr, prev]) => {
                setSnapshots(curr.snapshots || []);
                setPrevSnapshots(prev.snapshots || []);
            })
            .catch(err => setError(err.message))
            .finally(() => setIsLoading(false));
    }, [clientId, dateRange.start, dateRange.end]);

    // Aggregate totals
    const totals = snapshots.reduce(
        (acc, s) => ({
            sent: acc.sent + (s.metrics.sent || 0),
            delivered: acc.delivered + (s.metrics.delivered || 0),
            opens: acc.opens + (s.metrics.opens || 0),
            clicks: acc.clicks + (s.metrics.emailClicks || 0),
            bounces: acc.bounces + (s.metrics.bounces || 0),
            unsubscribes: acc.unsubscribes + (s.metrics.unsubscribes || 0),
            revenue: acc.revenue + (s.metrics.emailRevenue || 0),
            conversions: acc.conversions + (s.metrics.conversions || 0),
        }),
        { sent: 0, delivered: 0, opens: 0, clicks: 0, bounces: 0, unsubscribes: 0, revenue: 0, conversions: 0 }
    );

    const openRate = totals.delivered > 0 ? (totals.opens / totals.delivered) * 100 : 0;
    const clickRate = totals.delivered > 0 ? (totals.clicks / totals.delivered) * 100 : 0;
    const bounceRate = totals.sent > 0 ? (totals.bounces / totals.sent) * 100 : 0;
    const conversionRate = totals.opens > 0 ? (totals.conversions / totals.opens) * 1000 : 0;
    const ctor = totals.opens > 0 ? (totals.clicks / totals.opens) * 100 : 0;
    const revenuePerRecipient = totals.sent > 0 ? totals.revenue / totals.sent : 0;

    // Previous period totals
    const prevTotals = prevSnapshots.reduce(
        (acc, s) => ({
            sent: acc.sent + (s.metrics.sent || 0),
            delivered: acc.delivered + (s.metrics.delivered || 0),
            opens: acc.opens + (s.metrics.opens || 0),
            clicks: acc.clicks + (s.metrics.emailClicks || 0),
            bounces: acc.bounces + (s.metrics.bounces || 0),
            unsubscribes: acc.unsubscribes + (s.metrics.unsubscribes || 0),
            revenue: acc.revenue + (s.metrics.emailRevenue || 0),
            conversions: acc.conversions + (s.metrics.conversions || 0),
        }),
        { sent: 0, delivered: 0, opens: 0, clicks: 0, bounces: 0, unsubscribes: 0, revenue: 0, conversions: 0 }
    );
    const prevOpenRate = prevTotals.delivered > 0 ? (prevTotals.opens / prevTotals.delivered) * 100 : 0;
    const prevClickRate = prevTotals.delivered > 0 ? (prevTotals.clicks / prevTotals.delivered) * 100 : 0;
    const prevBounceRate = prevTotals.sent > 0 ? (prevTotals.bounces / prevTotals.sent) * 100 : 0;
    const prevConversionRate = prevTotals.opens > 0 ? (prevTotals.conversions / prevTotals.opens) * 1000 : 0;
    const prevCtor = prevTotals.opens > 0 ? (prevTotals.clicks / prevTotals.opens) * 100 : 0;
    const prevRevenuePerRecipient = prevTotals.sent > 0 ? prevTotals.revenue / prevTotals.sent : 0;

    // Detect source from rawData
    const source: 'perfit' | 'klaviyo' | null = snapshots[0]?.rawData?.source === 'klaviyo' ? 'klaviyo'
        : snapshots[0]?.rawData?.source === 'perfit' ? 'perfit' : null;

    // Collect all campaigns from all snapshots (dedupe by id)
    const allCampaigns: any[] = [];
    const seenIds = new Set<string>();
    for (const s of snapshots) {
        const campaigns = (s.rawData?.campaigns as any[]) || [];
        for (const c of campaigns) {
            const key = String(c.id || c.campaignId);
            if (!seenIds.has(key)) {
                seenIds.add(key);
                allCampaigns.push(c);
            }
        }
    }
    // Sort by launchDate/sendTime desc
    allCampaigns.sort((a, b) => (b.launchDate || b.sendTime || "").localeCompare(a.launchDate || a.sendTime || ""));

    // Automations/Flows — deduplicate flows by flowId (aggregate stats)
    const automations = (snapshots[0]?.rawData?.automations as any[]) || [];
    const rawFlows = (snapshots[0]?.rawData?.flows as any[]) || [];
    const flowMap = new Map<string, any>();
    for (const f of rawFlows) {
        const existing = flowMap.get(f.flowId);
        if (existing) {
            existing.recipients += f.recipients || 0;
            existing.opens += f.opens || 0;
            existing.clicks += f.clicks || 0;
            existing.revenue += f.revenue || 0;
            existing.conversions += f.conversions || 0;
        } else {
            flowMap.set(f.flowId, { ...f });
        }
    }
    const flows = Array.from(flowMap.values());
    const automationTotals = (snapshots[0]?.rawData?.automationTotals as any) || {};
    const flowTotals = (snapshots[0]?.rawData?.flowTotals as any) || {};
    const accountInfo = (snapshots[0]?.rawData?.account as any) || null;

    const sourceName = source === 'klaviyo' ? 'Klaviyo' : 'Perfit';

    return (
        <AppLayout>
            <div className="space-y-8 pb-20">
                <header className="flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-text-primary uppercase tracking-tighter">
                            Email Marketing
                        </h1>
                        <p className="text-small text-text-muted font-bold uppercase tracking-widest mt-1">
                            {sourceName} &bull; {formatRangeLabel(dateRange)}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <DateRangePicker value={dateRange} onChange={setDateRange} />
                        <button onClick={() => openAnalyst('email')} className="px-3 py-2 bg-classic text-stellar font-black text-[10px] uppercase tracking-widest hover:bg-classic/90 transition-all whitespace-nowrap">Analizar con IA</button>
                        {accountInfo && (
                            <div className="text-right">
                                <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">
                                    {accountInfo.name}
                                </p>
                                <p className="text-[11px] text-text-secondary font-mono">
                                    {formatNumber(accountInfo.activeContacts)} / {formatNumber(accountInfo.contactLimit)} contactos
                                </p>
                            </div>
                        )}
                    </div>
                </header>

                {isLoading && (
                    <div className="card p-12 flex items-center justify-center">
                        <div className="animate-spin w-6 h-6 border-2 border-classic border-t-transparent" />
                        <span className="ml-3 text-text-muted text-small">Cargando datos de email...</span>
                    </div>
                )}

                {error && (
                    <div className="card p-6 border-red-500/30">
                        <p className="text-red-400 text-small">{error}</p>
                    </div>
                )}

                {!isLoading && !error && snapshots.length === 0 && (
                    <div className="card p-12 border-dashed flex flex-col items-center gap-3">
                        <p className="text-text-muted text-small">No hay datos de email para este cliente.</p>
                    </div>
                )}

                {!isLoading && !error && snapshots.length > 0 && (
                    <>
                        {/* KPI Grid */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <KPICard
                                label="Enviados"
                                value={formatNumber(totals.sent)}
                                subtitle={`${formatNumber(totals.delivered)} entregados`}
                                delta={calcDelta(totals.sent, prevTotals.sent)}
                            />
                            <KPICard
                                label="Tasa de Apertura"
                                value={formatPct(openRate)}
                                subtitle={`${formatNumber(totals.opens)} aperturas`}
                                color={openRate > 20 ? "text-synced" : openRate > 10 ? "text-classic" : "text-red-400"}
                                delta={calcDelta(openRate, prevOpenRate)}
                            />
                            <KPICard
                                label="Tasa de Click"
                                value={formatPct(clickRate)}
                                subtitle={`${formatNumber(totals.clicks)} clicks`}
                                color={clickRate > 3 ? "text-synced" : "text-text-primary"}
                                delta={calcDelta(clickRate, prevClickRate)}
                            />
                            <KPICard
                                label="Revenue Campañas"
                                value={formatCurrency(totals.revenue)}
                                subtitle={`${formatNumber(totals.conversions)} ventas asistidas`}
                                color="text-synced"
                                delta={calcDelta(totals.revenue, prevTotals.revenue)}
                            />
                        </div>

                        {/* KPI Row 2 - Engagement Quality */}
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                            <KPICard
                                label="CTOR"
                                value={formatPct(ctor)}
                                subtitle="Click-to-Open Rate"
                                color={ctor > 15 ? "text-synced" : "text-text-primary"}
                                delta={calcDelta(ctor, prevCtor)}
                            />
                            <KPICard
                                label="Revenue / Recipient"
                                value={formatCurrency(revenuePerRecipient)}
                                subtitle="Revenue por envio"
                                delta={calcDelta(revenuePerRecipient, prevRevenuePerRecipient)}
                            />
                            {totals.unsubscribes > 0 && (
                                <KPICard
                                    label="Unsubscribes"
                                    value={formatNumber(totals.unsubscribes)}
                                    subtitle={`${formatPct(totals.sent > 0 ? (totals.unsubscribes / totals.sent) * 100 : 0)} del total`}
                                    color={totals.unsubscribes > 100 ? "text-red-400" : "text-text-primary"}
                                />
                            )}
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <KPICard
                                label="Bounces"
                                value={formatPct(bounceRate)}
                                subtitle={`${formatNumber(totals.bounces)} rebotes`}
                                color={bounceRate > 5 ? "text-red-400" : "text-text-primary"}
                                delta={calcDelta(bounceRate, prevBounceRate)}
                                deltaInverse
                            />
                            <KPICard
                                label="Tasa de Conversión"
                                value={`${conversionRate.toFixed(2)}‰`}
                                subtitle="ventas / 1000 aperturas"
                                delta={calcDelta(conversionRate, prevConversionRate)}
                            />
                            {/* Perfit automation totals */}
                            {automationTotals.totalConverted !== undefined && (
                                <KPICard
                                    label="Revenue Automations"
                                    value={formatCurrency(automationTotals.totalConvertedAmount)}
                                    subtitle={`${formatNumber(automationTotals.totalConverted)} ventas (lifetime)`}
                                    color="text-classic"
                                />
                            )}
                            {automationTotals.totalTriggered !== undefined && (
                                <KPICard
                                    label="Automations Triggered"
                                    value={formatNumber(automationTotals.totalTriggered)}
                                    subtitle={`${formatNumber(automationTotals.totalCompleted)} completados`}
                                />
                            )}
                            {/* Klaviyo flow totals */}
                            {flowTotals.totalRevenue !== undefined && flowTotals.totalRevenue > 0 && (
                                <KPICard
                                    label="Revenue Flows"
                                    value={formatCurrency(flowTotals.totalRevenue)}
                                    subtitle={`${formatNumber(flowTotals.totalConversions)} conversiones`}
                                    color="text-classic"
                                />
                            )}
                            {flowTotals.totalRecipients !== undefined && flowTotals.totalRecipients > 0 && (
                                <KPICard
                                    label="Flows Enviados"
                                    value={formatNumber(flowTotals.totalRecipients)}
                                />
                            )}
                        </div>

                        {/* Automations */}
                        {automations.length > 0 && (
                            <div className="card p-6">
                                <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                    Automations
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {automations.filter((a: any) => a.enabled).map((a: any) => (
                                        <div key={a.id} className="card p-4 border-classic/10">
                                            <div className="flex items-start justify-between mb-2">
                                                <p className="text-[11px] font-bold text-text-primary truncate max-w-[200px]">
                                                    {a.name}
                                                </p>
                                                <span className="text-[9px] px-1.5 py-0.5 bg-synced/20 text-synced rounded font-bold uppercase">
                                                    activa
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-text-muted mb-3">
                                                {AUTOMATION_TYPE_LABELS[a.type] || a.type}
                                            </p>
                                            <div className="grid grid-cols-3 gap-2 text-center">
                                                <div>
                                                    <p className="text-[16px] font-black font-mono text-text-primary">{formatNumber(a.triggered)}</p>
                                                    <p className="text-[9px] text-text-muted">triggered</p>
                                                </div>
                                                <div>
                                                    <p className="text-[16px] font-black font-mono text-synced">{formatNumber(a.converted)}</p>
                                                    <p className="text-[9px] text-text-muted">ventas</p>
                                                </div>
                                                <div>
                                                    <p className="text-[16px] font-black font-mono text-classic">{formatCurrency(a.convertedAmount)}</p>
                                                    <p className="text-[9px] text-text-muted">revenue</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Klaviyo Flows */}
                        {flows.length > 0 && (
                            <div className="card p-6">
                                <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                    Flows ({flows.length})
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {flows.map((f: any) => {
                                        const flowOpenRate = f.recipients > 0 ? (f.opens / f.recipients) * 100 : 0;
                                        const flowClickRate = f.recipients > 0 ? (f.clicks / f.recipients) * 100 : 0;
                                        return (
                                            <div key={f.flowId} className="card p-4 border-classic/10">
                                                <div className="flex items-start justify-between mb-2">
                                                    <p className="text-[11px] font-bold text-text-primary truncate max-w-[200px]">
                                                        {f.flowName}
                                                    </p>
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                                        f.status === "live" ? "bg-synced/20 text-synced" : "bg-argent/20 text-text-muted"
                                                    }`}>
                                                        {f.status}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-5 gap-2 text-center">
                                                    <div>
                                                        <p className="text-[14px] font-black font-mono text-text-primary">{formatNumber(f.recipients)}</p>
                                                        <p className="text-[9px] text-text-muted">enviados</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[14px] font-black font-mono text-text-primary">{formatPct(flowOpenRate)}</p>
                                                        <p className="text-[9px] text-text-muted">open rate</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[14px] font-black font-mono text-text-primary">{formatPct(flowClickRate)}</p>
                                                        <p className="text-[9px] text-text-muted">click rate</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[14px] font-black font-mono text-synced">{formatNumber(f.conversions)}</p>
                                                        <p className="text-[9px] text-text-muted">ventas</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[14px] font-black font-mono text-classic">{formatCurrency(f.revenue)}</p>
                                                        <p className="text-[9px] text-text-muted">revenue</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Campaign Table */}
                        {allCampaigns.length > 0 && (
                            <div className="card p-6">
                                <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                    Campañas ({allCampaigns.length})
                                </h2>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-argent/50">
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest">Campaña</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest">Fecha</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Envíos</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Aperturas</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Clicks</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Rebotes</th>
                                                <th className="p-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Ventas</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {allCampaigns.map((c: any) => {
                                                const name = c.name || c.campaignName || "";
                                                const date = c.launchDate || c.sendTime || "";
                                                const sent = c.sent || c.recipients || 0;
                                                const or_ = c.openRate || 0;
                                                const cr_ = c.clickRate || 0;
                                                const br_ = c.bounceRate || 0;
                                                const rev = c.conversionsAmount || c.revenue || 0;
                                                const conv = c.conversions || 0;
                                                return (
                                                <tr key={c.id || c.campaignId} className="border-b border-argent/10 hover:bg-classic/[0.03]">
                                                    <td className="p-3 max-w-[280px]">
                                                        <div className="flex items-start gap-2">
                                                            {source === 'perfit' && c.thumbnail && (
                                                                <img
                                                                    src={c.thumbnail}
                                                                    alt=""
                                                                    className="w-10 h-10 object-cover rounded shrink-0 border border-argent/30"
                                                                    loading="lazy"
                                                                />
                                                            )}
                                                            <div className="min-w-0">
                                                                <p className="text-[11px] text-text-primary font-medium truncate">{name}</p>
                                                                {c.subject && c.subject !== name && (
                                                                    <p className="text-[10px] text-text-muted truncate">{c.subject}</p>
                                                                )}
                                                                {source === 'perfit' && c.tags && (c.tags as string[]).length > 0 && (
                                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                                        {(c.tags as string[]).map((tag: string) => (
                                                                            <span
                                                                                key={tag}
                                                                                className="text-[8px] px-1.5 py-0.5 bg-classic/10 text-classic rounded font-bold uppercase"
                                                                            >
                                                                                {tag}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-[11px] text-text-muted font-mono whitespace-nowrap">
                                                        {date ? formatDate(date.split("T")[0]) : "—"}
                                                    </td>
                                                    <td className="p-3 text-[11px] text-text-secondary font-mono text-right">{formatNumber(sent)}</td>
                                                    <td className="p-3 text-[11px] font-mono text-right">
                                                        <span className="text-text-secondary">{formatPct(or_)}</span>
                                                    </td>
                                                    <td className="p-3 text-[11px] font-mono text-right">
                                                        <span className="text-text-secondary">{formatPct(cr_)}</span>
                                                    </td>
                                                    <td className="p-3 text-[11px] font-mono text-right">
                                                        <span className={br_ > 2 ? "text-red-400" : "text-text-muted"}>
                                                            {formatPct(br_)}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-[11px] font-mono text-right">
                                                        {conv > 0 ? (
                                                            <span className="text-synced">{formatCurrency(rev)}</span>
                                                        ) : (
                                                            <span className="text-text-muted">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Daily Activity */}
                        <div className="card p-6">
                            <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                Actividad por Día
                            </h2>
                            <div className="grid grid-cols-1 gap-2">
                                {snapshots.map((s) => {
                                    const maxSent = Math.max(...snapshots.map(x => x.metrics.sent || 0), 1);
                                    const barWidth = ((s.metrics.sent || 0) / maxSent) * 100;
                                    return (
                                        <div key={s.date} className="flex items-center gap-3 text-[11px]">
                                            <span className="text-text-muted font-mono w-16 shrink-0">{formatDate(s.date)}</span>
                                            <div className="flex-1 h-4 bg-argent/20 relative">
                                                <div className="h-full bg-blue-500/50" style={{ width: `${barWidth}%` }} />
                                            </div>
                                            <span className="text-text-secondary font-mono w-16 text-right">
                                                {formatNumber(s.metrics.sent)} env
                                            </span>
                                            <span className="text-text-muted font-mono w-16 text-right">
                                                {formatPct(s.metrics.openRate)} OR
                                            </span>
                                            <span className="text-synced font-mono w-20 text-right">
                                                {(s.metrics.emailRevenue || 0) > 0 ? formatCurrency(s.metrics.emailRevenue) : ""}
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
