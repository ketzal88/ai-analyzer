import { db } from "@/lib/firebase-admin";
import { getAdminStatus } from "@/lib/server-utils";
import { InsightDaily, AdvancedKPISummary, KPIConfig, Currency } from "@/types";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const clientId = searchParams.get("clientId");
        const range = searchParams.get("range") || "last_14d";

        if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 });

        // 1. Get Client Config & Industry Defaults
        const clientDoc = await db.collection("clients").doc(clientId).get();
        if (!clientDoc.exists) return NextResponse.json({ error: "Client not found" }, { status: 404 });
        const clientData = clientDoc.data()!;

        const config: KPIConfig = clientData.kpiConfig || {
            primaryConversionType: clientData.isEcommerce ? "purchase" : "lead",
            valueType: "purchase",
            currencyCode: (clientData.currency || "USD") as Currency,
            timezone: clientData.timezone || "UTC"
        };

        // 2. Resolve Dates
        const getRangeDates = (rangeKey: string) => {
            const today = new Date();
            let days = 14;
            switch (rangeKey) {
                case "last_7d": days = 7; break;
                case "last_30d": days = 30; break;
                case "last_90d": days = 90; break;
                case "this_month":
                    // Special logic for month
                    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                    return {
                        start: startOfMonth,
                        end: today,
                        days: Math.floor((today.getTime() - startOfMonth.getTime()) / (1000 * 60 * 60 * 24)) + 1
                    };
                case "last_month":
                    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
                    return {
                        start: startOfLastMonth,
                        end: endOfLastMonth,
                        days: Math.floor((endOfLastMonth.getTime() - startOfLastMonth.getTime()) / (1000 * 60 * 60 * 24)) + 1
                    };
                default: days = 14; // last_14d
            }

            const end = new Date();
            const start = new Date();
            start.setDate(end.getDate() - days + 1); // inclusive
            return { start, end, days };
        };

        const { start: currentStart, end: currentEnd, days: durationDays } = getRangeDates(range);

        // Comparison (Previous Period)
        const prevEnd = new Date(currentStart);
        prevEnd.setDate(prevEnd.getDate() - 1);
        const prevStart = new Date(prevEnd);
        prevStart.setDate(prevStart.getDate() - durationDays + 1);

        const formatDateStr = (d: Date) => d.toISOString().split("T")[0];

        const qStart = formatDateStr(prevStart);
        const qEnd = formatDateStr(currentEnd);

        // 3. Fetch Insights with Date Filter
        const insightsSnapshot = await db.collection("insights_daily")
            .where("clientId", "==", clientId)
            .where("date", ">=", qStart)
            .where("date", "<=", qEnd) // Requires formatting match YYYY-MM-DD
            .orderBy("date", "asc") // Ensure sorted
            .limit(5000) // Increase limit for longer ranges/more campaigns
            .get();

        const allInsights = insightsSnapshot.docs.map(doc => doc.data() as InsightDaily);

        // Filter into buckets by string comparison
        const curRangeStr = { start: formatDateStr(currentStart), end: formatDateStr(currentEnd) };
        const prevRangeStr = { start: formatDateStr(prevStart), end: formatDateStr(prevEnd) };

        const curInsights = allInsights.filter(i => i.date >= curRangeStr.start && i.date <= curRangeStr.end);
        const prevInsights = allInsights.filter(i => i.date >= prevRangeStr.start && i.date <= prevRangeStr.end);

        // Helper Aggregator
        const aggregate = (data: InsightDaily[]) => {
            return data.reduce((acc, curr: any) => {
                const getVal = (arr: any[], type: string) => Number(arr?.find((a: any) => a.action_type === type)?.value || 0);

                acc.spend += curr.spend || 0;
                acc.impressions += curr.impressions || 0;
                acc.clicks += curr.clicks || 0;
                acc.reach += curr.reach || 0;
                acc.purchases += getVal(curr.rawActions, config.primaryConversionType);
                acc.purchaseValue += getVal(curr.rawActionValues, config.valueType);
                acc.whatsapp += config.whatsappClickType ? getVal(curr.rawActions, config.whatsappClickType) : 0;
                return acc;
            }, { spend: 0, impressions: 0, clicks: 0, reach: 0, purchases: 0, purchaseValue: 0, whatsapp: 0 });
        };

        const cur = aggregate(curInsights);
        const prev = aggregate(prevInsights);

        // Used for display dates
        const currentDates = [curRangeStr.start, curRangeStr.end].sort(); // simplistic
        const previousDates = [prevRangeStr.start, prevRangeStr.end].sort();

        const formatDate = (dateStr: string) => {
            if (!dateStr) return "";
            const [y, m, d] = dateStr.split("-");
            return `${d}/${m}/${y}`;
        };

        const calcDelta = (c: number, p: number) => p > 0 ? ((c / p) - 1) * 100 : 0;

        // Calculate metrics
        const roasCur = cur.spend > 0 ? cur.purchaseValue / cur.spend : 0;
        const roasPrev = prev.spend > 0 ? prev.purchaseValue / prev.spend : 0;

        const cpaCur = cur.purchases > 0 ? cur.spend / cur.purchases : 0;
        const cpaPrev = prev.purchases > 0 ? prev.spend / prev.purchases : 0;

        const ctrCur = cur.impressions > 0 ? (cur.clicks / cur.impressions) * 100 : 0;
        const ctrPrev = prev.impressions > 0 ? (prev.clicks / prev.impressions) * 100 : 0;

        const kpis: AdvancedKPISummary[] = [
            {
                id: "spend",
                label: "Gasto Total",
                current: cur.spend.toFixed(2),
                previous: prev.spend.toFixed(2),
                delta: calcDelta(cur.spend, prev.spend),
                trend: cur.spend >= prev.spend ? "neutral" : "neutral",
                prefix: "$",
                definition: { label: "Gasto Total", source: "Meta field: spend" }
            },
            {
                id: "roas",
                label: "ROAS",
                current: roasCur.toFixed(2),
                previous: roasPrev.toFixed(2),
                delta: calcDelta(roasCur, roasPrev),
                trend: roasCur >= roasPrev ? "up" : "down",
                definition: { label: "ROAS", source: `Value source: ${config.valueType}` }
            },
            {
                id: "conversions",
                label: config.primaryConversionType === "purchase" ? "Ventas" : "Leads",
                current: cur.purchases,
                previous: prev.purchases,
                delta: calcDelta(cur.purchases, prev.purchases),
                trend: cur.purchases >= prev.purchases ? "up" : "down",
                definition: { label: "Conversión Primaria", source: `Action: ${config.primaryConversionType}` }
            },
            {
                id: "cpa",
                label: "CPA",
                current: cpaCur.toFixed(2),
                previous: cpaPrev.toFixed(2),
                delta: calcDelta(cpaCur, cpaPrev),
                trend: cpaCur <= cpaPrev ? "up" : "down", // Lower is better (Green/Up), Higher is worse (Red/Down)
                prefix: "$",
                definition: { label: "Costo por Adquisición", source: "Formula: Spend / Primary Actions" }
            },
            {
                id: "ctr",
                label: "CTR (Link)",
                current: ctrCur.toFixed(2),
                previous: ctrPrev.toFixed(2),
                delta: calcDelta(ctrCur, ctrPrev),
                trend: ctrCur >= ctrPrev ? "up" : "down",
                suffix: "%",
                definition: { label: "Click-Through Rate", source: "Meta field: clicks (inline) / impressions" }
            }
        ];

        // Add optional KPIs
        if (config.whatsappClickType) {
            kpis.push({
                id: "whatsapp",
                label: "Clicks a WhatsApp",
                current: cur.whatsapp,
                previous: prev.whatsapp,
                delta: calcDelta(cur.whatsapp, prev.whatsapp),
                trend: cur.whatsapp >= prev.whatsapp ? "up" : "down",
                definition: { label: "WhatsApp", source: `Action: ${config.whatsappClickType}` }
            });
        }

        return NextResponse.json({
            clientId,
            generatedAt: new Date().toISOString(),
            dateRange: { start: formatDate(currentDates[0]), end: formatDate(currentDates[currentDates.length - 1]) },
            comparisonRange: { start: formatDate(previousDates[0]), end: formatDate(previousDates[previousDates.length - 1]) },
            config,
            kpis
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
