"use client";

import React from "react";
import KPICard, { calcDelta } from "@/components/ui/KPICard";
import PublicInsightBanner, {
  ADS_RULES,
  ECOMMERCE_RULES,
  EMAIL_RULES,
} from "@/components/public/PublicInsightBanner";
import { ChannelDailySnapshot } from "@/types/channel-snapshots";

interface PublicChannelViewProps {
  channel: string;
  snapshots: ChannelDailySnapshot[];
  prevSnapshots: ChannelDailySnapshot[];
  currency?: string;
}

function fCur(val: number | undefined, prefix = "$"): string {
  if (val == null) return "\u2014";
  if (val >= 1_000_000) return `${prefix}${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${prefix}${(val / 1_000).toFixed(1)}K`;
  return `${prefix}${val.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fNum(val: number | undefined, decimals = 1): string {
  if (val == null) return "\u2014";
  return val.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

function fPct(val: number | undefined): string {
  if (val == null) return "\u2014";
  return `${val.toFixed(2)}%`;
}

function aggregate(snaps: ChannelDailySnapshot[]) {
  const totals: Record<string, number> = {};
  const additiveKeys = [
    "spend", "revenue", "conversions", "impressions", "clicks", "reach",
    "orders", "grossRevenue", "netRevenue", "totalDiscounts", "totalShipping", "totalTax",
    "newCustomers", "returningCustomers", "fulfilledOrders", "cancelledOrders",
    "abandonedCheckouts", "abandonedCheckoutValue",
    "sent", "delivered", "opens", "emailClicks", "bounces", "unsubscribes", "emailRevenue",
    "videoPlays", "videoP25", "videoP50", "videoP75", "videoP100",
    "sessions", "totalUsers", "newUsers", "pageviews", "engagedSessions",
    "viewItem", "addToCart", "beginCheckout", "ecommercePurchases", "purchaseRevenue",
  ];
  for (const snap of snaps) {
    for (const key of additiveKeys) {
      const val = (snap.metrics as Record<string, number | undefined>)?.[key];
      if (val != null && isFinite(val)) {
        totals[key] = (totals[key] || 0) + val;
      }
    }
  }

  // Derived
  if (totals.spend > 0 && totals.revenue > 0) totals.roas = totals.revenue / totals.spend;
  if (totals.spend > 0 && totals.conversions > 0) totals.cpa = totals.spend / totals.conversions;
  if (totals.impressions > 0 && totals.clicks > 0) totals.ctr = (totals.clicks / totals.impressions) * 100;
  if (totals.orders > 0 && (totals.revenue > 0 || totals.grossRevenue > 0)) {
    totals.avgOrderValue = (totals.revenue || totals.grossRevenue) / totals.orders;
  }
  if (totals.sent > 0 && totals.opens > 0) totals.openRate = (totals.opens / totals.sent) * 100;
  if (totals.sent > 0 && totals.emailClicks > 0) totals.clickRate = (totals.emailClicks / totals.sent) * 100;
  // Ecommerce derived
  if ((totals.newCustomers || 0) + (totals.returningCustomers || 0) > 0) {
    totals.repeatPurchaseRate = (totals.returningCustomers / ((totals.newCustomers || 0) + (totals.returningCustomers || 0))) * 100;
  }
  if ((totals.fulfilledOrders || 0) > 0 && totals.orders > 0) {
    totals.fulfillmentRate = (totals.fulfilledOrders / totals.orders) * 100;
  }
  if ((totals.abandonedCheckouts || 0) > 0 && totals.orders > 0) {
    totals.cartAbandonmentRate = (totals.abandonedCheckouts / (totals.abandonedCheckouts + totals.orders)) * 100;
  }
  if (totals.totalDiscounts > 0 && (totals.grossRevenue || totals.revenue) > 0) {
    totals.discountRate = (totals.totalDiscounts / (totals.grossRevenue || totals.revenue)) * 100;
  }
  // GA4 derived
  if (totals.sessions > 0 && totals.engagedSessions > 0) totals.engagementRate = (totals.engagedSessions / totals.sessions) * 100;
  if (totals.sessions > 0 && totals.ecommercePurchases > 0) totals.ecommerceConversionRate = (totals.ecommercePurchases / totals.sessions) * 100;

  return totals;
}

export default function PublicChannelView({
  channel,
  snapshots,
  prevSnapshots,
  currency = "$",
}: PublicChannelViewProps) {
  const curr = aggregate(snapshots);
  const prev = aggregate(prevSnapshots);

  if (channel === "META" || channel === "GOOGLE") {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard label="Inversion" value={fCur(curr.spend, currency)} delta={calcDelta(curr.spend || 0, prev.spend || 0)} />
          <KPICard label="Conversiones" value={fNum(curr.conversions)} delta={calcDelta(curr.conversions || 0, prev.conversions || 0)} />
          <KPICard label="Costo por Conversion" value={fCur(curr.cpa, currency)} delta={calcDelta(curr.cpa || 0, prev.cpa || 0)} deltaInverse />
          <KPICard label="ROAS" value={curr.roas ? `${curr.roas.toFixed(2)}x` : "\u2014"} delta={calcDelta(curr.roas || 0, prev.roas || 0)} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard label="Impresiones" value={fNum(curr.impressions, 0)} delta={calcDelta(curr.impressions || 0, prev.impressions || 0)} />
          <KPICard label="Clicks" value={fNum(curr.clicks, 0)} delta={calcDelta(curr.clicks || 0, prev.clicks || 0)} />
          <KPICard label="CTR" value={fPct(curr.ctr)} delta={calcDelta(curr.ctr || 0, prev.ctr || 0)} />
          <KPICard label="Revenue" value={fCur(curr.revenue, currency)} delta={calcDelta(curr.revenue || 0, prev.revenue || 0)} />
        </div>

        <PublicInsightBanner current={curr} previous={prev} rules={ADS_RULES} currency={currency} />

        {renderTopCampaigns(snapshots, currency)}
      </div>
    );
  }

  if (channel === "ECOMMERCE") {
    const rev = curr.revenue || curr.grossRevenue || 0;
    const prevRev = prev.revenue || prev.grossRevenue || 0;

    return (
      <div className="space-y-6">
        {/* Row 1: Core financials */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard label="Revenue" value={fCur(rev, currency)} delta={calcDelta(rev, prevRev)} />
          <KPICard label="Ordenes" value={fNum(curr.orders, 0)} delta={calcDelta(curr.orders || 0, prev.orders || 0)} />
          <KPICard label="Ticket Promedio" value={fCur(curr.avgOrderValue, currency)} delta={calcDelta(curr.avgOrderValue || 0, prev.avgOrderValue || 0)} />
          <KPICard label="Descuentos" value={fCur(curr.totalDiscounts, currency)} delta={calcDelta(curr.totalDiscounts || 0, prev.totalDiscounts || 0)} deltaInverse />
        </div>

        {/* Row 2: Customer metrics */}
        {((curr.newCustomers || 0) > 0 || (curr.returningCustomers || 0) > 0) && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard label="Clientes Nuevos" value={fNum(curr.newCustomers, 0)} delta={calcDelta(curr.newCustomers || 0, prev.newCustomers || 0)} />
            <KPICard label="Clientes Recurrentes" value={fNum(curr.returningCustomers, 0)} delta={calcDelta(curr.returningCustomers || 0, prev.returningCustomers || 0)} />
            <KPICard label="Tasa de Recompra" value={fPct(curr.repeatPurchaseRate)} delta={calcDelta(curr.repeatPurchaseRate || 0, prev.repeatPurchaseRate || 0)} />
            <KPICard
              label="Envios Cobrados"
              value={fCur(curr.totalShipping, currency)}
              delta={calcDelta(curr.totalShipping || 0, prev.totalShipping || 0)}
            />
          </div>
        )}

        {/* Row 3: Operations (if data available) */}
        {((curr.fulfilledOrders || 0) > 0 || (curr.abandonedCheckouts || 0) > 0) && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard
              label="Tasa de Cumplimiento"
              value={fPct(curr.fulfillmentRate)}
              delta={calcDelta(curr.fulfillmentRate || 0, prev.fulfillmentRate || 0)}
            />
            <KPICard
              label="Ordenes Canceladas"
              value={fNum(curr.cancelledOrders, 0)}
              delta={calcDelta(curr.cancelledOrders || 0, prev.cancelledOrders || 0)}
              deltaInverse
            />
            <KPICard
              label="Carritos Abandonados"
              value={fNum(curr.abandonedCheckouts, 0)}
              delta={calcDelta(curr.abandonedCheckouts || 0, prev.abandonedCheckouts || 0)}
              deltaInverse
            />
            <KPICard
              label="Tasa de Abandono"
              value={fPct(curr.cartAbandonmentRate)}
              delta={calcDelta(curr.cartAbandonmentRate || 0, prev.cartAbandonmentRate || 0)}
              deltaInverse
            />
          </div>
        )}

        <PublicInsightBanner
          current={{ ...curr, revenue: rev }}
          previous={{ ...prev, revenue: prevRev }}
          rules={ECOMMERCE_RULES}
          currency={currency}
        />

        {renderTopProducts(snapshots, currency)}
      </div>
    );
  }

  if (channel === "EMAIL") {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard label="Enviados" value={fNum(curr.sent, 0)} delta={calcDelta(curr.sent || 0, prev.sent || 0)} />
          <KPICard label="Tasa de Apertura" value={fPct(curr.openRate)} delta={calcDelta(curr.openRate || 0, prev.openRate || 0)} />
          <KPICard label="Tasa de Clicks" value={fPct(curr.clickRate)} delta={calcDelta(curr.clickRate || 0, prev.clickRate || 0)} />
          <KPICard label="Revenue" value={fCur(curr.emailRevenue, currency)} delta={calcDelta(curr.emailRevenue || 0, prev.emailRevenue || 0)} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard label="Entregados" value={fNum(curr.delivered, 0)} delta={calcDelta(curr.delivered || 0, prev.delivered || 0)} />
          <KPICard label="Rebotes" value={fNum(curr.bounces, 0)} delta={calcDelta(curr.bounces || 0, prev.bounces || 0)} deltaInverse />
          <KPICard label="Desuscripciones" value={fNum(curr.unsubscribes, 0)} delta={calcDelta(curr.unsubscribes || 0, prev.unsubscribes || 0)} deltaInverse />
          <KPICard label="Aperturas" value={fNum(curr.opens, 0)} delta={calcDelta(curr.opens || 0, prev.opens || 0)} />
        </div>

        <PublicInsightBanner current={curr} previous={prev} rules={EMAIL_RULES} currency={currency} />
      </div>
    );
  }

  if (channel === "GA4") {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard label="Sesiones" value={fNum(curr.sessions, 0)} delta={calcDelta(curr.sessions || 0, prev.sessions || 0)} />
          <KPICard label="Usuarios" value={fNum(curr.totalUsers, 0)} delta={calcDelta(curr.totalUsers || 0, prev.totalUsers || 0)} />
          <KPICard label="Engagement Rate" value={fPct(curr.engagementRate)} delta={calcDelta(curr.engagementRate || 0, prev.engagementRate || 0)} />
          <KPICard label="Conv. Rate" value={fPct(curr.ecommerceConversionRate)} delta={calcDelta(curr.ecommerceConversionRate || 0, prev.ecommerceConversionRate || 0)} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard label="Pageviews" value={fNum(curr.pageviews, 0)} delta={calcDelta(curr.pageviews || 0, prev.pageviews || 0)} />
          <KPICard label="Compras" value={fNum(curr.ecommercePurchases, 0)} delta={calcDelta(curr.ecommercePurchases || 0, prev.ecommercePurchases || 0)} />
          <KPICard label="Revenue GA4" value={fCur(curr.purchaseRevenue, currency)} delta={calcDelta(curr.purchaseRevenue || 0, prev.purchaseRevenue || 0)} />
          <KPICard label="Nuevos Usuarios" value={fNum(curr.newUsers, 0)} delta={calcDelta(curr.newUsers || 0, prev.newUsers || 0)} />
        </div>
      </div>
    );
  }

  return <p className="text-white/40 text-sm">No hay datos para este canal.</p>;
}

function renderTopCampaigns(snapshots: ChannelDailySnapshot[], currency: string) {
  const campaignMap = new Map<string, { name: string; spend: number; conversions: number; revenue: number }>();
  for (const snap of snapshots) {
    const campaigns = (snap.rawData?.campaigns as any[]) || [];
    for (const c of campaigns) {
      const name = c.name || c.campaignName || "Unknown";
      const existing = campaignMap.get(name);
      if (existing) {
        existing.spend += c.spend || 0;
        existing.conversions += c.conversions || 0;
        existing.revenue += c.revenue || c.purchaseValue || 0;
      } else {
        campaignMap.set(name, {
          name,
          spend: c.spend || 0,
          conversions: c.conversions || 0,
          revenue: c.revenue || c.purchaseValue || 0,
        });
      }
    }
  }

  const campaigns = Array.from(campaignMap.values())
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 10);

  if (campaigns.length === 0) return null;

  return (
    <div className="bg-special/50 border border-white/5 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5">
        <h3 className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Top Campanas</h3>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-white/30 text-[10px] uppercase tracking-wider">
            <th className="text-left px-4 py-2">Campana</th>
            <th className="text-right px-4 py-2">Spend</th>
            <th className="text-right px-4 py-2">Conv</th>
            <th className="text-right px-4 py-2">Revenue</th>
            <th className="text-right px-4 py-2">ROAS</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c, i) => {
            const roas = c.spend > 0 ? c.revenue / c.spend : 0;
            return (
              <tr key={i} className="border-t border-white/5">
                <td className="px-4 py-2 text-white/80 truncate max-w-[200px]">{c.name}</td>
                <td className="px-4 py-2 text-right text-white/60">{currency}{c.spend.toFixed(0)}</td>
                <td className="px-4 py-2 text-right text-white/60">{c.conversions}</td>
                <td className="px-4 py-2 text-right text-white/60">{currency}{c.revenue.toFixed(0)}</td>
                <td className={`px-4 py-2 text-right font-mono font-bold ${roas >= 2 ? "text-synced" : roas >= 1 ? "text-classic" : "text-red-400"}`}>
                  {roas > 0 ? `${roas.toFixed(2)}x` : "\u2014"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function renderTopProducts(snapshots: ChannelDailySnapshot[], currency: string) {
  const productMap = new Map<string, { name: string; orders: number; revenue: number }>();
  for (const snap of snapshots) {
    const products = (snap.rawData?.topProducts as any[]) || [];
    for (const p of products) {
      const name = p.name || p.title || "Unknown";
      const existing = productMap.get(name);
      if (existing) {
        existing.orders += p.orders || p.quantity || 0;
        existing.revenue += p.revenue || p.totalRevenue || 0;
      } else {
        productMap.set(name, {
          name,
          orders: p.orders || p.quantity || 0,
          revenue: p.revenue || p.totalRevenue || 0,
        });
      }
    }
  }

  const products = Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  if (products.length === 0) return null;

  return (
    <div className="bg-special/50 border border-white/5 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5">
        <h3 className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Top Productos</h3>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-white/30 text-[10px] uppercase tracking-wider">
            <th className="text-left px-4 py-2">Producto</th>
            <th className="text-right px-4 py-2">Ordenes</th>
            <th className="text-right px-4 py-2">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p, i) => (
            <tr key={i} className="border-t border-white/5">
              <td className="px-4 py-2 text-white/80 truncate max-w-[200px]">{p.name}</td>
              <td className="px-4 py-2 text-right text-white/60">{p.orders}</td>
              <td className="px-4 py-2 text-right text-white/60">{currency}{p.revenue.toFixed(0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
