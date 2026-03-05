"use client";

import React, { useEffect, useState } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { useClient } from "@/contexts/ClientContext";
import { ChannelDailySnapshot } from "@/types/channel-snapshots";
import Link from "next/link";

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

export default function MetaAdsChannel() {
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

        fetch(`/api/channel-snapshots?clientId=${clientId}&channel=META&startDate=${startDate}&endDate=${endDate}`)
            .then(res => res.json())
            .then(data => setSnapshots(data.snapshots || []))
            .catch(err => setError(err.message))
            .finally(() => setIsLoading(false));
    }, [clientId, startDate, endDate]);

    // Aggregate totals
    const totals = snapshots.reduce(
        (acc, s) => ({
            spend: acc.spend + (s.metrics.spend || 0),
            revenue: acc.revenue + (s.metrics.revenue || 0),
            conversions: acc.conversions + (s.metrics.conversions || 0),
            impressions: acc.impressions + (s.metrics.impressions || 0),
            clicks: acc.clicks + (s.metrics.clicks || 0),
            reach: acc.reach + ((s.metrics as any).reach || 0),
        }),
        { spend: 0, revenue: 0, conversions: 0, impressions: 0, clicks: 0, reach: 0 }
    );
    const roas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
    const cpa = totals.conversions > 0 ? totals.spend / totals.conversions : 0;
    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;

    // Sort snapshots by date ascending for the daily chart
    const sortedSnapshots = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));

    return (
        <AppLayout>
            <div className="space-y-8 pb-20">
                <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-text-primary uppercase tracking-tighter">
                            Meta Ads
                        </h1>
                        <p className="text-small text-text-muted font-bold uppercase tracking-widest mt-1">
                            Facebook & Instagram &bull; {periodLabel}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                            {(Object.keys(PERIOD_LABELS) as PeriodOption[]).map((key) => (
                                <button
                                    key={key}
                                    onClick={() => setPeriod(key)}
                                    className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${
                                        period === key
                                            ? "bg-classic text-stellar"
                                            : "bg-special text-text-muted hover:text-text-primary"
                                    }`}
                                >
                                    {PERIOD_LABELS[key]}
                                </button>
                            ))}
                        </div>
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

                        {/* Quick Actions */}
                        <div className="flex gap-3">
                            <Link
                                href="/ads-manager"
                                className="px-4 py-2.5 bg-classic text-stellar text-[11px] font-black uppercase tracking-widest hover:bg-classic/80 transition-all"
                            >
                                Ads Manager
                            </Link>
                            <Link
                                href="/decision-board"
                                className="px-4 py-2.5 border border-argent text-text-secondary text-[11px] font-black uppercase tracking-widest hover:border-classic/30 transition-all"
                            >
                                Decision Board
                            </Link>
                            <Link
                                href="/creative"
                                className="px-4 py-2.5 border border-argent text-text-secondary text-[11px] font-black uppercase tracking-widest hover:border-classic/30 transition-all"
                            >
                                Biblioteca de Creativos
                            </Link>
                        </div>

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
            </div>
        </AppLayout>
    );
}
