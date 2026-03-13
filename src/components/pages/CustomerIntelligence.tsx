"use client";

import React, { useEffect, useState } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { useClient } from "@/contexts/ClientContext";
import { ChannelDailySnapshot } from "@/types/channel-snapshots";
import { UnifiedDateRange, resolvePreset, getComparisonRange } from "@/lib/date-utils";
import DateRangePicker from "@/components/ui/DateRangePicker";
import { useAnalyst } from "@/contexts/AnalystContext";

function formatCurrency(value: number | undefined, prefix = "$"): string {
    if (value === undefined || value === null) return "—";
    if (value >= 1_000_000) return `${prefix}${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${prefix}${(value / 1_000).toFixed(1)}K`;
    return `${prefix}${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatNumber(value: number | undefined, decimals = 0): string {
    if (value === undefined || value === null) return "—";
    return value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

function formatPct(value: number | undefined): string {
    if (value === undefined || value === null) return "—";
    return `${value.toFixed(1)}%`;
}

interface CustomerIntelData {
    totalTrackedCustomers?: number;
    avgLifetimeLtv?: number;
    avgLifetimeOrders?: number;
    revenuePerCustomer?: number;
    retentionRate?: number;
    avgDaysBetweenOrders?: number;
    cohorts?: {
        firstTime?: { count: number; revenue: number; avgLtv: number; avgOrders: number };
        returning?: { count: number; revenue: number; avgLtv: number; avgOrders: number };
        vip?: { count: number; revenue: number; avgLtv: number; avgOrders: number };
    };
    ltvCac?: {
        cac: number;
        ltvCacRatio: number;
        adSpend: number;
        newCustomers: number;
    };
}

export default function CustomerIntelligence() {
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
            fetch(`/api/channel-snapshots?clientId=${clientId}&channel=ECOMMERCE&startDate=${dateRange.start}&endDate=${dateRange.end}`).then(r => r.json()),
            fetch(`/api/channel-snapshots?clientId=${clientId}&channel=ECOMMERCE&startDate=${compRange.start}&endDate=${compRange.end}`).then(r => r.json()),
        ])
            .then(([curr, prev]) => {
                setSnapshots(curr.snapshots || []);
                setPrevSnapshots(prev.snapshots || []);
            })
            .catch(err => setError(err.message))
            .finally(() => setIsLoading(false));
    }, [clientId, dateRange.start, dateRange.end]);

    const customerIntelligence: CustomerIntelData | undefined = snapshots.length > 0
        ? (snapshots[0]?.rawData?.customerIntelligence as CustomerIntelData | undefined)
        : undefined;

    const prevCustomerIntelligence: CustomerIntelData | undefined = prevSnapshots.length > 0
        ? (prevSnapshots[0]?.rawData?.customerIntelligence as CustomerIntelData | undefined)
        : undefined;

    const hasIntelligence = customerIntelligence && (customerIntelligence.totalTrackedCustomers || 0) > 0;

    // Period totals for ecommerce KPIs
    const totals = snapshots.reduce(
        (acc, s) => ({
            revenue: acc.revenue + (s.metrics.revenue || 0),
            orders: acc.orders + (s.metrics.conversions || 0),
        }),
        { revenue: 0, orders: 0 }
    );

    const prevTotals = prevSnapshots.reduce(
        (acc, s) => ({
            revenue: acc.revenue + (s.metrics.revenue || 0),
            orders: acc.orders + (s.metrics.conversions || 0),
        }),
        { revenue: 0, orders: 0 }
    );

    const aov = totals.orders > 0 ? totals.revenue / totals.orders : 0;
    const prevAov = prevTotals.orders > 0 ? prevTotals.revenue / prevTotals.orders : 0;

    const calcDelta = (curr: number, prev: number): number | null => {
        if (prev === 0) return curr > 0 ? 100 : null;
        return ((curr - prev) / Math.abs(prev)) * 100;
    };

    return (
        <AppLayout>
            <div className="space-y-6 pb-20">
            {/* Page Title */}
            <div>
                <h1 className="text-display font-black text-text-primary mb-2">CUSTOMER INTELLIGENCE</h1>
                <p className="text-subheader text-text-secondary uppercase tracking-widest font-bold text-[12px]">
                    LTV, Cohortes y Retención de Clientes
                </p>
            </div>

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <DateRangePicker value={dateRange} onChange={setDateRange} />
                    <button
                        onClick={() => openAnalyst("ecommerce", "Analiza la inteligencia de clientes: LTV, retención, cohorts y LTV:CAC ratio.")}
                        className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-classic/10 text-classic border border-classic/30 hover:bg-classic/20 transition-colors"
                    >
                        Analizar con IA
                    </button>
                </div>
            </div>

            {!clientId && (
                <div className="card p-12 text-center">
                    <p className="text-text-muted text-sm">Selecciona un cliente para ver inteligencia de clientes.</p>
                </div>
            )}

            {clientId && isLoading && (
                <div className="card p-12 text-center">
                    <div className="inline-block w-6 h-6 border-2 border-classic/30 border-t-classic animate-spin" />
                    <p className="text-text-muted text-xs mt-3">Cargando datos de clientes...</p>
                </div>
            )}

            {clientId && error && (
                <div className="card p-6 border-red-500/30 bg-red-500/5">
                    <p className="text-red-400 text-sm">Error: {error}</p>
                </div>
            )}

            {clientId && !isLoading && !error && !hasIntelligence && (
                <div className="card p-12 text-center">
                    <p className="text-text-muted text-sm">No hay datos de inteligencia de clientes para este período.</p>
                    <p className="text-text-muted text-xs mt-2">Los datos se generan automáticamente al sincronizar pedidos de ecommerce.</p>
                </div>
            )}

            {clientId && !isLoading && !error && hasIntelligence && (
                <div className="space-y-6">
                    {/* Period Summary KPIs */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="card p-5">
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Revenue Período</p>
                            <div className="flex items-baseline gap-2 mt-2">
                                <p className="text-2xl font-black font-mono text-synced">{formatCurrency(totals.revenue)}</p>
                                {calcDelta(totals.revenue, prevTotals.revenue) != null && (
                                    <span className={`text-[9px] font-mono font-bold ${calcDelta(totals.revenue, prevTotals.revenue)! > 0 ? "text-synced" : "text-red-400"}`}>
                                        {calcDelta(totals.revenue, prevTotals.revenue)! > 0 ? "▲" : "▼"} {calcDelta(totals.revenue, prevTotals.revenue)! > 0 ? "+" : ""}{calcDelta(totals.revenue, prevTotals.revenue)!.toFixed(1)}%
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="card p-5">
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Órdenes</p>
                            <div className="flex items-baseline gap-2 mt-2">
                                <p className="text-2xl font-black font-mono text-classic">{formatNumber(totals.orders)}</p>
                                {calcDelta(totals.orders, prevTotals.orders) != null && (
                                    <span className={`text-[9px] font-mono font-bold ${calcDelta(totals.orders, prevTotals.orders)! > 0 ? "text-synced" : "text-red-400"}`}>
                                        {calcDelta(totals.orders, prevTotals.orders)! > 0 ? "▲" : "▼"} {calcDelta(totals.orders, prevTotals.orders)! > 0 ? "+" : ""}{calcDelta(totals.orders, prevTotals.orders)!.toFixed(1)}%
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="card p-5">
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">AOV</p>
                            <div className="flex items-baseline gap-2 mt-2">
                                <p className="text-2xl font-black font-mono text-text-primary">{formatCurrency(aov)}</p>
                                {calcDelta(aov, prevAov) != null && (
                                    <span className={`text-[9px] font-mono font-bold ${calcDelta(aov, prevAov)! > 0 ? "text-synced" : "text-red-400"}`}>
                                        {calcDelta(aov, prevAov)! > 0 ? "▲" : "▼"} {calcDelta(aov, prevAov)! > 0 ? "+" : ""}{calcDelta(aov, prevAov)!.toFixed(1)}%
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="card p-5">
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Clientes Trackeados</p>
                            <p className="text-2xl font-black font-mono text-text-primary mt-2">
                                {formatNumber(customerIntelligence!.totalTrackedCustomers)}
                            </p>
                            <p className="text-[10px] text-text-muted mt-1">base de datos lifetime</p>
                        </div>
                    </div>

                    {/* Lifetime KPIs */}
                    <div className="card p-6">
                        <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                            Métricas Lifetime
                        </h2>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-stellar border border-argent p-4">
                                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">LTV Promedio</p>
                                <p className="text-2xl font-black text-classic font-mono mt-2">
                                    {formatCurrency(customerIntelligence!.avgLifetimeLtv)}
                                </p>
                                <p className="text-[10px] text-text-muted mt-1">
                                    {formatNumber(customerIntelligence!.avgLifetimeOrders, 1)} órdenes promedio
                                </p>
                            </div>
                            <div className="bg-stellar border border-argent p-4">
                                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Revenue / Cliente</p>
                                <p className="text-2xl font-black text-synced font-mono mt-2">
                                    {formatCurrency(customerIntelligence!.revenuePerCustomer)}
                                </p>
                                <p className="text-[10px] text-text-muted mt-1">en el período seleccionado</p>
                            </div>
                            {customerIntelligence!.retentionRate !== undefined && (
                                <div className="bg-stellar border border-argent p-4">
                                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Tasa de Retención</p>
                                    <p className={`text-2xl font-black font-mono mt-2 ${
                                        customerIntelligence!.retentionRate! > 30 ? "text-synced" :
                                        customerIntelligence!.retentionRate! > 15 ? "text-yellow-400" :
                                        "text-red-400"
                                    }`}>
                                        {formatPct(customerIntelligence!.retentionRate)}
                                    </p>
                                    <p className="text-[10px] text-text-muted mt-1">benchmark: &gt;25%</p>
                                </div>
                            )}
                            {customerIntelligence!.avgDaysBetweenOrders !== undefined && (
                                <div className="bg-stellar border border-argent p-4">
                                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Días entre Compras</p>
                                    <p className="text-2xl font-black text-text-primary font-mono mt-2">
                                        {customerIntelligence!.avgDaysBetweenOrders}
                                    </p>
                                    <p className="text-[10px] text-text-muted mt-1">promedio clientes recurrentes</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* LTV:CAC Card */}
                    {customerIntelligence!.ltvCac && (
                        <div className={`card border p-6 ${
                            customerIntelligence!.ltvCac.ltvCacRatio >= 3 ? "border-synced/50 bg-synced/5" :
                            customerIntelligence!.ltvCac.ltvCacRatio >= 1 ? "border-yellow-400/50 bg-yellow-400/5" :
                            "border-red-500/50 bg-red-500/5"
                        }`}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">LTV : CAC Ratio</p>
                                    <p className={`text-4xl font-black font-mono mt-2 ${
                                        customerIntelligence!.ltvCac.ltvCacRatio >= 3 ? "text-synced" :
                                        customerIntelligence!.ltvCac.ltvCacRatio >= 1 ? "text-yellow-400" :
                                        "text-red-400"
                                    }`}>
                                        {customerIntelligence!.ltvCac.ltvCacRatio.toFixed(1)}x
                                    </p>
                                    <p className="text-[10px] text-text-muted mt-1">
                                        {customerIntelligence!.ltvCac.ltvCacRatio >= 3 ? "Saludable — el negocio es rentable a nivel unitario" :
                                         customerIntelligence!.ltvCac.ltvCacRatio >= 1 ? "Ajustado — marginal, optimizar CAC o aumentar LTV" :
                                         "No rentable — el costo de adquisición supera el valor del cliente"}
                                    </p>
                                    <p className="text-[9px] text-text-muted mt-2">Benchmark: &gt;3x saludable, &gt;5x excelente</p>
                                </div>
                                <div className="text-right space-y-2">
                                    <div className="bg-stellar border border-argent p-3 min-w-[140px]">
                                        <p className="text-[9px] text-text-muted uppercase tracking-widest">LTV</p>
                                        <p className="text-lg font-black font-mono text-classic">{formatCurrency(customerIntelligence!.avgLifetimeLtv)}</p>
                                    </div>
                                    <div className="bg-stellar border border-argent p-3 min-w-[140px]">
                                        <p className="text-[9px] text-text-muted uppercase tracking-widest">CAC</p>
                                        <p className="text-lg font-black font-mono text-red-400">{formatCurrency(customerIntelligence!.ltvCac.cac)}</p>
                                    </div>
                                    <div className="flex gap-4 text-[9px] text-text-muted px-1">
                                        <span>Ad Spend: <span className="font-mono font-bold text-text-secondary">{formatCurrency(customerIntelligence!.ltvCac.adSpend)}</span></span>
                                        <span>Nuevos: <span className="font-mono font-bold text-text-secondary">{formatNumber(customerIntelligence!.ltvCac.newCustomers)}</span></span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Cohorts */}
                    {customerIntelligence!.cohorts && (
                        <div className="card p-6">
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                Cohortes Lifetime (tracking acumulado)
                            </p>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                {([
                                    { key: 'firstTime' as const, label: 'Primera Compra', desc: '1 orden', color: 'text-classic', borderColor: 'border-classic/30', bgColor: 'bg-classic/5' },
                                    { key: 'returning' as const, label: 'Recurrentes', desc: '2-5 órdenes', color: 'text-synced', borderColor: 'border-synced/30', bgColor: 'bg-synced/5' },
                                    { key: 'vip' as const, label: 'VIP', desc: '6+ órdenes', color: 'text-yellow-400', borderColor: 'border-yellow-400/30', bgColor: 'bg-yellow-400/5' },
                                ] as const).map(({ key, label, desc, color, borderColor, bgColor }) => {
                                    const cohort = customerIntelligence!.cohorts![key];
                                    if (!cohort || cohort.count === 0) return null;
                                    const totalIntel = (customerIntelligence!.cohorts!.firstTime?.count || 0) +
                                        (customerIntelligence!.cohorts!.returning?.count || 0) +
                                        (customerIntelligence!.cohorts!.vip?.count || 0);
                                    const pct = totalIntel > 0 ? (cohort.count / totalIntel) * 100 : 0;
                                    return (
                                        <div key={key} className={`${bgColor} border ${borderColor} p-4`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <div>
                                                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">{label}</p>
                                                    <p className="text-[9px] text-text-muted">{desc}</p>
                                                </div>
                                                <span className="text-xs font-mono font-bold text-text-muted">{pct.toFixed(0)}%</span>
                                            </div>
                                            <p className={`text-2xl font-black font-mono ${color}`}>{formatNumber(cohort.count)}</p>
                                            {/* Distribution bar */}
                                            <div className="w-full h-1.5 bg-argent/20 mt-2 mb-3">
                                                <div className={`h-full ${key === 'firstTime' ? 'bg-classic/60' : key === 'returning' ? 'bg-synced/60' : 'bg-yellow-400/60'}`} style={{ width: `${pct}%` }} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 text-[10px] text-text-muted">
                                                <div>
                                                    <p className="text-[9px] uppercase tracking-widest mb-0.5">LTV</p>
                                                    <p className={`font-bold font-mono ${color}`}>{formatCurrency(cohort.avgLtv)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] uppercase tracking-widest mb-0.5">Órdenes Prom</p>
                                                    <p className="font-bold font-mono text-text-secondary">{formatNumber(cohort.avgOrders, 1)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] uppercase tracking-widest mb-0.5">Revenue Total</p>
                                                    <p className="font-bold font-mono text-text-secondary">{formatCurrency(cohort.revenue)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] uppercase tracking-widest mb-0.5">AOV</p>
                                                    <p className="font-bold font-mono text-text-secondary">{formatCurrency(cohort.count > 0 ? cohort.revenue / cohort.count : 0)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Trend: New vs Returning (daily from snapshots) */}
                    {snapshots.length > 1 && (
                        <div className="card p-6">
                            <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                Tendencia: Nuevos vs Recurrentes (diario)
                            </h2>
                            <div className="space-y-1">
                                {snapshots.slice().reverse().map((s) => {
                                    const raw = s.rawData as any;
                                    const newC = raw?.newCustomers || raw?.customerSegmentation?.new || 0;
                                    const retC = raw?.returningCustomers || raw?.customerSegmentation?.returning || 0;
                                    const total = newC + retC;
                                    if (total === 0) return null;
                                    const newPct = (newC / total) * 100;
                                    const retPct = (retC / total) * 100;
                                    const dateLabel = s.date.split("-").slice(1).join("/");
                                    return (
                                        <div key={s.date} className="flex items-center gap-3 text-[10px]">
                                            <span className="font-mono text-text-muted w-12 shrink-0">{dateLabel}</span>
                                            <div className="flex-1 flex h-4">
                                                <div className="bg-classic/40 h-full" style={{ width: `${newPct}%` }} title={`Nuevos: ${newC}`} />
                                                <div className="bg-synced/40 h-full" style={{ width: `${retPct}%` }} title={`Recurrentes: ${retC}`} />
                                            </div>
                                            <span className="font-mono text-text-muted w-20 text-right shrink-0">
                                                {newC}N / {retC}R
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex gap-4 mt-3 text-[9px] text-text-muted">
                                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-classic/40 inline-block" /> Nuevos</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-synced/40 inline-block" /> Recurrentes</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
            </div>
        </AppLayout>
    );
}
