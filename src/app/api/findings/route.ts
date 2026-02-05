import { auth, db } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";
import { InsightDaily, DiagnosticFinding, Severity } from "@/types";

export async function POST(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const clientId = searchParams.get("clientId");
        const range = searchParams.get("range") || "last_14d";

        if (!clientId) {
            return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
        }

        // 1. Auth check
        const sessionCookie = request.cookies.get("session")?.value;
        if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        await auth.verifySessionCookie(sessionCookie);

        // 2. Load client info & verify active
        const clientDoc = await db.collection("clients").doc(clientId).get();
        if (!clientDoc.exists) return NextResponse.json({ error: "Client not found" }, { status: 404 });
        const clientData = clientDoc.data()!;
        if (!clientData.active) return NextResponse.json({ error: "Client is inactive" }, { status: 403 });

        // 3. Fetch insights from Firestore
        const insightsSnapshot = await db.collection("insights_daily")
            .where("clientId", "==", clientId)
            .orderBy("date", "desc")
            .limit(1000) // Safety limit
            .get();

        const allInsights = insightsSnapshot.docs.map(doc => doc.data() as InsightDaily);
        if (allInsights.length === 0) {
            return NextResponse.json({ error: "No data found for diagnosis" }, { status: 404 });
        }

        // 4. Split and Aggregate Metrics
        const dates = [...new Set(allInsights.map(i => i.date))].sort();
        const midPoint = Math.floor(dates.length / 2);
        const previousDates = dates.slice(0, midPoint);
        const currentDates = dates.slice(midPoint);

        const aggregate = (data: InsightDaily[]) => {
            const stats = data.reduce((acc, curr) => ({
                spend: acc.spend + curr.spend,
                impressions: acc.impressions + curr.impressions,
                clicks: acc.clicks + curr.clicks,
                purchases: acc.purchases + curr.purchases,
                purchaseValue: acc.purchaseValue + curr.purchaseValue,
            }), { spend: 0, impressions: 0, clicks: 0, purchases: 0, purchaseValue: 0 });

            return {
                ...stats,
                ctr: stats.impressions > 0 ? stats.clicks / stats.impressions : 0,
                cpc: stats.clicks > 0 ? stats.spend / stats.clicks : 0,
                roas: stats.spend > 0 ? stats.purchaseValue / stats.spend : 0,
                cpa: stats.purchases > 0 ? stats.spend / stats.purchases : 0,
                cvr: stats.clicks > 0 ? stats.purchases / stats.clicks : 0,
            };
        };

        const currentStats = aggregate(allInsights.filter(i => currentDates.includes(i.date)));
        const previousStats = aggregate(allInsights.filter(i => previousDates.includes(i.date)));

        const campaignStats = allInsights.filter(i => currentDates.includes(i.date)).reduce((acc: any, curr) => {
            if (!acc[curr.campaignId]) {
                acc[curr.campaignId] = { id: curr.campaignId, name: curr.campaignName, spend: 0, purchases: 0, purchaseValue: 0, clicks: 0, impressions: 0 };
            }
            acc[curr.campaignId].spend += curr.spend;
            acc[curr.campaignId].purchases += curr.purchases;
            acc[curr.campaignId].purchaseValue += curr.purchaseValue;
            acc[curr.campaignId].clicks += curr.clicks;
            acc[curr.campaignId].impressions += curr.impressions;
            return acc;
        }, {});

        const findings: Omit<DiagnosticFinding, "id">[] = [];

        // --- RULES ENGINE ---

        // 1. CPA_SPIKE
        if (previousStats.cpa > 0) {
            const delta = (currentStats.cpa / previousStats.cpa) - 1;
            if (delta > 0.25) {
                findings.push({
                    clientId,
                    type: "CPA_SPIKE",
                    title: "Critical Cost-Per-Acquisition Spike",
                    description: `Account CPA has increased by ${Math.round(delta * 100)}% compared to the previous week. Conversion cost efficiency is dropping significantly.`,
                    severity: "CRITICAL",
                    status: "ATTENTION",
                    entities: [],
                    evidence: { current: currentStats.cpa, previous: previousStats.cpa, delta: delta * 100, threshold: 25 },
                    version: 1,
                    createdAt: new Date().toISOString()
                });
            }
        }

        // 2. ROAS_DROP
        if (previousStats.roas > 0) {
            const delta = (currentStats.roas / previousStats.roas) - 1;
            if (delta < -0.15) {
                findings.push({
                    clientId,
                    type: "ROAS_DROP",
                    title: "Revenue Efficiency Decline",
                    description: `ROAS has dropped by ${Math.abs(Math.round(delta * 100))}% WoW. Your return on ad spend is deteriorating.`,
                    severity: "CRITICAL",
                    status: "ATTENTION",
                    entities: [],
                    evidence: { current: currentStats.roas, previous: previousStats.roas, delta: delta * 100, threshold: -15 },
                    version: 1,
                    createdAt: new Date().toISOString()
                });
            }
        }

        // 3. CVR_DROP (Stable CTR, Falling CVR)
        if (previousStats.cvr > 0 && previousStats.ctr > 0) {
            const ctrDelta = Math.abs((currentStats.ctr / previousStats.ctr) - 1);
            const cvrDelta = (currentStats.cvr / previousStats.cvr) - 1;
            if (ctrDelta < 0.05 && cvrDelta < -0.15) {
                findings.push({
                    clientId,
                    type: "CVR_DROP",
                    title: "Post-Click Conversion Drop",
                    description: `Traffic quality/intent seems stable (CTR stable), but Conversion Rate fell by ${Math.abs(Math.round(cvrDelta * 100))}%. Investigate landing page or offer changes.`,
                    severity: "WARNING",
                    status: "ATTENTION",
                    entities: [],
                    evidence: { current: currentStats.cvr, previous: previousStats.cvr, delta: cvrDelta * 100, threshold: -15 },
                    version: 1,
                    createdAt: new Date().toISOString()
                });
            }
        }

        // 4. CTR_DROP
        if (previousStats.ctr > 0) {
            const delta = (currentStats.ctr / previousStats.ctr) - 1;
            if (delta < -0.15) {
                findings.push({
                    clientId,
                    type: "CTR_DROP",
                    title: "Ad Relevancy Decay",
                    description: `Click-Through Rate dropped by ${Math.abs(Math.round(delta * 100))}%. This usually indicates creative fatigue or audience mismatch.`,
                    severity: "WARNING",
                    status: "ATTENTION",
                    entities: [],
                    evidence: { current: currentStats.ctr, previous: previousStats.ctr, delta: delta * 100, threshold: -15 },
                    version: 1,
                    createdAt: new Date().toISOString()
                });
            }
        }

        // 5. SPEND_CONCENTRATION
        const sortedCampaigns = Object.values(campaignStats).sort((a: any, b: any) => b.spend - a.spend) as any[];
        const totalSpend = currentStats.spend;
        const top20Count = Math.max(1, Math.round(sortedCampaigns.length * 0.2));
        const topSpend = sortedCampaigns.slice(0, top20Count).reduce((s, c) => s + c.spend, 0);
        if (totalSpend > 0 && (topSpend / totalSpend) > 0.8) {
            findings.push({
                clientId,
                type: "SPEND_CONCENTRATION",
                title: "High Budget Concentration",
                description: `Top ${top20Count} campaigns account for over 80% of total spend. Your account performance depends heavily on very few entities.`,
                severity: "WARNING",
                status: "ATTENTION",
                entities: sortedCampaigns.slice(0, top20Count).map(c => c.name),
                evidence: { current: (topSpend / totalSpend) * 100, previous: 0, delta: (topSpend / totalSpend) * 100, threshold: 80 },
                version: 1,
                createdAt: new Date().toISOString()
            });
        }

        // 6. NO_CONVERSIONS_HIGH_SPEND
        const avgCPA = currentStats.cpa || 50; // Use fallback if no purchases globally
        const bleedingCampaigns = sortedCampaigns.filter(c => c.purchases === 0 && c.spend > (avgCPA * 2));
        if (bleedingCampaigns.length > 0) {
            findings.push({
                clientId,
                type: "NO_CONVERSIONS_HIGH_SPEND",
                title: "Budget Bleed Detected",
                description: `${bleedingCampaigns.length} campaigns spent over 2x average CPA with zero conversions. Immediate action required.`,
                severity: "CRITICAL",
                status: "ATTENTION",
                entities: bleedingCampaigns.map(c => c.name),
                evidence: { current: bleedingCampaigns.reduce((s, c) => s + c.spend, 0), previous: 0, delta: 0, threshold: avgCPA * 2 },
                version: 1,
                createdAt: new Date().toISOString()
            });
        }

        // 7. VOLATILITY (Simple Daily CPA check)
        // We'll just check if daily CPA fluctuates > 50% on average
        const dailyCPAs = allInsights.filter(i => currentDates.includes(i.date)).map(i => i.cpa).filter(c => c > 0);
        if (dailyCPAs.length > 3) {
            const mean = dailyCPAs.reduce((a, b) => a + b) / dailyCPAs.length;
            const variance = dailyCPAs.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / dailyCPAs.length;
            const stdDev = Math.sqrt(variance);
            if (stdDev / mean > 0.5) {
                findings.push({
                    clientId,
                    type: "VOLATILITY",
                    title: "Performance Instability",
                    description: "Daily CPA variance is extremely high (>50% coefficient of variation). The algorithm is struggling to find stable audience segments.",
                    severity: "WARNING",
                    status: "ATTENTION",
                    entities: [],
                    evidence: { current: (stdDev / mean) * 100, previous: 0, delta: 0, threshold: 50 },
                    version: 1,
                    createdAt: new Date().toISOString()
                });
            }
        }

        // 8. UNDERFUNDED_WINNERS
        const winners = sortedCampaigns.filter(c =>
            c.spend > 0 &&
            (c.purchases > 0 && (c.spend / c.purchases) < (currentStats.cpa * 0.8)) &&
            (c.spend < (currentStats.spend / sortedCampaigns.length))
        );
        if (winners.length > 0) {
            findings.push({
                clientId,
                type: "UNDERFUNDED_WINNERS",
                title: "Scaling Opportunity",
                description: `${winners.length} campaigns have CPA 20% better than average but are receiving below-average budget.`,
                severity: "HEALTHY",
                status: "OPTIMAL",
                entities: winners.map(c => c.name),
                evidence: { current: winners.length, previous: 0, delta: 0, threshold: 0 },
                version: 1,
                createdAt: new Date().toISOString()
            });
        }

        // 5. Persist Findings
        const batch = db.batch();
        findings.forEach(f => {
            const docRef = db.collection("findings").doc();
            batch.set(docRef, f);
        });
        await batch.commit();

        return NextResponse.json({
            summary: {
                clientId,
                currentStats,
                WoW_Changes: {
                    spend: (currentStats.spend / previousStats.spend - 1) * 100,
                    cpa: (currentStats.cpa / previousStats.cpa - 1) * 100,
                    roas: (currentStats.roas / previousStats.roas - 1) * 100,
                }
            },
            findingsCount: findings.length,
            findings
        });

    } catch (error: any) {
        console.error("Findings Engine Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
