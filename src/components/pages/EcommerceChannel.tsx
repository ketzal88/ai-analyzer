"use client";

import React, { useEffect, useState } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { useClient } from "@/contexts/ClientContext";
import { ChannelDailySnapshot } from "@/types/channel-snapshots";

function formatCurrency(value: number | undefined, prefix = "$"): string {
    if (value === undefined || value === null) return "—";
    return `${prefix}${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatNumber(value: number | undefined, decimals = 0): string {
    if (value === undefined || value === null) return "—";
    return value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
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

export default function EcommerceChannel() {
    const { selectedClientId: clientId } = useClient();
    const [snapshots, setSnapshots] = useState<ChannelDailySnapshot[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!clientId) return;
        setIsLoading(true);
        setError(null);

        fetch(`/api/channel-snapshots?clientId=${clientId}&channel=ECOMMERCE&days=30`)
            .then(res => res.json())
            .then(data => setSnapshots(data.snapshots || []))
            .catch(err => setError(err.message))
            .finally(() => setIsLoading(false));
    }, [clientId]);

    // Last 7 days aggregation
    const last7 = snapshots.slice(0, 7);
    const totals = last7.reduce(
        (acc, s) => ({
            orders: acc.orders + (s.metrics.orders || 0),
            revenue: acc.revenue + (s.metrics.revenue || 0),
            refunds: acc.refunds + (s.metrics.refunds || 0),
        }),
        { orders: 0, revenue: 0, refunds: 0 }
    );
    const aov7d = totals.orders > 0 ? totals.revenue / totals.orders : 0;
    const refundRate = totals.orders > 0 ? (totals.refunds / (totals.orders + totals.refunds)) * 100 : 0;

    // Storefront breakdown from most recent day
    const latestStorefronts = (snapshots[0]?.rawData?.byStorefront as Record<string, { orders: number; revenue: number }>) || {};

    return (
        <AppLayout>
            <div className="space-y-8 pb-20">
                <header>
                    <h1 className="text-3xl font-black text-text-primary uppercase tracking-tighter">
                        Ecommerce
                    </h1>
                    <p className="text-small text-text-muted font-bold uppercase tracking-widest mt-1">
                        Tienda Nube • Últimos 7 días
                    </p>
                </header>

                {isLoading && (
                    <div className="card p-12 flex items-center justify-center">
                        <div className="animate-spin w-6 h-6 border-2 border-classic border-t-transparent" />
                        <span className="ml-3 text-text-muted text-small">Cargando datos de ecommerce...</span>
                    </div>
                )}

                {error && (
                    <div className="card p-6 border-red-500/30">
                        <p className="text-red-400 text-small">{error}</p>
                    </div>
                )}

                {!isLoading && !error && snapshots.length === 0 && (
                    <div className="card p-12 border-dashed flex flex-col items-center gap-3">
                        <p className="text-text-muted text-small">No hay datos de ecommerce para este cliente.</p>
                    </div>
                )}

                {!isLoading && !error && snapshots.length > 0 && (
                    <>
                        {/* KPI Grid */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <KPICard label="Revenue" value={formatCurrency(totals.revenue)} subtitle="Últimos 7d" color="text-synced" />
                            <KPICard label="Órdenes" value={formatNumber(totals.orders)} subtitle="Últimos 7d" />
                            <KPICard label="Ticket Promedio" value={formatCurrency(aov7d)} subtitle="AOV" />
                            <KPICard label="Tasa de Reembolso" value={`${refundRate.toFixed(1)}%`} subtitle={`${totals.refunds} reembolsos`} color={refundRate > 5 ? "text-red-400" : "text-text-primary"} />
                        </div>

                        {/* Storefront Attribution */}
                        {Object.keys(latestStorefronts).length > 0 && (
                            <div className="card p-6">
                                <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                    Atribución por Canal (día más reciente)
                                </h2>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    {Object.entries(latestStorefronts).map(([sf, data]) => (
                                        <div key={sf} className="bg-stellar border border-argent p-4">
                                            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">{sf}</p>
                                            <p className="text-lg font-black text-text-primary font-mono mt-1">{data.orders} órdenes</p>
                                            <p className="text-[11px] text-text-secondary font-mono">{formatCurrency(data.revenue)}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Daily Trend */}
                        <div className="card p-6">
                            <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                Revenue Diario (últimos 30d)
                            </h2>
                            <div className="grid grid-cols-1 gap-2">
                                {snapshots.map((s) => {
                                    const maxRevenue = Math.max(...snapshots.map(x => x.metrics.revenue || 0), 1);
                                    const barWidth = ((s.metrics.revenue || 0) / maxRevenue) * 100;
                                    return (
                                        <div key={s.date} className="flex items-center gap-3 text-[11px]">
                                            <span className="text-text-muted font-mono w-20 shrink-0">{s.date}</span>
                                            <div className="flex-1 h-4 bg-argent/20 relative">
                                                <div
                                                    className="h-full bg-synced/50"
                                                    style={{ width: `${barWidth}%` }}
                                                />
                                            </div>
                                            <span className="text-text-secondary font-mono w-16 text-right">
                                                {formatCurrency(s.metrics.revenue)}
                                            </span>
                                            <span className="text-text-muted font-mono w-12 text-right">
                                                {s.metrics.orders || 0} ord
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
