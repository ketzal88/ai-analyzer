import { auth, db } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import {
    DashboardSnapshot,
    FindingsRun,
    InsightDaily,
    KPIConfig,
    AdvancedKPISummary,
    DiagnosticFinding // Added
} from "@/types";
import { syncClientInsights } from "@/lib/meta-service";
import { generateGeminiReport } from "@/lib/gemini-service";
import { runDiagnosticRules } from "@/lib/findings-engine";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { clientId, currentRangePreset, currentRangeCustom, compareMode = "previous_period", flags = {} } = body;
        const { syncIfMissing = false, forceRefresh = false, runLLM = false } = flags;

        if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 });

        const sessionCookie = request.cookies.get("session")?.value;
        if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        await auth.verifySessionCookie(sessionCookie);

        const clientDoc = await db.collection("clients").doc(clientId).get();
        if (!clientDoc.exists) return NextResponse.json({ error: "Client not found" }, { status: 404 });
        const clientData = clientDoc.data()!;
        if (!clientData.active) return NextResponse.json({ error: "Client is inactive" }, { status: 403 });

        const getDates = () => {
            const today = new Date();
            let days = 14;
            let start, end;

            if (currentRangePreset) {
                switch (currentRangePreset) {
                    case "last_7d": days = 7; break;
                    case "last_30d": days = 30; break;
                    case "last_90d": days = 90; break;
                    case "this_month": {
                        const s = new Date(today.getFullYear(), today.getMonth(), 1);
                        return { start: s, end: today, days: Math.floor((today.getTime() - s.getTime()) / 86400000) + 1 };
                    }
                    case "last_month": {
                        const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                        const e = new Date(today.getFullYear(), today.getMonth(), 0);
                        return { start: s, end: e, days: Math.floor((e.getTime() - s.getTime()) / 86400000) + 1 };
                    }
                    default: days = 14;
                }
                end = new Date();
                start = new Date();
                start.setDate(end.getDate() - days + 1);
                return { start, end, days };
            } else if (currentRangeCustom) {
                return {
                    start: new Date(currentRangeCustom.start),
                    end: new Date(currentRangeCustom.end),
                    days: Math.floor((new Date(currentRangeCustom.end).getTime() - new Date(currentRangeCustom.start).getTime()) / 86400000) + 1
                };
            }
            end = new Date();
            start = new Date();
            start.setDate(end.getDate() - 13);
            return { start, end, days: 14 };
        };

        const { start: curStart, end: curEnd, days: duration } = getDates();

        let prevStart = new Date(curStart);
        prevStart.setDate(prevStart.getDate() - duration);
        let prevEnd = new Date(curStart);
        prevEnd.setDate(prevEnd.getDate() - 1);

        const dateToString = (d: Date) => d.toISOString().split("T")[0];
        const ranges = {
            current: { start: dateToString(curStart), end: dateToString(curEnd) },
            compare: { start: dateToString(prevStart), end: dateToString(prevEnd) }
        };

        const configHashBasis = JSON.stringify({
            curr: clientData.currency,
            tz: clientData.timezone,
            kpi: clientData.kpiConfig || {},
            goals: clientData.primaryGoal
        });
        const snapshotHash = createHash("sha256")
            .update(`${clientId}|${ranges.current.start}:${ranges.current.end}|${ranges.compare.start}:${ranges.compare.end}|${configHashBasis}`)
            .digest("hex");

        let snapshot: DashboardSnapshot | null = null;
        let findingsRun: FindingsRun | null = null;
        let report: any = null;

        if (!forceRefresh) {
            const snapDoc = await db.collection("dash_snapshots").doc(snapshotHash).get();
            if (snapDoc.exists) {
                snapshot = snapDoc.data() as DashboardSnapshot;
                const findingsDoc = await db.collection("findings_runs").doc(snapshotHash).get();
                if (findingsDoc.exists) {
                    findingsRun = findingsDoc.data() as FindingsRun;
                }
            }
        }

        if (!snapshot || forceRefresh) {
            if (forceRefresh || syncIfMissing) {
                const syncRange = currentRangePreset || "maximum";
                try {
                    console.log(`Triggering Sync for ${clientId} range: ${syncRange}`);
                    if (clientData.metaAdAccountId) {
                        await syncClientInsights(clientId, clientData.metaAdAccountId, syncRange);
                    }
                } catch (e) {
                    console.error("Auto-sync failed:", e);
                }
            }

            const qStart = ranges.compare.start;
            const qEnd = ranges.current.end;

            const insightsSnapshot = await db.collection("insights_daily")
                .where("clientId", "==", clientId)
                .where("date", ">=", qStart)
                .where("date", "<=", qEnd)
                .orderBy("date", "asc")
                .limit(5000)
                .get();

            const allInsights = insightsSnapshot.docs.map(doc => doc.data() as InsightDaily);

            const curInsights = allInsights.filter(i => i.date >= ranges.current.start && i.date <= ranges.current.end);
            const prevInsights = allInsights.filter(i => i.date >= ranges.compare.start && i.date <= ranges.compare.end);

            const config: KPIConfig = clientData.kpiConfig || {
                primaryConversionType: clientData.isEcommerce ? "purchase" : "lead",
                valueType: "purchase",
                currencyCode: clientData.currency || "USD",
                timezone: clientData.timezone || "UTC"
            };

            const aggregate = (data: InsightDaily[]) => {
                return data.reduce((acc, curr: any) => {
                    const getVal = (arr: any[], type: string) => Number(arr?.find((a: any) => a.action_type === type)?.value || 0);
                    acc.spend += curr.spend || 0;
                    acc.impressions += curr.impressions || 0;
                    acc.clicks += curr.clicks || 0;
                    acc.purchases += getVal(curr.rawActions, config.primaryConversionType);
                    acc.purchaseValue += getVal(curr.rawActionValues, config.valueType);
                    return acc;
                }, { spend: 0, impressions: 0, clicks: 0, purchases: 0, purchaseValue: 0, whatsapp: 0 });
            };

            const cur = aggregate(curInsights);
            const prev = aggregate(prevInsights);
            const calcDelta = (c: number, p: number) => p > 0 ? ((c / p) - 1) * 100 : 0;

            const roasCur = cur.spend > 0 ? cur.purchaseValue / cur.spend : 0;
            const roasPrev = prev.spend > 0 ? prev.purchaseValue / prev.spend : 0;
            const cpaCur = cur.purchases > 0 ? cur.spend / cur.purchases : 0;
            const cpaPrev = prev.purchases > 0 ? prev.spend / prev.purchases : 0;
            const ctrCur = cur.impressions > 0 ? (cur.clicks / cur.impressions) * 100 : 0;
            const ctrPrev = prev.impressions > 0 ? (prev.clicks / prev.impressions) * 100 : 0;

            const kpis: AdvancedKPISummary[] = [
                {
                    id: "spend", label: "Gasto Total",
                    current: cur.spend.toFixed(2), previous: prev.spend.toFixed(2),
                    delta: calcDelta(cur.spend, prev.spend), trend: "neutral", prefix: "$"
                },
                {
                    id: "roas", label: "ROAS",
                    current: roasCur.toFixed(2), previous: roasPrev.toFixed(2),
                    delta: calcDelta(roasCur, roasPrev), trend: roasCur >= roasPrev ? "up" : "down"
                },
                {
                    id: "conversions", label: config.primaryConversionType === "purchase" ? "Ventas" : "Leads",
                    current: cur.purchases, previous: prev.purchases,
                    delta: calcDelta(cur.purchases, prev.purchases), trend: cur.purchases >= prev.purchases ? "up" : "down"
                },
                {
                    id: "cpa", label: "CPA",
                    current: cpaCur.toFixed(2), previous: cpaPrev.toFixed(2),
                    delta: calcDelta(cpaCur, cpaPrev), trend: cpaCur <= cpaPrev ? "up" : "down", prefix: "$"
                },
                {
                    id: "ctr", label: "CTR",
                    current: ctrCur.toFixed(2), previous: ctrPrev.toFixed(2),
                    delta: calcDelta(ctrCur, ctrPrev), trend: ctrCur >= ctrPrev ? "up" : "down", suffix: "%"
                }
            ];

            snapshot = {
                id: snapshotHash,
                clientId,
                currentRange: ranges.current,
                compareRange: ranges.compare,
                timezone: config.timezone,
                currency: config.currencyCode,
                kpis,
                config,
                createdAt: new Date().toISOString(),
                dataCoverage: {
                    daysAvailable: curInsights.length + prevInsights.length,
                    daysRequested: duration * 2
                }
            };

            await db.collection("dash_snapshots").doc(snapshotHash).set(snapshot);

            // Findings Logic (Full Engine)
            const campaignStats = curInsights.reduce((acc: any[], curr: any) => {
                let camp = acc.find((c: any) => c.id === curr.campaignId);
                if (!camp) {
                    camp = {
                        id: curr.campaignId,
                        name: curr.campaignName,
                        spend: 0,
                        purchases: 0,
                        purchaseValue: 0,
                        clicks: 0,
                        impressions: 0
                    };
                    acc.push(camp);
                }
                const getVal = (arr: any[], type: string) => Number(arr?.find((a: any) => a.action_type === type)?.value || 0);

                camp.spend += curr.spend;
                camp.clicks += curr.clicks;
                camp.impressions += curr.impressions;
                camp.purchases += getVal(curr.rawActions, config.primaryConversionType);
                camp.purchaseValue += getVal(curr.rawActionValues, config.valueType);

                return acc;
            }, []);

            const currentDatesList = curInsights.map(i => i.date);

            const findings = runDiagnosticRules(
                clientId,
                { ...cur, roas: roasCur, cpa: cpaCur, ctr: ctrCur, cvr: cur.clicks > 0 ? cur.purchases / cur.clicks : 0 },
                { ...prev, roas: roasPrev, cpa: cpaPrev, ctr: ctrPrev, cvr: prev.clicks > 0 ? prev.purchases / prev.clicks : 0 },
                campaignStats,
                allInsights,
                currentDatesList
            );

            findingsRun = {
                id: snapshotHash,
                clientId,
                ranges,
                findingsCount: findings.length,
                findings,
                createdAt: new Date().toISOString()
            };
            await db.collection("findings_runs").doc(snapshotHash).set(findingsRun);
        }

        if (runLLM) {
            try {
                const reportSnapshot = await db.collection("llm_reports")
                    .where("clientId", "==", clientId)
                    .orderBy("createdAt", "desc")
                    .limit(1)
                    .get();
                if (!reportSnapshot.empty) {
                    report = reportSnapshot.docs[0].data();
                }
            } catch (e: any) {
                if (e.code === 9 || e.message?.includes("index")) {
                    console.warn("Index missing for llm_reports. Proceeding to generate fresh report.");
                } else {
                    console.error("LLM Cache Read Error:", e);
                }
            }

            if (!report) {
                let currentFindings = findingsRun?.findings || [];
                if (currentFindings.length === 0 && !findingsRun) {
                    const latestFindingsSnap = await db.collection("findings")
                        .where("clientId", "==", clientId)
                        .orderBy("createdAt", "desc")
                        .limit(20)
                        .get();
                    currentFindings = latestFindingsSnap.docs.map(d => ({ ...d.data(), id: d.id } as any));
                }

                try {
                    console.log("Generating fresh LLM report...");
                    const generatedRecord = await generateGeminiReport(
                        clientId,
                        clientData,
                        currentFindings,
                        currentRangePreset || "Custom Range"
                    );
                    report = generatedRecord.report;
                } catch (genError: any) {
                    console.error("LLM Generation Failed:", genError);
                    // Throw to frontend so they see the error instead of empty state
                    return NextResponse.json({ error: `AI Gen Error: ${genError.message || genError}` }, { status: 500 });
                }
            } else if (report.report) {
                console.log("Returning cached LLM report");
                report = report.report;
            }
        }

        return NextResponse.json({
            snapshot,
            findingsRun,
            report,
            meta: {
                cacheHit: !forceRefresh && !!snapshot,
                dataFreshness: snapshot?.createdAt
            }
        });

    } catch (error: any) {
        console.error("Analyze Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
