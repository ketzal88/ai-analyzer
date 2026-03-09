"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { ChannelDailySnapshot, UnifiedChannelMetrics } from "@/types/channel-snapshots";

// ── Column definitions ──────────────────────────────

interface ColumnDef {
    key: string;
    label: string;
    channel: "ECOMMERCE" | "META" | "GOOGLE" | "EMAIL";
    format: "currency" | "number" | "percent" | "ratio";
    isInverse?: boolean;
    compute: (snaps: ChannelDailySnapshot[]) => number;
}

const ALL_COLUMNS: ColumnDef[] = [
    // Ecommerce
    { key: "ecom_revenue", label: "Revenue", channel: "ECOMMERCE", format: "currency", compute: (s) => sum(s, "revenue") },
    { key: "ecom_orders", label: "Ordenes", channel: "ECOMMERCE", format: "number", compute: (s) => sum(s, "orders") },
    { key: "ecom_aov", label: "AOV", channel: "ECOMMERCE", format: "currency", compute: (s) => { const r = sum(s, "revenue"); const o = sum(s, "orders"); return o > 0 ? r / o : 0; } },
    { key: "ecom_new_customers", label: "Nuevos", channel: "ECOMMERCE", format: "number", compute: (s) => sum(s, "newCustomers") },
    { key: "ecom_returning", label: "Recurrentes", channel: "ECOMMERCE", format: "number", compute: (s) => sum(s, "returningCustomers") },
    // Meta Ads
    { key: "meta_spend", label: "Spend", channel: "META", format: "currency", compute: (s) => sum(s, "spend") },
    { key: "meta_revenue", label: "Revenue", channel: "META", format: "currency", compute: (s) => sum(s, "revenue") },
    { key: "meta_conversions", label: "Conversiones", channel: "META", format: "number", compute: (s) => sum(s, "conversions") },
    { key: "meta_cpa", label: "CPA", channel: "META", format: "currency", isInverse: true, compute: (s) => { const sp = sum(s, "spend"); const c = sum(s, "conversions"); return c > 0 ? sp / c : 0; } },
    { key: "meta_roas", label: "ROAS", channel: "META", format: "ratio", compute: (s) => { const sp = sum(s, "spend"); const r = sum(s, "revenue"); return sp > 0 ? r / sp : 0; } },
    { key: "meta_impressions", label: "Impresiones", channel: "META", format: "number", compute: (s) => sum(s, "impressions") },
    { key: "meta_clicks", label: "Clicks", channel: "META", format: "number", compute: (s) => sum(s, "clicks") },
    { key: "meta_ctr", label: "CTR", channel: "META", format: "percent", compute: (s) => { const imp = sum(s, "impressions"); const cl = sum(s, "clicks"); return imp > 0 ? (cl / imp) * 100 : 0; } },
    // Google Ads
    { key: "google_spend", label: "Spend", channel: "GOOGLE", format: "currency", compute: (s) => sum(s, "spend") },
    { key: "google_revenue", label: "Revenue", channel: "GOOGLE", format: "currency", compute: (s) => sum(s, "revenue") },
    { key: "google_conversions", label: "Conversiones", channel: "GOOGLE", format: "number", compute: (s) => sum(s, "conversions") },
    { key: "google_cpa", label: "CPA", channel: "GOOGLE", format: "currency", isInverse: true, compute: (s) => { const sp = sum(s, "spend"); const c = sum(s, "conversions"); return c > 0 ? sp / c : 0; } },
    { key: "google_roas", label: "ROAS", channel: "GOOGLE", format: "ratio", compute: (s) => { const sp = sum(s, "spend"); const r = sum(s, "revenue"); return sp > 0 ? r / sp : 0; } },
    // Email
    { key: "email_sent", label: "Enviados", channel: "EMAIL", format: "number", compute: (s) => sum(s, "sent") },
    { key: "email_open_rate", label: "Open Rate", channel: "EMAIL", format: "percent", compute: (s) => { const d = sum(s, "delivered"); const o = sum(s, "opens"); return d > 0 ? (o / d) * 100 : 0; } },
    { key: "email_click_rate", label: "Click Rate", channel: "EMAIL", format: "percent", compute: (s) => { const d = sum(s, "delivered"); const c = sum(s, "emailClicks"); return d > 0 ? (c / d) * 100 : 0; } },
    { key: "email_revenue", label: "Revenue", channel: "EMAIL", format: "currency", compute: (s) => sum(s, "emailRevenue") },
];

