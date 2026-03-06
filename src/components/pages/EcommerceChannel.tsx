"use client";

import React, { useEffect, useState } from "react";
import AppLayout from "@/components/layouts/AppLayout";
import { useClient } from "@/contexts/ClientContext";
import { ChannelDailySnapshot } from "@/types/channel-snapshots";
import { UnifiedDateRange, resolvePreset, formatRangeLabel } from "@/lib/date-utils";
import DateRangePicker from "@/components/ui/DateRangePicker";

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


const CHANNEL_LABELS: Record<string, string> = {
    meta_ads: "Meta Ads",
    meta_organic: "Meta Orgánico",
    google_ads: "Google Ads",
    google_organic: "Google Orgánico",
    email: "Email",
    direct: "Directo",
    referral: "Referral",
    tiktok: "TikTok",
    pinterest: "Pinterest",
    youtube: "YouTube",
    paid_other: "Paid Otros",
};

const STOREFRONT_LABELS: Record<string, string> = {
    store: "Tienda Online",
    meli: "Mercado Libre",
    api: "API",
    form: "Formulario",
    pos: "Punto de Venta",
    unknown: "Desconocido",
};

const STOREFRONT_COLORS: Record<string, string> = {
    store: "bg-classic/50",
    meli: "bg-yellow-500/50",
    api: "bg-purple-500/50",
    form: "bg-synced/50",
    pos: "bg-orange-500/50",
    unknown: "bg-argent/30",
};

