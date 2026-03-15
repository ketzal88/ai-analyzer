"use client";

import React from "react";

interface Insight {
  text: string;
  sentiment: "positive" | "negative" | "neutral";
}

interface InsightRule {
  key: string;
  label: string;
  format: "currency" | "number" | "percent" | "multiplier";
  /** When true, a decrease is good (e.g., CPA, abandonment rate) */
  inverse?: boolean;
}

interface PublicInsightBannerProps {
  current: Record<string, number>;
  previous: Record<string, number>;
  rules: InsightRule[];
  currency?: string;
  maxInsights?: number;
}

function formatValue(val: number, format: InsightRule["format"], currency: string): string {
  switch (format) {
    case "currency":
      if (val >= 1_000_000) return `${currency}${(val / 1_000_000).toFixed(1)}M`;
      if (val >= 1_000) return `${currency}${(val / 1_000).toFixed(1)}K`;
      return `${currency}${val.toFixed(0)}`;
    case "percent":
      return `${val.toFixed(1)}%`;
    case "multiplier":
      return `${val.toFixed(2)}x`;
    case "number":
    default:
      if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
      if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
      return val.toFixed(0);
  }
}

function generateInsights(
  current: Record<string, number>,
  previous: Record<string, number>,
  rules: InsightRule[],
  currency: string,
): Insight[] {
  const insights: Insight[] = [];

  for (const rule of rules) {
    const curr = current[rule.key];
    const prev = previous[rule.key];
    if (curr == null || !isFinite(curr)) continue;

    // No previous data — just show current value
    if (prev == null || prev === 0) {
      if (curr > 0) {
        insights.push({
          text: `${rule.label}: ${formatValue(curr, rule.format, currency)}`,
          sentiment: "neutral",
        });
      }
      continue;
    }

    const deltaPct = ((curr - prev) / Math.abs(prev)) * 100;
    if (Math.abs(deltaPct) < 2) {
      // Stable
      insights.push({
        text: `${rule.label} se mantuvo estable en ${formatValue(curr, rule.format, currency)}`,
        sentiment: "neutral",
      });
      continue;
    }

    const isUp = deltaPct > 0;
    const isGood = rule.inverse ? !isUp : isUp;
    const direction = isUp ? "subió" : "bajó";
    const absDelta = Math.abs(deltaPct).toFixed(1);

    insights.push({
      text: `${rule.label} ${direction} a ${formatValue(curr, rule.format, currency)} (${isUp ? "+" : "-"}${absDelta}% vs periodo anterior)`,
      sentiment: isGood ? "positive" : "negative",
    });
  }

  return insights;
}

const SENTIMENT_STYLES = {
  positive: "border-synced/20 bg-synced/5 text-synced",
  negative: "border-red-400/20 bg-red-400/5 text-red-400",
  neutral: "border-white/10 bg-white/5 text-white/60",
};

const SENTIMENT_ICONS = {
  positive: "▲",
  negative: "▼",
  neutral: "●",
};

export default function PublicInsightBanner({
  current,
  previous,
  rules,
  currency = "$",
  maxInsights = 5,
}: PublicInsightBannerProps) {
  const insights = generateInsights(current, previous, rules, currency).slice(0, maxInsights);

  if (insights.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-3">
        Resumen del periodo
      </h3>
      <div className="grid gap-2">
        {insights.map((insight, i) => (
          <div
            key={i}
            className={`border px-4 py-2.5 text-xs font-medium flex items-center gap-2 ${SENTIMENT_STYLES[insight.sentiment]}`}
          >
            <span className="text-[10px] opacity-60">{SENTIMENT_ICONS[insight.sentiment]}</span>
            {insight.text}
          </div>
        ))}
      </div>
    </div>
  );
}

// Pre-built rule sets for each channel
export const OVERVIEW_RULES: InsightRule[] = [
  { key: "totalRevenue", label: "Revenue total", format: "currency" },
  { key: "totalSpend", label: "Inversion publicitaria", format: "currency" },
  { key: "totalOrders", label: "Ordenes", format: "number" },
  { key: "blendedRoas", label: "ROAS combinado", format: "multiplier" },
  { key: "costPerSale", label: "Costo por venta", format: "currency", inverse: true },
];

export const ECOMMERCE_RULES: InsightRule[] = [
  { key: "revenue", label: "Revenue", format: "currency" },
  { key: "orders", label: "Ordenes", format: "number" },
  { key: "avgOrderValue", label: "Ticket promedio", format: "currency" },
  { key: "newCustomers", label: "Clientes nuevos", format: "number" },
  { key: "repeatPurchaseRate", label: "Tasa de recompra", format: "percent" },
];

export const ADS_RULES: InsightRule[] = [
  { key: "spend", label: "Inversion", format: "currency" },
  { key: "conversions", label: "Conversiones", format: "number" },
  { key: "cpa", label: "Costo por conversion", format: "currency", inverse: true },
  { key: "roas", label: "ROAS", format: "multiplier" },
  { key: "ctr", label: "CTR", format: "percent" },
];

export const EMAIL_RULES: InsightRule[] = [
  { key: "sent", label: "Enviados", format: "number" },
  { key: "openRate", label: "Tasa de apertura", format: "percent" },
  { key: "clickRate", label: "Tasa de clicks", format: "percent" },
  { key: "emailRevenue", label: "Revenue email", format: "currency" },
];