function sum(snaps: ChannelDailySnapshot[], field: string): number {
    return snaps.reduce((s, x) => s + ((x.metrics as Record<string, number>)[field] || 0), 0);
}

// ── Defaults ────────────────────────────────────────

const DEFAULT_CHANNELS = new Set(["ECOMMERCE", "META", "EMAIL", "GOOGLE"]);
const DEFAULT_COLUMNS = new Set([
    "ecom_revenue", "ecom_orders", "ecom_aov",
    "meta_spend", "meta_cpa", "meta_roas",
    "email_sent", "email_open_rate", "email_click_rate",
    "google_spend", "google_cpa", "google_roas",
]);

const STORAGE_KEY_CHANNELS = "panorama_monthly_channels";
const STORAGE_KEY_COLUMNS = "panorama_monthly_columns";

const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const CHANNEL_LABELS: Record<string, string> = {
    ECOMMERCE: "Ecommerce",
    META: "Meta Ads",
    GOOGLE: "Google Ads",
    EMAIL: "Email",
};

// ── Formatters ──────────────────────────────────────

function fmt(value: number, format: "currency" | "number" | "percent" | "ratio"): string {
    if (format === "currency") {
        if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
        if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
        return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    }
    if (format === "number") {
        if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
        if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
        return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
    }
    if (format === "percent") return `${value.toFixed(1)}%`;
    return `${value.toFixed(2)}x`; // ratio
}

// ── Component ───────────────────────────────────────

interface Props {
    clientId: string;
}

interface MonthBucket {
    label: string;       // "Enero 2026"
    yearMonth: string;   // "2026-01"
    snapshots: ChannelDailySnapshot[];
}

