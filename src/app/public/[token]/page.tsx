"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import PublicChannelView from "@/components/public/PublicChannelView";
import PublicInsightBanner, { OVERVIEW_RULES } from "@/components/public/PublicInsightBanner";
import KPICard, { calcDelta } from "@/components/ui/KPICard";
import { ChannelDailySnapshot } from "@/types/channel-snapshots";
import DateRangePicker from "@/components/ui/DateRangePicker";
import { UnifiedDateRange, resolvePreset, getComparisonRange } from "@/lib/date-utils";

interface ClientInfo {
  id: string;
  name: string;
  businessType?: string;
  currency?: string;
  targetCpa?: number;
  targetRoas?: number;
}

const CHANNEL_LABELS: Record<string, string> = {
  META: "Meta Ads",
  GOOGLE: "Google Ads",
  ECOMMERCE: "Ecommerce",
  EMAIL: "Email Marketing",
  GA4: "Google Analytics",
};

const CHANNEL_ICONS: Record<string, string> = {
  META: "/img/logos/meta.png",
  GOOGLE: "/img/logos/google.png",
  ECOMMERCE: "/img/logos/shopify.png",
  EMAIL: "/img/logos/klaviyo.png",
  GA4: "/img/logos/analytics logo.png",
};

type PageState = "loading" | "ready" | "error";

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
  return `${val.toFixed(1)}%`;
}