export default function EcommerceChannel() {
    const { selectedClientId: clientId } = useClient();
    const [snapshots, setSnapshots] = useState<ChannelDailySnapshot[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<UnifiedDateRange>(() => resolvePreset("mtd"));

    useEffect(() => {
        if (!clientId) return;
        setIsLoading(true);
        setError(null);

        fetch(`/api/channel-snapshots?clientId=${clientId}&channel=ECOMMERCE&startDate=${dateRange.start}&endDate=${dateRange.end}`)
            .then(res => res.json())
            .then(data => setSnapshots(data.snapshots || []))
            .catch(err => setError(err.message))
            .finally(() => setIsLoading(false));
    }, [clientId, dateRange.start, dateRange.end]);

    // Detect platform from rawData
    const platformSource = snapshots.length > 0 ? snapshots[0]?.rawData?.source : null;
    const platform = platformSource === 'shopify' ? 'Shopify'
        : platformSource === 'woocommerce' ? 'WooCommerce'
        : platformSource === 'tiendanube' ? 'Tienda Nube'
        : 'Ecommerce';

    // Aggregate totals across period
    const totals = snapshots.reduce(
        (acc, s) => ({
            orders: acc.orders + (s.metrics.orders || 0),
            revenue: acc.revenue + (s.metrics.revenue || 0),
            grossRevenue: acc.grossRevenue + (s.metrics.grossRevenue || 0),
            refunds: acc.refunds + (s.metrics.refunds || 0),
            totalDiscounts: acc.totalDiscounts + (s.metrics.totalDiscounts || 0),
            totalTax: acc.totalTax + (s.metrics.totalTax || 0),
            totalShipping: acc.totalShipping + (s.metrics.totalShipping || 0),
            cancelledOrders: acc.cancelledOrders + (s.metrics.cancelledOrders || 0),
            fulfilledOrders: acc.fulfilledOrders + (s.metrics.fulfilledOrders || 0),
            newCustomers: acc.newCustomers + (s.metrics.newCustomers || 0),
            returningCustomers: acc.returningCustomers + (s.metrics.returningCustomers || 0),
            abandonedCheckouts: acc.abandonedCheckouts + (s.metrics.abandonedCheckouts || 0),
            abandonedCheckoutValue: acc.abandonedCheckoutValue + (s.metrics.abandonedCheckoutValue || 0),
            totalItems: acc.totalItems + ((s.metrics.itemsPerOrder || 0) * (s.metrics.orders || 0)),
            totalRefundAmount: acc.totalRefundAmount + ((s.metrics as Record<string, number>).totalRefundAmount || 0),
        }),
        { orders: 0, revenue: 0, grossRevenue: 0, refunds: 0, totalDiscounts: 0, totalTax: 0, totalShipping: 0, cancelledOrders: 0, fulfilledOrders: 0, newCustomers: 0, returningCustomers: 0, abandonedCheckouts: 0, abandonedCheckoutValue: 0, totalItems: 0, totalRefundAmount: 0 }
    );
    const aov = totals.orders > 0 ? totals.revenue / totals.orders : 0;
    const discountRate = totals.grossRevenue > 0 ? (totals.totalDiscounts / totals.grossRevenue) * 100 : 0;
    const fulfillmentRate = totals.orders > 0 ? (totals.fulfilledOrders / totals.orders) * 100 : 0;
    const totalCustomers = totals.newCustomers + totals.returningCustomers;
    const repeatRate = totalCustomers > 0 ? (totals.returningCustomers / totalCustomers) * 100 : 0;
    const cartAbandRate = (totals.abandonedCheckouts + totals.orders) > 0
        ? (totals.abandonedCheckouts / (totals.abandonedCheckouts + totals.orders)) * 100
        : 0;
    const itemsPerOrder = totals.orders > 0 ? totals.totalItems / totals.orders : 0;
    const refundRate = totals.revenue > 0 ? (totals.totalRefundAmount / totals.revenue) * 100 : 0;

    // Unique customers from rawData (TiendaNube tracks this via customer IDs)
    const totalUniqueCustomers = snapshots.reduce((sum, s) => sum + ((s.rawData?.uniqueCustomers as number) || 0), 0);

    // Detect which KPIs are available (Shopify has more data than TiendaNube)
    const hasCustomerBreakdown = totals.newCustomers > 0 || totals.returningCustomers > 0;
    const hasAbandonedData = totals.abandonedCheckouts > 0;
    const hasTaxData = totals.totalTax > 0;

    // Attribution breakdown aggregated across period
    const attrMap = new Map<string, { orders: number; revenue: number }>();
    for (const s of snapshots) {
        const attrs = (s.rawData?.byAttribution as Array<{ source: string; orders: number; revenue: number }>) || [];
        for (const a of attrs) {
            const existing = attrMap.get(a.source) || { orders: 0, revenue: 0 };
            existing.orders += a.orders;
            existing.revenue += a.revenue;
            attrMap.set(a.source, existing);
        }
    }
    const attributionData = Array.from(attrMap.entries())
        .map(([source, data]) => ({ source, ...data }))
        .sort((a, b) => b.revenue - a.revenue);
    const totalAttrRevenue = attributionData.reduce((s, a) => s + a.revenue, 0);

    // Revenue by Country aggregated
    const countryMap = new Map<string, { orders: number; revenue: number }>();
    for (const s of snapshots) {
        const countries = (s.rawData?.byCountry as Array<{ country: string; orders: number; revenue: number }>) || [];
        for (const c of countries) {
            const existing = countryMap.get(c.country) || { orders: 0, revenue: 0 };
            existing.orders += c.orders;
            existing.revenue += c.revenue;
            countryMap.set(c.country, existing);
        }
    }
    const countryData = Array.from(countryMap.entries())
        .map(([country, data]) => ({ country, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);
    const totalCountryRevenue = countryData.reduce((s, c) => s + c.revenue, 0);

    // Storefront breakdown for Tienda Nube
    const storefrontMap = new Map<string, { orders: number; revenue: number }>();
    if (platformSource === 'tiendanube') {
        for (const s of snapshots) {
            const byStorefront = (s.rawData?.byStorefront as Record<string, { orders: number; revenue: number }>) || {};
            for (const [sf, data] of Object.entries(byStorefront)) {
                const existing = storefrontMap.get(sf) || { orders: 0, revenue: 0 };
                existing.orders += data.orders;
                existing.revenue += data.revenue;
                storefrontMap.set(sf, existing);
            }
        }
    }
    const storefrontData = Array.from(storefrontMap.entries())
        .map(([storefront, data]) => ({ storefront, ...data, aov: data.orders > 0 ? data.revenue / data.orders : 0 }))
        .sort((a, b) => b.revenue - a.revenue);
    const totalStorefrontRevenue = storefrontData.reduce((s, d) => s + d.revenue, 0);

    // Customer Cohorts aggregated (with LTV for Shopify)
    const cohortAcc = {
        firstTime: { count: 0, revenue: 0, totalLtv: 0, ltvCustomers: 0 },
        returning: { count: 0, revenue: 0, totalLtv: 0, ltvCustomers: 0 },
        vip: { count: 0, revenue: 0, totalLtv: 0, ltvCustomers: 0 },
    };
    let hasCohortData = false;
    for (const s of snapshots) {
        const cohorts = s.rawData?.customerCohorts as {
            firstTime?: { count: number; revenue: number; avgLtv?: number };
            returning?: { count: number; revenue: number; avgLtv?: number };
            vip?: { count: number; revenue: number; avgLtv?: number };
        } | undefined;
        if (cohorts) {
            hasCohortData = true;
            if (cohorts.firstTime) {
                cohortAcc.firstTime.count += cohorts.firstTime.count;
                cohortAcc.firstTime.revenue += cohorts.firstTime.revenue;
                if (cohorts.firstTime.avgLtv) { cohortAcc.firstTime.totalLtv += cohorts.firstTime.avgLtv * cohorts.firstTime.count; cohortAcc.firstTime.ltvCustomers += cohorts.firstTime.count; }
            }
            if (cohorts.returning) {
                cohortAcc.returning.count += cohorts.returning.count;
                cohortAcc.returning.revenue += cohorts.returning.revenue;
                if (cohorts.returning.avgLtv) { cohortAcc.returning.totalLtv += cohorts.returning.avgLtv * cohorts.returning.count; cohortAcc.returning.ltvCustomers += cohorts.returning.count; }
            }
            if (cohorts.vip) {
                cohortAcc.vip.count += cohorts.vip.count;
                cohortAcc.vip.revenue += cohorts.vip.revenue;
                if (cohorts.vip.avgLtv) { cohortAcc.vip.totalLtv += cohorts.vip.avgLtv * cohorts.vip.count; cohortAcc.vip.ltvCustomers += cohorts.vip.count; }
            }
        }
    }
    const firstTimeLtv = cohortAcc.firstTime.ltvCustomers > 0 ? cohortAcc.firstTime.totalLtv / cohortAcc.firstTime.ltvCustomers : 0;
    const returningLtv = cohortAcc.returning.ltvCustomers > 0 ? cohortAcc.returning.totalLtv / cohortAcc.returning.ltvCustomers : 0;
    const vipLtv = cohortAcc.vip.ltvCustomers > 0 ? cohortAcc.vip.totalLtv / cohortAcc.vip.ltvCustomers : 0;
    const hasLtvData = firstTimeLtv > 0 || returningLtv > 0 || vipLtv > 0;
    const cohortTotal = cohortAcc.firstTime.count + cohortAcc.returning.count + cohortAcc.vip.count;
    const cohortFirstPct = cohortTotal > 0 ? (cohortAcc.firstTime.count / cohortTotal) * 100 : 0;
    const cohortRetPct = cohortTotal > 0 ? (cohortAcc.returning.count / cohortTotal) * 100 : 0;
    const cohortVipPct = cohortTotal > 0 ? (cohortAcc.vip.count / cohortTotal) * 100 : 0;

    // Top products aggregated
    const productMap = new Map<number, { title: string; unitsSold: number; revenue: number; orders: number }>();
    for (const s of snapshots) {
        const products = (s.rawData?.topProducts as Array<{ productId: number; title: string; unitsSold: number; revenue: number; orders: number }>) || [];
        for (const p of products) {
            const existing = productMap.get(p.productId);
            if (existing) {
                existing.unitsSold += p.unitsSold;
                existing.revenue += p.revenue;
                existing.orders += p.orders;
            } else {
                productMap.set(p.productId, { title: p.title, unitsSold: p.unitsSold, revenue: p.revenue, orders: p.orders });
            }
        }
    }
    const topProducts = Array.from(productMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

    // Top discount codes aggregated
    const discountCodeMap = new Map<string, { uses: number; totalDiscount: number }>();
    for (const s of snapshots) {
        const codes = (s.rawData?.topDiscountCodes as Array<{ code: string; uses: number; totalDiscount: number }>) || [];
        for (const c of codes) {
            const existing = discountCodeMap.get(c.code) || { uses: 0, totalDiscount: 0 };
            existing.uses += c.uses;
            existing.totalDiscount += c.totalDiscount;
            discountCodeMap.set(c.code, existing);
        }
    }
    const topDiscountCodes = Array.from(discountCodeMap.entries())
        .map(([code, data]) => ({ code, ...data }))
        .sort((a, b) => b.uses - a.uses)
        .slice(0, 5);

    return (
        <AppLayout>
            <div className="space-y-8 pb-20">
                {/* Header + Period Filter */}
                <header className="flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-text-primary uppercase tracking-tighter">
                            Ecommerce
                        </h1>
                        <p className="text-small text-text-muted font-bold uppercase tracking-widest mt-1">
                            {platform} &bull; {formatRangeLabel(dateRange)}
                        </p>
                    </div>
                    <DateRangePicker value={dateRange} onChange={setDateRange} />
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
                        <p className="text-text-muted text-small">No hay datos de ecommerce para este período.</p>
                        <p className="text-[10px] text-text-muted">Verificá que la integración esté activa y el cron haya corrido.</p>
                    </div>
                )}

                {!isLoading && !error && snapshots.length > 0 && (
                    <>
                        {/* ── Primary KPIs ── */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <KPICard label="Revenue" value={formatCurrency(totals.revenue)} color="text-synced" />
                            <KPICard label="Órdenes" value={formatNumber(totals.orders)} />
                            <KPICard label="Ticket Promedio" value={formatCurrency(aov)} subtitle="AOV" />
                            <KPICard label="Items / Orden" value={formatNumber(itemsPerOrder, 1)} />
                        </div>

                        {/* ── Financial Breakdown ── */}
                        <div className={`grid grid-cols-2 ${hasTaxData ? "lg:grid-cols-6" : "lg:grid-cols-5"} gap-4`}>
                            <KPICard label="Revenue Bruto" value={formatCurrency(totals.grossRevenue)} subtitle="Antes de descuentos" />
                            <KPICard label="Descuentos" value={formatCurrency(totals.totalDiscounts)} subtitle={`${formatPct(discountRate)} del bruto`} color={discountRate > 15 ? "text-yellow-400" : "text-text-primary"} />
                            <KPICard label="Envíos Cobrados" value={formatCurrency(totals.totalShipping)} />
                            {hasTaxData && <KPICard label="Impuestos" value={formatCurrency(totals.totalTax)} />}
                            <KPICard label="Reembolsos" value={formatNumber(totals.refunds)} subtitle={`${totals.orders > 0 ? ((totals.refunds / totals.orders) * 100).toFixed(1) : 0}% tasa`} color={totals.refunds > 0 ? "text-red-400" : "text-text-primary"} />
                            <KPICard label="Refund Amount" value={formatCurrency(totals.totalRefundAmount)} subtitle={`${formatPct(refundRate)} refund rate`} color={refundRate > 5 ? "text-red-400" : "text-text-primary"} />
                        </div>

                        {/* ── Customer & Operations ── */}
                        <div className={`grid grid-cols-2 ${hasCustomerBreakdown ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-4`}>
                            <KPICard
                                label="Clientes Únicos"
                                value={formatNumber(totalUniqueCustomers)}
                                subtitle={totals.orders > 0 ? `${(totalUniqueCustomers / totals.orders * 100).toFixed(0)}% ratio cliente/orden` : undefined}
                                color="text-classic"
                            />
                            {hasCustomerBreakdown && (
                                <KPICard
                                    label="Clientes Recurrentes"
                                    value={formatNumber(totals.returningCustomers)}
                                    subtitle={`${formatPct(repeatRate)} repeat rate`}
                                    color={repeatRate > 30 ? "text-synced" : "text-text-primary"}
                                />
                            )}
                            {hasAbandonedData && (
                                <KPICard
                                    label="Carritos Abandonados"
                                    value={formatNumber(totals.abandonedCheckouts)}
                                    subtitle={`${formatPct(cartAbandRate)} tasa • ${formatCurrency(totals.abandonedCheckoutValue)} perdidos`}
                                    color={cartAbandRate > 70 ? "text-red-400" : "text-yellow-400"}
                                />
                            )}
                            <KPICard
                                label="Fulfillment"
                                value={`${formatPct(fulfillmentRate)}`}
                                subtitle={`${totals.fulfilledOrders} enviados • ${totals.cancelledOrders} cancelados`}
                                color={fulfillmentRate > 90 ? "text-synced" : "text-yellow-400"}
                            />
                        </div>

                        {/* ── Storefront Performance (Tienda Nube only) ── */}
                        {platformSource === 'tiendanube' && storefrontData.length > 0 && (
                            <div className="card p-6">
                                <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                    Performance por Canal de Venta
                                </h2>
                                <div className="space-y-2">
                                    {storefrontData.map((sf) => {
                                        const pct = totalStorefrontRevenue > 0 ? (sf.revenue / totalStorefrontRevenue) * 100 : 0;
                                        return (
                                            <div key={sf.storefront} className="flex items-center gap-3 text-[11px]">
                                                <span className="text-text-secondary font-bold w-28 shrink-0 text-[10px]">
                                                    {STOREFRONT_LABELS[sf.storefront] || sf.storefront}
                                                </span>
                                                <div className="flex-1 h-5 bg-argent/20 relative">
                                                    <div
                                                        className={`h-full ${STOREFRONT_COLORS[sf.storefront] || "bg-classic/30"}`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                                <span className="text-text-secondary font-mono w-16 text-right">{formatCurrency(sf.revenue)}</span>
                                                <span className="text-text-muted font-mono w-12 text-right">{sf.orders} ord</span>
                                                <span className="text-text-muted font-mono w-16 text-right">AOV {formatCurrency(sf.aov)}</span>
                                                <span className="text-text-muted font-mono w-12 text-right">{pct.toFixed(1)}%</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* ── Attribution (cross-channel, skip for Tienda Nube since storefront = attribution) ── */}
                        {attributionData.length > 0 && platformSource !== 'tiendanube' && (
                            <div className="card p-6">
                                <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                    Atribución por Canal
                                </h2>
                                <div className="space-y-2">
                                    {attributionData.map((attr) => {
                                        const pct = totalAttrRevenue > 0 ? (attr.revenue / totalAttrRevenue) * 100 : 0;
                                        return (
                                            <div key={attr.source} className="flex items-center gap-3 text-[11px]">
                                                <span className="text-text-secondary font-bold w-28 shrink-0 uppercase text-[10px]">
                                                    {CHANNEL_LABELS[attr.source] || attr.source}
                                                </span>
                                                <div className="flex-1 h-5 bg-argent/20 relative">
                                                    <div
                                                        className={`h-full ${
                                                            attr.source === "meta_ads" ? "bg-blue-500/50" :
                                                            attr.source === "google_ads" ? "bg-yellow-500/50" :
                                                            attr.source === "email" ? "bg-purple-500/50" :
                                                            attr.source === "direct" ? "bg-synced/50" :
                                                            "bg-classic/30"
                                                        }`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                                <span className="text-text-secondary font-mono w-16 text-right">
                                                    {formatCurrency(attr.revenue)}
                                                </span>
                                                <span className="text-text-muted font-mono w-10 text-right">
                                                    {attr.orders}
                                                </span>
                                                <span className="text-text-muted font-mono w-12 text-right">
                                                    {pct.toFixed(1)}%
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* ── Revenue by Country ── */}
                        {countryData.length > 0 && (
                            <div className="card p-6">
                                <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                    Revenue por País
                                </h2>
                                <div className="space-y-2">
                                    {countryData.map((c) => {
                                        const maxCountryRev = countryData[0]?.revenue || 1;
                                        const barWidth = (c.revenue / maxCountryRev) * 100;
                                        const pct = totalCountryRevenue > 0 ? (c.revenue / totalCountryRevenue) * 100 : 0;
                                        return (
                                            <div key={c.country} className="flex items-center gap-3 text-[11px]">
                                                <span className="text-text-secondary font-bold w-10 shrink-0 uppercase text-[10px]">
                                                    {c.country}
                                                </span>
                                                <div className="flex-1 h-5 bg-argent/20 relative">
                                                    <div className="h-full bg-classic/40" style={{ width: `${barWidth}%` }} />
                                                </div>
                                                <span className="text-text-secondary font-mono w-16 text-right">
                                                    {formatCurrency(c.revenue)}
                                                </span>
                                                <span className="text-text-muted font-mono w-14 text-right">
                                                    {c.orders} ord
                                                </span>
                                                <span className="text-text-muted font-mono w-12 text-right">
                                                    {pct.toFixed(0)}%
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* ── Customer Cohorts ── */}
                        {hasCohortData && cohortTotal > 0 && (
                            <div className="card p-6">
                                <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                    Cohortes de Clientes
                                </h2>
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                                    <div className="bg-stellar border border-argent p-4">
                                        <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Primera Compra</p>
                                        <p className="text-2xl font-black text-classic font-mono mt-2">{formatNumber(cohortAcc.firstTime.count)}</p>
                                        <p className="text-[10px] text-text-muted mt-1">
                                            {formatCurrency(cohortAcc.firstTime.revenue)} revenue
                                        </p>
                                        <p className="text-[10px] text-text-muted">
                                            AOV {formatCurrency(cohortAcc.firstTime.count > 0 ? cohortAcc.firstTime.revenue / cohortAcc.firstTime.count : 0)}
                                        </p>
                                        {hasLtvData && firstTimeLtv > 0 && (
                                            <p className="text-[10px] text-classic font-bold mt-1">
                                                LTV {formatCurrency(firstTimeLtv)}
                                            </p>
                                        )}
                                    </div>
                                    <div className="bg-stellar border border-argent p-4">
                                        <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Recurrentes (2-5)</p>
                                        <p className="text-2xl font-black text-synced font-mono mt-2">{formatNumber(cohortAcc.returning.count)}</p>
                                        <p className="text-[10px] text-text-muted mt-1">
                                            {formatCurrency(cohortAcc.returning.revenue)} revenue
                                        </p>
                                        <p className="text-[10px] text-text-muted">
                                            AOV {formatCurrency(cohortAcc.returning.count > 0 ? cohortAcc.returning.revenue / cohortAcc.returning.count : 0)}
                                        </p>
                                        {hasLtvData && returningLtv > 0 && (
                                            <p className="text-[10px] text-synced font-bold mt-1">
                                                LTV {formatCurrency(returningLtv)}
                                            </p>
                                        )}
                                    </div>
                                    <div className="bg-stellar border border-argent p-4">
                                        <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">VIP (6+)</p>
                                        <p className="text-2xl font-black text-yellow-400 font-mono mt-2">{formatNumber(cohortAcc.vip.count)}</p>
                                        <p className="text-[10px] text-text-muted mt-1">
                                            {formatCurrency(cohortAcc.vip.revenue)} revenue
                                        </p>
                                        <p className="text-[10px] text-text-muted">
                                            AOV {formatCurrency(cohortAcc.vip.count > 0 ? cohortAcc.vip.revenue / cohortAcc.vip.count : 0)}
                                        </p>
                                        {hasLtvData && vipLtv > 0 && (
                                            <p className="text-[10px] text-yellow-400 font-bold mt-1">
                                                LTV {formatCurrency(vipLtv)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                {/* Stacked proportion bar */}
                                <div className="flex h-6 w-full overflow-hidden">
                                    {cohortFirstPct > 0 && (
                                        <div
                                            className="bg-classic/50 flex items-center justify-center text-[9px] font-mono text-text-primary font-bold"
                                            style={{ width: `${cohortFirstPct}%` }}
                                            title={`Primera Compra: ${cohortFirstPct.toFixed(1)}%`}
                                        >
                                            {cohortFirstPct >= 8 ? `${cohortFirstPct.toFixed(0)}%` : ""}
                                        </div>
                                    )}
                                    {cohortRetPct > 0 && (
                                        <div
                                            className="bg-synced/50 flex items-center justify-center text-[9px] font-mono text-text-primary font-bold"
                                            style={{ width: `${cohortRetPct}%` }}
                                            title={`Recurrentes: ${cohortRetPct.toFixed(1)}%`}
                                        >
                                            {cohortRetPct >= 8 ? `${cohortRetPct.toFixed(0)}%` : ""}
                                        </div>
                                    )}
                                    {cohortVipPct > 0 && (
                                        <div
                                            className="bg-yellow-400/50 flex items-center justify-center text-[9px] font-mono text-text-primary font-bold"
                                            style={{ width: `${cohortVipPct}%` }}
                                            title={`VIP: ${cohortVipPct.toFixed(1)}%`}
                                        >
                                            {cohortVipPct >= 8 ? `${cohortVipPct.toFixed(0)}%` : ""}
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-4 mt-2 text-[9px] text-text-muted">
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 bg-classic/50 inline-block" /> Primera Compra</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 bg-synced/50 inline-block" /> Recurrentes</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-400/50 inline-block" /> VIP</span>
                                </div>
                            </div>
                        )}

                        {/* ── Top Products ── */}
                        {topProducts.length > 0 && (
                            <div className="card p-6">
                                <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                    Top Productos
                                </h2>
                                <div className="space-y-2">
                                    {topProducts.map((p, i) => {
                                        const maxRev = topProducts[0]?.revenue || 1;
                                        const barWidth = (p.revenue / maxRev) * 100;
                                        return (
                                            <div key={p.title + i} className="flex items-center gap-3 text-[11px]">
                                                <span className="text-text-muted font-mono w-6 shrink-0 text-right">#{i + 1}</span>
                                                <span className="text-text-secondary w-48 shrink-0 truncate" title={p.title}>{p.title}</span>
                                                <div className="flex-1 h-4 bg-argent/20 relative">
                                                    <div className="h-full bg-synced/40" style={{ width: `${barWidth}%` }} />
                                                </div>
                                                <span className="text-text-secondary font-mono w-16 text-right">{formatCurrency(p.revenue)}</span>
                                                <span className="text-text-muted font-mono w-12 text-right">{p.unitsSold} uds</span>
                                                <span className="text-text-muted font-mono w-10 text-right">{p.orders} ord</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* ── Discount Codes ── */}
                        {topDiscountCodes.length > 0 && (
                            <div className="card p-6">
                                <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                    Códigos de Descuento
                                </h2>
                                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                                    {topDiscountCodes.map((dc) => (
                                        <div key={dc.code} className="bg-stellar border border-argent p-3">
                                            <p className="text-[11px] font-black text-classic font-mono">{dc.code}</p>
                                            <p className="text-lg font-black text-text-primary font-mono mt-1">{dc.uses} usos</p>
                                            <p className="text-[10px] text-text-muted">{formatCurrency(dc.totalDiscount)} descuento total</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── Daily Trend ── */}
                        <div className="card p-6">
                            <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4">
                                Revenue Diario
                            </h2>
                            <div className="grid grid-cols-1 gap-2">
                                {snapshots.map((s) => {
                                    const maxRevenue = Math.max(...snapshots.map(x => x.metrics.revenue || 0), 1);
                                    const barWidth = ((s.metrics.revenue || 0) / maxRevenue) * 100;
                                    return (
                                        <div key={s.date} className="flex items-center gap-3 text-[11px]">
                                            <span className="text-text-muted font-mono w-16 shrink-0">{formatDate(s.date)}</span>
                                            <div className="flex-1 h-4 bg-argent/20 relative">
                                                <div className="h-full bg-synced/50" style={{ width: `${barWidth}%` }} />
                                            </div>
                                            <span className="text-text-secondary font-mono w-16 text-right">{formatCurrency(s.metrics.revenue)}</span>
                                            <span className="text-text-muted font-mono w-10 text-right">{s.metrics.orders || 0} ord</span>
                                            <span className="text-text-muted font-mono w-10 text-right">{(s.rawData?.uniqueCustomers as number) || s.metrics.newCustomers || 0} cli</span>
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