export default function MonthlyHistoryTable({ clientId }: Props) {
    const [allSnapshots, setAllSnapshots] = useState<ChannelDailySnapshot[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showColumnPicker, setShowColumnPicker] = useState(false);

    // Persisted state
    const [enabledChannels, setEnabledChannels] = useState<Set<string>>(() => {
        if (typeof window === "undefined") return DEFAULT_CHANNELS;
        try {
            const stored = localStorage.getItem(STORAGE_KEY_CHANNELS);
            return stored ? new Set(JSON.parse(stored)) : DEFAULT_CHANNELS;
        } catch { return DEFAULT_CHANNELS; }
    });

    const [enabledColumns, setEnabledColumns] = useState<Set<string>>(() => {
        if (typeof window === "undefined") return DEFAULT_COLUMNS;
        try {
            const stored = localStorage.getItem(STORAGE_KEY_COLUMNS);
            return stored ? new Set(JSON.parse(stored)) : DEFAULT_COLUMNS;
        } catch { return DEFAULT_COLUMNS; }
    });

    // Persist to localStorage
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_CHANNELS, JSON.stringify([...enabledChannels]));
    }, [enabledChannels]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_COLUMNS, JSON.stringify([...enabledColumns]));
    }, [enabledColumns]);

    // Fetch 12 months of data
    useEffect(() => {
        if (!clientId) return;
        setIsLoading(true);

        const now = new Date();
        const startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-01`;
        const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

        fetch(`/api/channel-snapshots?clientId=${clientId}&startDate=${startStr}&endDate=${endStr}`)
            .then(res => res.json())
            .then(data => setAllSnapshots(data.snapshots || []))
            .catch(() => setAllSnapshots([]))
            .finally(() => setIsLoading(false));
    }, [clientId]);

    // Group snapshots by month
    const monthBuckets: MonthBucket[] = useMemo(() => {
        const buckets = new Map<string, ChannelDailySnapshot[]>();
        for (const snap of allSnapshots) {
            const ym = snap.date.substring(0, 7); // "2026-01"
            const arr = buckets.get(ym) || [];
            arr.push(snap);
            buckets.set(ym, arr);
        }

        return [...buckets.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([ym, snaps]) => {
                const [year, month] = ym.split("-");
                return {
                    label: `${MONTH_NAMES[parseInt(month) - 1]} ${year}`,
                    yearMonth: ym,
                    snapshots: snaps,
                };
            });
    }, [allSnapshots]);

    // Visible columns (filtered by enabled channels + enabled columns)
    const visibleColumns = useMemo(
        () => ALL_COLUMNS.filter(c => enabledChannels.has(c.channel) && enabledColumns.has(c.key)),
        [enabledChannels, enabledColumns]
    );

    // Toggle handlers
    const toggleChannel = useCallback((ch: string) => {
        setEnabledChannels(prev => {
            const next = new Set(prev);
            if (next.has(ch)) next.delete(ch); else next.add(ch);
            return next;
        });
    }, []);

    const toggleColumn = useCallback((key: string) => {
        setEnabledColumns(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    }, []);

    if (isLoading) {
        return (
            <div className="card p-8 flex items-center justify-center">
                <div className="animate-spin w-5 h-5 border-2 border-classic border-t-transparent rounded-full" />
                <span className="ml-3 text-text-muted text-small">Cargando historial mensual...</span>
            </div>
        );
    }

    if (monthBuckets.length === 0) return null;

    return (
        <div className="card p-0 overflow-hidden">
            {/* Header with controls */}
            <div className="px-4 py-3 border-b border-argent flex items-center justify-between flex-wrap gap-3">
                <h3 className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                    Historial Mensual
                </h3>
                <div className="flex items-center gap-4">
                    {/* Channel toggles */}
                    {(["ECOMMERCE", "META", "EMAIL", "GOOGLE"] as const).map(ch => (
                        <label key={ch} className="flex items-center gap-1.5 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={enabledChannels.has(ch)}
                                onChange={() => toggleChannel(ch)}
                                className="w-3 h-3 accent-classic"
                            />
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${enabledChannels.has(ch) ? "text-text-primary" : "text-text-muted"}`}>
                                {CHANNEL_LABELS[ch]}
                            </span>
                        </label>
                    ))}

                    {/* Column picker toggle */}
                    <button
                        onClick={() => setShowColumnPicker(!showColumnPicker)}
                        className="text-[10px] font-bold text-classic uppercase tracking-wider hover:text-classic/80 transition-colors"
                    >
                        {showColumnPicker ? "Cerrar" : "Columnas"}
                    </button>
                </div>
            </div>

            {/* Column picker dropdown */}
            {showColumnPicker && (
                <div className="px-4 py-3 border-b border-argent bg-special/50">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1.5">
                        {(["ECOMMERCE", "META", "EMAIL", "GOOGLE"] as const).map(ch => {
                            if (!enabledChannels.has(ch)) return null;
                            const cols = ALL_COLUMNS.filter(c => c.channel === ch);
                            return (
                                <div key={ch}>
                                    <p className="text-[9px] font-black text-classic uppercase tracking-widest mb-1">
                                        {CHANNEL_LABELS[ch]}
                                    </p>
                                    {cols.map(col => (
                                        <label key={col.key} className="flex items-center gap-1.5 cursor-pointer select-none py-0.5">
                                            <input
                                                type="checkbox"
                                                checked={enabledColumns.has(col.key)}
                                                onChange={() => toggleColumn(col.key)}
                                                className="w-3 h-3 accent-classic"
                                            />
                                            <span className={`text-[10px] ${enabledColumns.has(col.key) ? "text-text-primary" : "text-text-muted"}`}>
                                                {col.label}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        {/* Channel group headers */}
                        <tr className="border-b border-argent">
                            <th className="px-3 py-2 sticky left-0 z-10 bg-stellar" />
                            {(() => {
                                const groups: { channel: string; count: number }[] = [];
                                for (const col of visibleColumns) {
                                    const last = groups[groups.length - 1];
                                    if (last && last.channel === col.channel) { last.count++; }
                                    else { groups.push({ channel: col.channel, count: 1 }); }
                                }
                                return groups.map(g => (
                                    <th
                                        key={g.channel}
                                        colSpan={g.count}
                                        className="px-2 py-2 text-center text-[10px] font-bold text-classic uppercase tracking-widest border-l-2 border-argent"
                                    >
                                        {CHANNEL_LABELS[g.channel]}
                                    </th>
                                ));
                            })()}
                        </tr>
                        {/* Sub-column headers */}
                        <tr className="border-b border-argent">
                            <th className="px-3 py-2 text-left text-[10px] font-bold text-text-muted uppercase tracking-wider sticky left-0 z-10 bg-stellar">
                                Mes
                            </th>
                            {visibleColumns.map((col, i) => {
                                const isGroupStart = i === 0 || visibleColumns[i - 1].channel !== col.channel;
                                return (
                                    <th
                                        key={col.key}
                                        className={`px-2 py-2 text-right text-[10px] font-bold text-text-muted uppercase tracking-wider ${
                                            isGroupStart ? "border-l-2 border-argent" : ""
                                        }`}
                                    >
                                        {col.label}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {monthBuckets.map((bucket, rowIdx) => {
                            // Check if this is current month (partial)
                            const now = new Date();
                            const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
                            const isCurrent = bucket.yearMonth === currentYM;

                            return (
                                <tr
                                    key={bucket.yearMonth}
                                    className={`border-b border-argent/30 hover:bg-special transition-colors ${isCurrent ? "bg-special/30" : ""}`}
                                >
                                    <td className="px-3 py-2 sticky left-0 z-10 bg-stellar whitespace-nowrap">
                                        <span className={`text-small font-bold ${isCurrent ? "text-classic" : "text-text-primary"}`}>
                                            {bucket.label}
                                        </span>
                                        {isCurrent && <span className="text-[8px] text-classic ml-1">(parcial)</span>}
                                    </td>
                                    {visibleColumns.map((col, i) => {
                                        const channelSnaps = bucket.snapshots.filter(s => s.channel === col.channel);
                                        const value = channelSnaps.length > 0 ? col.compute(channelSnaps) : 0;
                                        const isGroupStart = i === 0 || visibleColumns[i - 1].channel !== col.channel;

                                        // MoM delta
                                        const prevBucket = rowIdx > 0 ? monthBuckets[rowIdx - 1] : null;
                                        let momPct: number | null = null;
                                        if (prevBucket) {
                                            const prevSnaps = prevBucket.snapshots.filter(s => s.channel === col.channel);
                                            const prevValue = prevSnaps.length > 0 ? col.compute(prevSnaps) : 0;
                                            if (prevValue > 0) momPct = ((value - prevValue) / prevValue) * 100;
                                        }

                                        const hasData = channelSnaps.length > 0 && value !== 0;

                                        return (
                                            <td
                                                key={col.key}
                                                className={`px-2 py-2 text-right whitespace-nowrap ${isGroupStart ? "border-l-2 border-argent" : ""}`}
                                            >
                                                {hasData ? (
                                                    <div className="flex items-center justify-end gap-1">
                                                        <span className="font-mono text-[11px] text-text-primary">
                                                            {fmt(value, col.format)}
                                                        </span>
                                                        {momPct !== null && (
                                                            <span className={`text-[8px] font-black ${
                                                                (col.isInverse ? momPct <= 0 : momPct >= 0) ? "text-synced" : "text-red-500"
                                                            }`}>
                                                                {momPct >= 0 ? "+" : ""}{momPct.toFixed(0)}%
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-text-muted text-[11px]">—</span>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
