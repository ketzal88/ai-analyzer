"use client";

import React, { useEffect, useState } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { useClient } from "@/contexts/ClientContext";
import { ChannelDailySnapshot } from "@/types/channel-snapshots";

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

const AUTOMATION_TYPE_LABELS: Record<string, string> = {
    abandoned_cart: "Carrito Abandonado",
    welcome: "Bienvenida",
    visit_recovery: "Remarketing Visita",
    loyalty: "Fidelización",
    coupon: "Cupón",
    other: "Otro",
};

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
        end = new Date(now.getFullYear(), now.getMonth(), 0); // last day of prev month
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

export default function EmailChannel() {
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

        fetch(`/api/channel-snapshots?clientId=${clientId}&channel=EMAIL&startDate=${startDate}&endDate=${endDate}`)
            .then(res => res.json())
            .then(data => setSnapshots(data.snapshots || []))
            .catch(err => setError(err.message))
            .finally(() => setIsLoading(false));
    }, [clientId, startDate, endDate]);

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

    // Collect all campaigns from all snapshots (dedupe by id)
    const allCampaigns: any[] = [];
    const seenIds = new Set<number>();
    for (const s of snapshots) {
        const campaigns = (s.rawData?.campaigns as any[]) || [];
        for (const c of campaigns) {
            if (!seenIds.has(c.id)) {
                seenIds.add(c.id);
                allCampaigns.push(c);
            }
        }
    }
    // Sort by launchDate desc
    allCampaigns.sort((a, b) => (b.launchDate || "").localeCompare(a.launchDate || ""));

    // Automations from most recent snapshot
    const automations = (snapshots[0]?.rawData?.automations as any[]) || [];
    const automationTotals = (snapshots[0]?.rawData?.automationTotals as any) || {};
    const accountInfo = (snapshots[0]?.rawData?.account as any) || null;

    return (
        <AppLayout>
            <div className="space-y-8 pb-20">
                <header className="flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-text-primary uppercase tracking-tighter">
                            Email Marketing
                        </h1>
                        <p className="text-small text-text-muted font-bold uppercase tracking-widest mt-1">
                            Perfit • {periodLabel}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
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
                            />
                            <KPICard
                                label="Tasa de Apertura"
                                value={formatPct(openRate)}
                                subtitle={`${formatNumber(totals.opens)} aperturas`}
                                color={openRate > 20 ? "text-synced" : openRate > 10 ? "text-classic" : "text-red-400"}
                            />
                            <KPICard
                                label="Tasa de Click"
                                value={formatPct(clickRate)}
                                subtitle={`${formatNumber(totals.clicks)} clicks`}
                                color={clickRate > 3 ? "text-synced" : "text-text-primary"}
                            />
                            <KPICard
                                label="Revenue Campañas"
                                value={formatCurrency(totals.revenue)}
                                subtitle={`${formatNumber(totals.conversions)} ventas asistidas`}
                                color="text-synced"
                            />
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <KPICard
                                label="Bounces"
                                value={formatPct(bounceRate)}
                                subtitle={`${formatNumber(totals.bounces)} rebotes`}
                                color={bounceRate > 5 ? "text-red-400" : "text-text-primary"}
                            />
                            <KPICard
                                label="Tasa de Conversión"
                                value={`${conversionRate.toFixed(2)}‰`}
                                subtitle="ventas / 1000 aperturas"
                            />
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
                                            {allCampaigns.map((c: any) => (
                                                <tr key={c.id} className="border-b border-argent/10 hover:bg-classic/[0.03]">
                                                    <td className="p-3 max-w-[280px]">
                                                        <p className="text-[11px] text-text-primary font-medium truncate">{c.name}</p>
                                                        {c.subject && c.subject !== c.name && (
                                                            <p className="text-[10px] text-text-muted truncate">{c.subject}</p>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-[11px] text-text-muted font-mono whitespace-nowrap">
                                                        {c.launchDate ? formatDate(c.launchDate.split("T")[0]) : "—"}
                                                    </td>
                                                    <td className="p-3 text-[11px] text-text-secondary font-mono text-right">{formatNumber(c.sent)}</td>
                                                    <td className="p-3 text-[11px] font-mono text-right">
                                                        <span className="text-text-secondary">{formatPct(c.openRate)}</span>
                                                    </td>
                                                    <td className="p-3 text-[11px] font-mono text-right">
                                                        <span className="text-text-secondary">{formatPct(c.clickRate)}</span>
                                                    </td>
                                                    <td className="p-3 text-[11px] font-mono text-right">
                                                        <span className={c.bounceRate > 2 ? "text-red-400" : "text-text-muted"}>
                                                            {formatPct(c.bounceRate)}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-[11px] font-mono text-right">
                                                        {c.conversions > 0 ? (
                                                            <span className="text-synced">{formatCurrency(c.conversionsAmount)}</span>
                                                        ) : (
                                                            <span className="text-text-muted">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
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