/** Aggregate additive metrics from snapshots */
function aggregateChannel(snaps: ChannelDailySnapshot[]) {
  const totals: Record<string, number> = {};
  const additiveKeys = [
    "spend", "revenue", "conversions", "impressions", "clicks", "reach",
    "orders", "grossRevenue", "netRevenue", "totalDiscounts", "totalShipping",
    "newCustomers", "returningCustomers",
    "sent", "delivered", "opens", "emailClicks", "bounces", "unsubscribes", "emailRevenue",
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
  if (totals.orders > 0 && (totals.revenue > 0 || totals.grossRevenue > 0)) {
    totals.avgOrderValue = (totals.revenue || totals.grossRevenue) / totals.orders;
  }
  if ((totals.newCustomers || 0) + (totals.returningCustomers || 0) > 0) {
    totals.repeatPurchaseRate = (totals.returningCustomers / ((totals.newCustomers || 0) + (totals.returningCustomers || 0))) * 100;
  }
  if (totals.sent > 0 && totals.opens > 0) totals.openRate = (totals.opens / totals.sent) * 100;
  if (totals.sent > 0 && totals.emailClicks > 0) totals.clickRate = (totals.emailClicks / totals.sent) * 100;
  return totals;
}

/** Compute cross-channel overview metrics */
function computeOverview(channelData: Record<string, Record<string, number>>) {
  const ads = { spend: 0, conversions: 0, revenue: 0, impressions: 0, clicks: 0 };
  for (const ch of ["META", "GOOGLE"]) {
    const d = channelData[ch];
    if (d) {
      ads.spend += d.spend || 0;
      ads.conversions += d.conversions || 0;
      ads.revenue += d.revenue || 0;
      ads.impressions += d.impressions || 0;
      ads.clicks += d.clicks || 0;
    }
  }

  const ecom = channelData["ECOMMERCE"] || {};
  const email = channelData["EMAIL"] || {};

  const totalRevenue = ecom.revenue || ecom.grossRevenue || 0;
  const totalOrders = ecom.orders || 0;
  const blendedRoas = ads.spend > 0 && totalRevenue > 0 ? totalRevenue / ads.spend : 0;
  const costPerSale = ads.spend > 0 && totalOrders > 0 ? ads.spend / totalOrders : 0;

  return {
    totalRevenue,
    totalSpend: ads.spend,
    totalOrders,
    blendedRoas,
    costPerSale,
    avgOrderValue: ecom.avgOrderValue || 0,
    newCustomers: ecom.newCustomers || 0,
    returningCustomers: ecom.returningCustomers || 0,
    repeatPurchaseRate: ecom.repeatPurchaseRate || 0,
    totalConversions: ads.conversions,
    emailRevenue: email.emailRevenue || 0,
    openRate: email.openRate || 0,
    adsRoas: channelData["META"]?.roas || channelData["GOOGLE"]?.roas || 0,
  };
}

function getReportPeriodLabel(dateRange: UnifiedDateRange): string {
  const start = new Date(dateRange.start + "T12:00:00");
  const end = new Date(dateRange.end + "T12:00:00");
  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${months[start.getMonth()]} ${start.getFullYear()}`;
  }
  return `${start.getDate()} ${months[start.getMonth()].substring(0, 3)} \u2013 ${end.getDate()} ${months[end.getMonth()].substring(0, 3)} ${end.getFullYear()}`;
}

export default function PublicDashboardPage() {
  const params = useParams();
  const token = params.token as string;

  const [state, setState] = useState<PageState>("loading");
  const [error, setError] = useState("");
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [channels, setChannels] = useState<string[]>([]);
  const [activeChannel, setActiveChannel] = useState<string>("OVERVIEW");
  const [dateRange, setDateRange] = useState<UnifiedDateRange>(() => resolvePreset("mtd"));

  // Per-channel data
  const [allSnapshots, setAllSnapshots] = useState<Record<string, ChannelDailySnapshot[]>>({});
  const [allPrevSnapshots, setAllPrevSnapshots] = useState<Record<string, ChannelDailySnapshot[]>>({});
  const [dataLoading, setDataLoading] = useState(false);

  const currency = client?.currency === "ARS" ? "AR$" : "$";

  // 1. Validate token & load client info
  useEffect(() => {
    if (!token) return;

    fetch(`/api/public/${token}`)
      .then(res => {
        if (!res.ok) throw new Error(res.status === 404 ? "Link invalido" : res.status === 403 ? "Link revocado o expirado" : "Error");
        return res.json();
      })
      .then(data => {
        setClient(data.client);
        setChannels(data.channels);
        setState("ready");
      })
      .catch(err => {
        setError(err.message);
        setState("error");
      });
  }, [token]);

  // 2. Fetch ALL channel data when dates change (for overview + individual channels)
  useEffect(() => {
    if (state !== "ready" || channels.length === 0) return;

    setDataLoading(true);
    const compRange = getComparisonRange(dateRange);

    const fetches = channels.flatMap(ch => [
      fetch(`/api/public/${token}/channel-snapshots?channel=${ch}&startDate=${dateRange.start}&endDate=${dateRange.end}`)
        .then(r => r.json())
        .then(data => ({ channel: ch, period: "current" as const, snapshots: data.snapshots || [] })),
      fetch(`/api/public/${token}/channel-snapshots?channel=${ch}&startDate=${compRange.start}&endDate=${compRange.end}`)
        .then(r => r.json())
        .then(data => ({ channel: ch, period: "previous" as const, snapshots: data.snapshots || [] })),
    ]);

    Promise.all(fetches)
      .then(results => {
        const curr: Record<string, ChannelDailySnapshot[]> = {};
        const prev: Record<string, ChannelDailySnapshot[]> = {};
        for (const r of results) {
          if (r.period === "current") curr[r.channel] = r.snapshots;
          else prev[r.channel] = r.snapshots;
        }
        setAllSnapshots(curr);
        setAllPrevSnapshots(prev);
      })
      .catch(err => console.error("Error fetching channel data:", err))
      .finally(() => setDataLoading(false));
  }, [token, state, channels, dateRange.start, dateRange.end]);

  // Compute overview aggregates
  const overviewData = useMemo(() => {
    const currAgg: Record<string, Record<string, number>> = {};
    const prevAgg: Record<string, Record<string, number>> = {};
    for (const ch of channels) {
      if (allSnapshots[ch]) currAgg[ch] = aggregateChannel(allSnapshots[ch]);
      if (allPrevSnapshots[ch]) prevAgg[ch] = aggregateChannel(allPrevSnapshots[ch]);
    }
    return {
      current: computeOverview(currAgg),
      previous: computeOverview(prevAgg),
      channelAgg: currAgg,
      prevChannelAgg: prevAgg,
    };
  }, [allSnapshots, allPrevSnapshots, channels]);

  // Loading state
  if (state === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-stellar">
        <div className="text-center">
          <Image src="/img/logo-v-worker-brain.png" alt="Worker Brain" width={80} height={80} className="mx-auto mb-6 opacity-60" />
          <div className="inline-block w-6 h-6 border-2 border-classic/30 border-t-classic rounded-full animate-spin mb-4" />
          <p className="text-white/40 text-xs">Cargando reporte...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (state === "error") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-stellar">
        <div className="text-center">
          <Image src="/img/logo-v-worker-brain.png" alt="Worker Brain" width={80} height={80} className="mx-auto mb-6 opacity-40" />
          <p className="text-red-400 text-lg font-bold mb-2">{error}</p>
          <p className="text-white/40 text-sm">Contacta a tu equipo de Worker para obtener un nuevo link.</p>
        </div>
      </div>
    );
  }

  const ov = overviewData.current;
  const ovPrev = overviewData.previous;

  return (
    <div className="min-h-screen bg-stellar">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* ─── Branded Header ─── */}
        <header className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Image src="/img/logo-h-worker-brain.png" alt="Worker Brain" width={160} height={40} className="opacity-90" />
            </div>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
          <div className="border-t-2 border-classic/60 pt-4">
            <h1 className="text-2xl font-black text-white">{client?.name}</h1>
            <p className="text-white/40 text-xs mt-1">
              Reporte {getReportPeriodLabel(dateRange)}
              {client?.businessType && ` \u00B7 ${client.businessType}`}
            </p>
          </div>
        </header>

        {/* ─── Channel Tabs ─── */}
        <div className="flex gap-1 mb-8 border-b border-white/10 pb-px overflow-x-auto">
          <button
            onClick={() => setActiveChannel("OVERVIEW")}
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
              activeChannel === "OVERVIEW"
                ? "text-classic border-b-2 border-classic"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            Overview
          </button>
          {channels.map(ch => (
            <button
              key={ch}
              onClick={() => setActiveChannel(ch)}
              className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                activeChannel === ch
                  ? "text-classic border-b-2 border-classic"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              {CHANNEL_LABELS[ch] || ch}
            </button>
          ))}
        </div>

        {/* ─── Content ─── */}
        {dataLoading ? (
          <div className="text-center py-16">
            <div className="inline-block w-6 h-6 border-2 border-classic/30 border-t-classic rounded-full animate-spin" />
          </div>
        ) : activeChannel === "OVERVIEW" ? (
          <div className="space-y-8">
            {/* Hero KPIs */}
            <div>
              <h2 className="text-[10px] text-white/30 font-bold uppercase tracking-widest mb-3">Rendimiento General</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPICard
                  label="Revenue Total"
                  value={fCur(ov.totalRevenue, currency)}
                  delta={calcDelta(ov.totalRevenue, ovPrev.totalRevenue)}
                />
                <KPICard
                  label="Inversion Publicitaria"
                  value={fCur(ov.totalSpend, currency)}
                  delta={calcDelta(ov.totalSpend, ovPrev.totalSpend)}
                />
                <KPICard
                  label="Ordenes"
                  value={fNum(ov.totalOrders, 0)}
                  delta={calcDelta(ov.totalOrders, ovPrev.totalOrders)}
                />
                <KPICard
                  label="ROAS Combinado"
                  value={ov.blendedRoas > 0 ? `${ov.blendedRoas.toFixed(2)}x` : "\u2014"}
                  delta={calcDelta(ov.blendedRoas, ovPrev.blendedRoas)}
                />
              </div>
            </div>

            {/* Efficiency KPIs */}
            <div>
              <h2 className="text-[10px] text-white/30 font-bold uppercase tracking-widest mb-3">Eficiencia</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPICard
                  label="Costo por Venta"
                  value={ov.costPerSale > 0 ? fCur(ov.costPerSale, currency) : "\u2014"}
                  delta={calcDelta(ov.costPerSale, ovPrev.costPerSale)}
                  deltaInverse
                />
                <KPICard
                  label="Ticket Promedio"
                  value={ov.avgOrderValue > 0 ? fCur(ov.avgOrderValue, currency) : "\u2014"}
                  delta={calcDelta(ov.avgOrderValue, ovPrev.avgOrderValue)}
                />
                <KPICard
                  label="Clientes Nuevos"
                  value={fNum(ov.newCustomers, 0)}
                  delta={calcDelta(ov.newCustomers, ovPrev.newCustomers)}
                />
                <KPICard
                  label="Tasa de Recompra"
                  value={ov.repeatPurchaseRate > 0 ? fPct(ov.repeatPurchaseRate) : "\u2014"}
                  delta={calcDelta(ov.repeatPurchaseRate, ovPrev.repeatPurchaseRate)}
                />
              </div>
            </div>

            {/* Insight Banner */}
            <PublicInsightBanner
              current={ov}
              previous={ovPrev}
              rules={OVERVIEW_RULES}
              currency={currency}
            />

            {/* Channel Mini-Cards */}
            <div>
              <h2 className="text-[10px] text-white/30 font-bold uppercase tracking-widest mb-3">Por Canal</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {channels.map(ch => {
                  const d = overviewData.channelAgg[ch] || {};
                  const dp = overviewData.prevChannelAgg[ch] || {};
                  return (
                    <button
                      key={ch}
                      onClick={() => setActiveChannel(ch)}
                      className="card p-4 hover:border-classic/30 transition-all text-left group"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Image
                          src={CHANNEL_ICONS[ch] || "/favicon.png"}
                          alt={ch}
                          width={20}
                          height={20}
                          className="opacity-60 group-hover:opacity-100 transition-opacity"
                        />
                        <span className="text-[10px] text-white/50 font-bold uppercase tracking-widest group-hover:text-classic transition-colors">
                          {CHANNEL_LABELS[ch] || ch}
                        </span>
                      </div>
                      {renderChannelMiniMetrics(ch, d, dp, currency)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <PublicChannelView
            channel={activeChannel}
            snapshots={allSnapshots[activeChannel] || []}
            prevSnapshots={allPrevSnapshots[activeChannel] || []}
            currency={currency}
          />
        )}

        {/* ─── Branded Footer ─── */}
        <footer className="mt-16 pt-6 border-t border-white/5">
          <div className="flex flex-col items-center gap-3">
            <Image src="/img/logo-h-worker-brain.png" alt="Worker Brain" width={120} height={30} className="opacity-30" />
            <p className="text-white/20 text-[10px] uppercase tracking-widest text-center">
              Generado por Worker Brain {"\u2014"} Inteligencia para tu negocio
            </p>
            <p className="text-white/10 text-[9px]">
              {new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

/** Render 2 hero metrics per channel in the mini-card */
function renderChannelMiniMetrics(
  channel: string,
  d: Record<string, number>,
  dp: Record<string, number>,
  currency: string,
) {
  const delta = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : null;
    return ((curr - prev) / Math.abs(prev)) * 100;
  };

  const DeltaBadge = ({ val }: { val: number | null }) => {
    if (val == null || !isFinite(val)) return null;
    const color = val > 0 ? "text-synced" : val < 0 ? "text-red-400" : "text-white/30";
    return <span className={`text-[9px] font-mono ${color}`}>{val > 0 ? "+" : ""}{val.toFixed(1)}%</span>;
  };

  if (channel === "META" || channel === "GOOGLE") {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[9px] text-white/30 uppercase">Inversion</p>
          <p className="text-sm font-black font-mono text-white/80">{fCur(d.spend, currency)}</p>
          <DeltaBadge val={delta(d.spend || 0, dp.spend || 0)} />
        </div>
        <div>
          <p className="text-[9px] text-white/30 uppercase">ROAS</p>
          <p className="text-sm font-black font-mono text-white/80">{d.roas ? `${d.roas.toFixed(2)}x` : "\u2014"}</p>
          <DeltaBadge val={delta(d.roas || 0, dp.roas || 0)} />
        </div>
      </div>
    );
  }

  if (channel === "ECOMMERCE") {
    const rev = d.revenue || d.grossRevenue || 0;
    const prevRev = dp.revenue || dp.grossRevenue || 0;
    return (
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[9px] text-white/30 uppercase">Revenue</p>
          <p className="text-sm font-black font-mono text-white/80">{fCur(rev, currency)}</p>
          <DeltaBadge val={delta(rev, prevRev)} />
        </div>
        <div>
          <p className="text-[9px] text-white/30 uppercase">Ordenes</p>
          <p className="text-sm font-black font-mono text-white/80">{fNum(d.orders, 0)}</p>
          <DeltaBadge val={delta(d.orders || 0, dp.orders || 0)} />
        </div>
      </div>
    );
  }

  if (channel === "EMAIL") {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[9px] text-white/30 uppercase">Open Rate</p>
          <p className="text-sm font-black font-mono text-white/80">{d.openRate ? `${d.openRate.toFixed(1)}%` : "\u2014"}</p>
          <DeltaBadge val={delta(d.openRate || 0, dp.openRate || 0)} />
        </div>
        <div>
          <p className="text-[9px] text-white/30 uppercase">Revenue</p>
          <p className="text-sm font-black font-mono text-white/80">{fCur(d.emailRevenue, currency)}</p>
          <DeltaBadge val={delta(d.emailRevenue || 0, dp.emailRevenue || 0)} />
        </div>
      </div>
    );
  }

  if (channel === "GA4") {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[9px] text-white/30 uppercase">Sesiones</p>
          <p className="text-sm font-black font-mono text-white/80">{fNum(d.sessions, 0)}</p>
          <DeltaBadge val={delta(d.sessions || 0, dp.sessions || 0)} />
        </div>
        <div>
          <p className="text-[9px] text-white/30 uppercase">Revenue</p>
          <p className="text-sm font-black font-mono text-white/80">{fCur(d.purchaseRevenue, currency)}</p>
          <DeltaBadge val={delta(d.purchaseRevenue || 0, dp.purchaseRevenue || 0)} />
        </div>
      </div>
    );
  }

  return null;
}
