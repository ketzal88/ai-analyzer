"use client";

import React, { useEffect, useState } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { useClient } from "@/contexts/ClientContext";
import { ChannelDailySnapshot } from "@/types/channel-snapshots";

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

type PeriodOption = "mtd" | "last_month" | "two_months_ago";

const PERIOD_LABELS: Record<PeriodOption, string> = {
    mtd: "Este mes",
    last_month: "Mes pasado",
    two_months_ago: "Hace 2 meses",
};

function getPeriodRange(period: PeriodOption): { startDate: string; endDate: string; label: string } {
    const now = new Date();
    let start: Date;
    let end: Date;

    if (period === "mtd") {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = now;
    } else if (period === "last_month") {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else {
        start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        end = new Date(now.getFullYear(), now.getMonth() - 1, 0);
    }

    const fmt = (d: Date) => d.toISOString().split("T")[0];
    const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const label = period === "mtd"
        ? `${months[now.getMonth()]} ${now.getFullYear()} (hasta la fecha)`
        : `${months[start.getMonth()]} ${start.getFullYear()}`;

    return { startDate: fmt(start), endDate: fmt(end), label };
}

export default function GoogleAdsChannel() {
    const { selectedClientId: clientId } = useClient();
    const [snapshots, setSnapshots] = useState<ChannelDailySnapshot[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [period, setPeriod] = useState<PeriodOption>("mtd");

    const { startDate, endDate, label: periodLabel } = getPeriodRange(period);

    useEffect(() => {
        if (!clientId) return;
        setIsLoading(true);
        setError(null);

        fetch(`/api/channel-snapshots?clientId=${clientId}&channel=GOOGLE&startDate=${startDate}&endDate=${endDate}`)
            .then(res => res.json())
            .then(data => setSnapshots(data.snapshots || []))
            .catch(err => setError(err.message))
            .finally(() => setIsLoading(false));
    }, [clientId, startDate, endDate]);

    // Aggregate totals from ALL snapshots in period
    const totals = snapshots.reduce(
        (acc, s) => ({
            spend: acc.spend + (s.metrics.spend || 0),
            revenue: acc.revenue + (s.metrics.revenue || 0),
            conversions: acc.conversions + (s.metrics.conversions || 0),
            impressions: acc.impressions + (s.metrics.impressions || 0),
            clicks: acc.clicks + (s.metrics.clicks || 0),
        }),
        { spend: 0, revenue: 0, conversions: 0, impressions: 0, clicks: 0 }
    );
    const roas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
    const cpa = totals.conversions > 0 ? totals.spend / totals.conversions : 0;
    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;

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
                            Canal de Publicidad • {periodLabel}
                        </p>
                    </div>
                    <div className="flex gap-1">
                        {(Object.keys(PERIOD_LABELS) as PeriodOption[]).map((key) => (
                            <button
                                key={key}
                                onClick={() => setPeriod(key)}
                                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
                                    period === key
                                        ? "bg-classic text-white"
                                        : "bg-special text-text-muted hover:text-text-primary"
                                }`}
                            >
                                {PERIOD_LABELS[key]}
                            </button>
                        ))}
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
                                subtitle="Revenue / Inversión"
                                color={roas >= 3 ? "text-synced" : roas >= 1 ? "text-classic" : "text-red-400"}
                            />
                            <KPICard
                                label="CPA"
                                value={formatCurrency(cpa)}
                                subtitle="Costo por conversión"
                                color={cpa > 0 ? "text-text-primary" : "text-text-muted"}
                            />
                        </div>

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
                                label="CPC"
                                value={formatCurrency(cpc)}
                            />
                        </div>

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
                                                            <span className={`px-2 py-0.5 text-[9px] font-bold uppercase ${c.status === "ENABLED" || c.status === 2 ? "text-synced bg-synced/10" : "text-text-muted bg-argent/20"}`}>
                                                                {c.status === "ENABLED" || c.status === 2 ? "activa" : c.status === "PAUSED" || c.status === 3 ? "pausada" : String(c.status || "—")}
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
