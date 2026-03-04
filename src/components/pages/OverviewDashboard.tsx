"use client";

import React, { useEffect, useState } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { useClient } from "@/contexts/ClientContext";
import { ChannelDailySnapshot } from "@/types/channel-snapshots";
import { SemaforoSnapshot } from "@/types/semaforo";
import SemaforoWidget from "@/components/semaforo/SemaforoWidget";
import Link from "next/link";

function formatNumber(value: number, decimals = 0): string {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(decimals > 0 ? decimals : 1)}K`;
    return value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

function formatCurrency(value: number): string {
    return `$${formatNumber(value, 2)}`;
}

function formatPct(value: number): string {
    return `${value.toFixed(1)}%`;
}

interface ChannelSummary {
    channel: string;
    label: string;
    href: string;
    spend: number;
    revenue: number;
    conversions: number;
    roas: number;
    days: number;
}

export default function OverviewDashboard() {
    const { selectedClientId: clientId } = useClient();
    const [channelData, setChannelData] = useState<Record<string, ChannelDailySnapshot[]>>({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!clientId) return;
        setIsLoading(true);

        const channels = ["META", "GOOGLE", "ECOMMERCE", "EMAIL"];
        Promise.all(
            channels.map(ch =>
                fetch(`/api/channel-snapshots?clientId=${clientId}&channel=${ch}&days=30`)
                    .then(res => res.json())
                    .then(data => ({ channel: ch, snapshots: data.snapshots || [] }))
                    .catch(() => ({ channel: ch, snapshots: [] }))
            )
        ).then(results => {
            const map: Record<string, ChannelDailySnapshot[]> = {};
            for (const r of results) {
                map[r.channel] = r.snapshots;
            }
            setChannelData(map);
            setIsLoading(false);
        });
    }, [clientId]);

    // Aggregate per channel
    const summaries: ChannelSummary[] = [];

    // Meta
    const metaSnaps = channelData["META"] || [];
    if (metaSnaps.length > 0) {
        const spend = metaSnaps.reduce((s, x) => s + (x.metrics.spend || 0), 0);
        const revenue = metaSnaps.reduce((s, x) => s + (x.metrics.revenue || 0), 0);
        const conversions = metaSnaps.reduce((s, x) => s + (x.metrics.conversions || 0), 0);
        summaries.push({ channel: "META", label: "Meta Ads", href: "/channels/meta", spend, revenue, conversions, roas: spend > 0 ? revenue / spend : 0, days: metaSnaps.length });
    }

    // Google
    const googleSnaps = channelData["GOOGLE"] || [];
    if (googleSnaps.length > 0) {
        const spend = googleSnaps.reduce((s, x) => s + (x.metrics.spend || 0), 0);
        const revenue = googleSnaps.reduce((s, x) => s + (x.metrics.revenue || 0), 0);
        const conversions = googleSnaps.reduce((s, x) => s + (x.metrics.conversions || 0), 0);
        summaries.push({ channel: "GOOGLE", label: "Google Ads", href: "/channels/google", spend, revenue, conversions, roas: spend > 0 ? revenue / spend : 0, days: googleSnaps.length });
    }

    // Ecommerce
    const ecomSnaps = channelData["ECOMMERCE"] || [];
    if (ecomSnaps.length > 0) {
        const revenue = ecomSnaps.reduce((s, x) => s + (x.metrics.revenue || 0), 0);
        const orders = ecomSnaps.reduce((s, x) => s + (x.metrics.orders || 0), 0);
        const avgAOV = orders > 0 ? revenue / orders : 0;
        summaries.push({ channel: "ECOMMERCE", label: "Ecommerce", href: "/channels/ecommerce", spend: 0, revenue, conversions: orders, roas: 0, days: ecomSnaps.length });
    }

    // Email
    const emailSnaps = channelData["EMAIL"] || [];
    if (emailSnaps.length > 0) {
        const sent = emailSnaps.reduce((s, x) => s + (x.metrics.sent || 0), 0);
        const opens = emailSnaps.reduce((s, x) => s + (x.metrics.opens || 0), 0);
        const clicks = emailSnaps.reduce((s, x) => s + (x.metrics.emailClicks || 0), 0);
        summaries.push({ channel: "EMAIL", label: "Email", href: "/channels/email", spend: 0, revenue: 0, conversions: sent, roas: 0, days: emailSnaps.length });
    }

    // Cross-channel totals
    const totalAdSpend = summaries.filter(s => s.channel === "META" || s.channel === "GOOGLE").reduce((t, s) => t + s.spend, 0);
    const totalEcomRevenue = summaries.find(s => s.channel === "ECOMMERCE")?.revenue || 0;
    const totalAdRevenue = summaries.filter(s => s.channel === "META" || s.channel === "GOOGLE").reduce((t, s) => t + s.revenue, 0);
    const blendedRoas = totalAdSpend > 0 ? totalAdRevenue / totalAdSpend : 0;

    return (
        <AppLayout>
            <div className="space-y-8 pb-20">
                <header>
                    <h1 className="text-3xl font-black text-text-primary uppercase tracking-tighter">
                        Overview
                    </h1>
                    <p className="text-small text-text-muted font-bold uppercase tracking-widest mt-1">
                        Vista unificada • Últimos 30 días
                    </p>
                </header>

                {isLoading && (
                    <div className="card p-12 flex items-center justify-center">
                        <div className="animate-spin w-6 h-6 border-2 border-classic border-t-transparent" />
                        <span className="ml-3 text-text-muted text-small">Cargando datos...</span>
                    </div>
                )}

                {!isLoading && (
                    <>
                        {/* Semáforo Widget */}
                        <SemaforoWidget />

                        {/* Cross-Channel KPIs */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="card p-5 hover:border-classic/30 transition-all">
                                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                                    Inversión Publicitaria
                                </p>
                                <p className="text-2xl font-black mt-2 font-mono text-text-primary">
                                    {formatCurrency(totalAdSpend)}
                                </p>
                                <p className="text-[10px] text-text-muted mt-1">Meta + Google 30d</p>
                            </div>

                            <div className="card p-5 hover:border-classic/30 transition-all">
                                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                                    Revenue Ads
                                </p>
                                <p className="text-2xl font-black mt-2 font-mono text-synced">
                                    {formatCurrency(totalAdRevenue)}
                                </p>
                                <p className="text-[10px] text-text-muted mt-1">Atribuido a ads</p>
                            </div>

                            <div className="card p-5 hover:border-classic/30 transition-all">
                                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                                    Revenue Ecommerce
                                </p>
                                <p className="text-2xl font-black mt-2 font-mono text-classic">
                                    {formatCurrency(totalEcomRevenue)}
                                </p>
                                <p className="text-[10px] text-text-muted mt-1">Fuente de verdad (Tienda)</p>
                            </div>

                            <div className="card p-5 hover:border-classic/30 transition-all">
                                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                                    Blended ROAS
                                </p>
                                <p className={`text-2xl font-black mt-2 font-mono ${blendedRoas >= 3 ? "text-synced" : blendedRoas >= 2 ? "text-classic" : "text-red-400"}`}>
                                    {blendedRoas.toFixed(2)}x
                                </p>
                                <p className="text-[10px] text-text-muted mt-1">Ad Revenue / Ad Spend</p>
                            </div>
                        </div>

                        {/* Channel Comparison */}
                        {summaries.length > 0 && (
                            <div className="card p-6">
                                <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                    Canales Activos
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {summaries.map(s => (
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
                                                        <div className="flex justify-between text-[10px]">
                                                            <span className="text-text-muted">Spend</span>
                                                            <span className="text-text-primary font-mono">{formatCurrency(s.spend)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-[10px]">
                                                            <span className="text-text-muted">Revenue</span>
                                                            <span className="text-synced font-mono">{formatCurrency(s.revenue)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-[10px]">
                                                            <span className="text-text-muted">ROAS</span>
                                                            <span className={`font-mono ${s.roas >= 3 ? "text-synced" : s.roas >= 2 ? "text-classic" : "text-red-400"}`}>
                                                                {s.roas.toFixed(2)}x
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between text-[10px]">
                                                            <span className="text-text-muted">Conversiones</span>
                                                            <span className="text-text-primary font-mono">{formatNumber(s.conversions)}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {s.channel === "ECOMMERCE" && (
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between text-[10px]">
                                                            <span className="text-text-muted">Revenue</span>
                                                            <span className="text-synced font-mono">{formatCurrency(s.revenue)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-[10px]">
                                                            <span className="text-text-muted">Órdenes</span>
                                                            <span className="text-text-primary font-mono">{formatNumber(s.conversions)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-[10px]">
                                                            <span className="text-text-muted">AOV</span>
                                                            <span className="text-text-primary font-mono">
                                                                {s.conversions > 0 ? formatCurrency(s.revenue / s.conversions) : "—"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}

                                                {s.channel === "EMAIL" && (
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between text-[10px]">
                                                            <span className="text-text-muted">Enviados</span>
                                                            <span className="text-text-primary font-mono">{formatNumber(s.conversions)}</span>
                                                        </div>
                                                        {(() => {
                                                            const delivered = emailSnaps.reduce((t, x) => t + (x.metrics.delivered || 0), 0);
                                                            const opens = emailSnaps.reduce((t, x) => t + (x.metrics.opens || 0), 0);
                                                            const openRate = delivered > 0 ? (opens / delivered) * 100 : 0;
                                                            return (
                                                                <>
                                                                    <div className="flex justify-between text-[10px]">
                                                                        <span className="text-text-muted">Open Rate</span>
                                                                        <span className={`font-mono ${openRate > 20 ? "text-synced" : "text-text-primary"}`}>
                                                                            {formatPct(openRate)}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex justify-between text-[10px]">
                                                                        <span className="text-text-muted">Entregados</span>
                                                                        <span className="text-text-primary font-mono">{formatNumber(delivered)}</span>
                                                                    </div>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                )}
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {summaries.length === 0 && (
                            <div className="card p-12 border-dashed flex flex-col items-center gap-3">
                                <p className="text-text-muted text-small">No hay datos de canales para este cliente.</p>
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
