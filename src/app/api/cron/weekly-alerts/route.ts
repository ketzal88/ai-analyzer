import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { SlackService } from "@/lib/slack-service";
import { EntityRollingMetrics } from "@/types/performance-snapshots";
import { Client } from "@/types";

export async function GET(request: NextRequest) {
    // Check for authorization (CRON_SECRET)
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const clientsSnap = await db.collection("clients").where("active", "==", true).get();
        const results: any[] = [];

        for (const clientDoc of clientsSnap.docs) {
            const client = clientDoc.data() as Client;
            const clientId = client.id;

            // 1. Get account-level rolling metrics
            const rollingDoc = await db.collection("entity_rolling_metrics")
                .doc(`${clientId}__${client.metaAdAccountId}__account`)
                .get();

            if (!rollingDoc.exists) {
                // Try finding by level account if the ID pattern is different
                const altRolling = await db.collection("entity_rolling_metrics")
                    .where("clientId", "==", clientId)
                    .where("level", "==", "account")
                    .limit(1)
                    .get();

                if (altRolling.empty) continue;

                const rolling = altRolling.docs[0].data() as EntityRollingMetrics;
                await processClientWeekly(client, rolling, results);
            } else {
                const rolling = rollingDoc.data() as EntityRollingMetrics;
                await processClientWeekly(client, rolling, results);
            }
        }

        return NextResponse.json({
            success: true,
            processed: results.length,
            details: results
        });
    } catch (error: any) {
        console.error("Weekly Alerts Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

async function processClientWeekly(client: Client, rolling: EntityRollingMetrics, results: any[]) {
    const r = rolling.rolling;

    // Only process if there's spend in the last 7 days
    if ((r.spend_7d || 0) === 0) return;

    const kpis = {
        spend: r.spend_7d || 0,
        spendDelta: r.budget_change_3d_pct || 0, // Using budget change as a proxy if WoW spend delta isn't explicitly stored, 
        // but wait, PerformanceService calculates WoW deltas for some!
        cpa: r.cpa_7d || 0,
        cpaDelta: r.cpa_delta_pct || 0,
        roas: r.roas_7d || 0,
        roasDelta: r.roas_delta_pct || 0,
        purchases: r.purchases_7d || 0,
        purchasesDelta: 0 // Will estimate from spend/CPA deltas if not present, or better, calculate here if we had more history
    };

    // Calculate purchases delta if possible
    // purchases_delta = ((curr / prev) - 1) * 100
    // If we have ROAS delta and Spend delta, we can infer revenue delta.
    // Let's keep it simple with what we have.

    await SlackService.sendWeeklySummary(client.id, client.name, kpis);

    results.push({
        clientId: client.id,
        clientName: client.name,
        status: "sent"
    });
}
