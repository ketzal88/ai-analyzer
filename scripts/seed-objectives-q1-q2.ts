/**
 * Seed Q1 + Q2 2026 Quarterly Objectives for all active clients
 *
 * Reads channel_snapshots to compute baselines, then creates objectives with
 * realistic growth targets.
 *
 * Usage:
 *   npx tsx --require ./scripts/load-env.cjs scripts/seed-objectives-q1-q2.ts
 */

import { db } from "@/lib/firebase-admin";
import { Client } from "@/types";
import { ChannelDailySnapshot } from "@/types/channel-snapshots";
import { QuarterlyObjective, buildObjectiveId } from "@/types/semaforo";
import { ChannelType } from "@/lib/channel-brain-interface";

// ── Config ──────────────────────────────────────────
const GROWTH_TARGET = 1.15;     // 15% growth for regular metrics
const CPA_IMPROVEMENT = 0.90;   // 10% CPA improvement
const Q2_EXTRA_GROWTH = 1.05;   // Extra 5% on top of Q1 for Q2

interface MetricAccumulator {
    spend: number;
    revenue: number;
    conversions: number;
    clicks: number;
    impressions: number;
    orders: number;
    email_sent: number;
    email_opens: number;
    email_clicks: number;
    email_revenue: number;
}

function emptyAccumulator(): MetricAccumulator {
    return { spend: 0, revenue: 0, conversions: 0, clicks: 0, impressions: 0, orders: 0, email_sent: 0, email_opens: 0, email_clicks: 0, email_revenue: 0 };
}

function mapSnapshot(snap: ChannelDailySnapshot, acc: MetricAccumulator) {
    const m = snap.metrics;
    const ch = snap.channel;

    if (ch === 'META' || ch === 'GOOGLE') {
        acc.spend += m.spend || 0;
        acc.revenue += m.revenue || 0;
        acc.conversions += m.conversions || 0;
        acc.clicks += m.clicks || 0;
        acc.impressions += m.impressions || 0;
    } else if (ch === 'ECOMMERCE') {
        acc.orders += m.orders || 0;
        acc.revenue += m.revenue || 0;
    } else if (ch === 'EMAIL') {
        acc.email_sent += m.sent || 0;
        acc.email_opens += m.opens || 0;
        acc.email_clicks += m.emailClicks || 0;
        acc.email_revenue += m.emailRevenue || 0;
    }
}

function buildGoals(
    acc: MetricAccumulator,
    refDays: number,
    integraciones: Client['integraciones'],
    growthFactor: number
): Record<string, { target: number; baseline: number; isInverse?: boolean }> {
    const project = (val: number) => Math.round((val / refDays) * 90); // project to 90 days
    const goals: Record<string, { target: number; baseline: number; isInverse?: boolean }> = {};

    const hasAds = integraciones?.meta || integraciones?.google;
    const hasEcommerce = !!integraciones?.ecommerce;
    const hasEmail = !!integraciones?.email;

    if (hasAds && acc.spend > 0) {
        goals.spend = { baseline: project(acc.spend), target: Math.round(project(acc.spend) * growthFactor) };
    }
    if (acc.revenue > 0) {
        goals.revenue = { baseline: project(acc.revenue), target: Math.round(project(acc.revenue) * growthFactor) };
    }
    if (hasAds && acc.conversions > 0) {
        goals.conversions = { baseline: project(acc.conversions), target: Math.round(project(acc.conversions) * growthFactor) };
    }
    if (hasAds && acc.conversions > 0 && acc.spend > 0) {
        const cpa = acc.spend / acc.conversions;
        goals.cpa = {
            baseline: Math.round(cpa * 100) / 100,
            target: Math.round(cpa * CPA_IMPROVEMENT * 100) / 100,
            isInverse: true,
        };
    }
    if (hasEcommerce && acc.orders > 0) {
        goals.orders = { baseline: project(acc.orders), target: Math.round(project(acc.orders) * growthFactor) };
    }
    if (hasEmail && acc.email_sent > 0) {
        goals.email_sent = { baseline: project(acc.email_sent), target: Math.round(project(acc.email_sent) * growthFactor) };
    }
    if (hasEmail && acc.email_opens > 0) {
        goals.email_opens = { baseline: project(acc.email_opens), target: Math.round(project(acc.email_opens) * growthFactor) };
    }
    if (hasEmail && acc.email_clicks > 0) {
        goals.email_clicks = { baseline: project(acc.email_clicks), target: Math.round(project(acc.email_clicks) * growthFactor) };
    }
    if (hasEmail && acc.email_revenue > 0) {
        goals.email_revenue = { baseline: project(acc.email_revenue), target: Math.round(project(acc.email_revenue) * growthFactor) };
    }

    return goals;
}

async function main() {
    console.log("═".repeat(70));
    console.log("  Seed Quarterly Objectives — Q1 + Q2 2026");
    console.log("═".repeat(70));

    // Get all active clients
    const clientsSnap = await db.collection("clients").where("active", "==", true).get();
    const clients = clientsSnap.docs.map(d => {
        const data = d.data() as Client;
        data.id = d.id;
        return data;
    });

    console.log(`\nFound ${clients.length} active clients\n`);

    for (const client of clients) {
        console.log(`\n── ${client.name} (${client.id}) ──`);
        console.log(`   Integrations: meta=${client.integraciones?.meta}, google=${client.integraciones?.google}, ecommerce=${client.integraciones?.ecommerce}, email=${client.integraciones?.email}`);

        if (!client.integraciones) {
            console.log(`   SKIP: No integraciones configured`);
            continue;
        }

        // Fetch channel_snapshots by reading doc IDs directly (avoids composite index issues)
        const channels: ChannelType[] = [];
        if (client.integraciones.meta) channels.push('META');
        if (client.integraciones.google) channels.push('GOOGLE');
        if (client.integraciones.ecommerce) channels.push('ECOMMERCE');
        if (client.integraciones.email) channels.push('EMAIL');

        if (channels.length === 0) {
            console.log(`   SKIP: No active channels`);
            continue;
        }

        // Generate date range Jan 1 - Mar 4
        const dates: string[] = [];
        const d = new Date('2026-01-01');
        const endD = new Date('2026-03-04');
        while (d <= endD) {
            dates.push(d.toISOString().split('T')[0]);
            d.setDate(d.getDate() + 1);
        }

        // Read docs by ID pattern: {clientId}__{channel}__{date}
        const docIds: string[] = [];
        for (const ch of channels) {
            for (const date of dates) {
                docIds.push(`${client.id}__${ch}__${date}`);
            }
        }

        // Batch read in chunks of 100
        const snapshots: ChannelDailySnapshot[] = [];
        for (let i = 0; i < docIds.length; i += 100) {
            const chunk = docIds.slice(i, i + 100);
            const refs = chunk.map(id => db.collection("channel_snapshots").doc(id));
            const docs = await db.getAll(...refs);
            for (const doc of docs) {
                if (doc.exists) {
                    snapshots.push(doc.data() as ChannelDailySnapshot);
                }
            }
        }
        console.log(`   Found ${snapshots.length} channel_snapshots for Q1`);

        if (snapshots.length === 0) {
            console.log(`   SKIP: No data to compute baselines`);
            continue;
        }

        // Accumulate metrics
        const acc = emptyAccumulator();
        for (const snap of snapshots) {
            mapSnapshot(snap, acc);
        }

        // Calculate reference days (from first snapshot to last)
        const sortedDates = snapshots.map(s => s.date).sort();
        const firstDate = new Date(sortedDates[0]);
        const lastDate = new Date(sortedDates[sortedDates.length - 1]);
        const refDays = Math.max(1, Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

        console.log(`   Reference period: ${sortedDates[0]} → ${sortedDates[sortedDates.length - 1]} (${refDays} days)`);
        console.log(`   Raw totals: spend=$${acc.spend.toFixed(0)}, revenue=$${acc.revenue.toFixed(0)}, conversions=${acc.conversions}, orders=${acc.orders}, emails=${acc.email_sent}`);

        // ── Q1 2026 ──
        const q1Goals = buildGoals(acc, refDays, client.integraciones, GROWTH_TARGET);
        if (Object.keys(q1Goals).length === 0) {
            console.log(`   SKIP: No meaningful goals could be derived`);
            continue;
        }

        const q1: QuarterlyObjective = {
            clientId: client.id,
            quarter: "Q1_2026",
            year: 2026,
            quarterNumber: 1,
            startDate: "2026-01-01",
            endDate: "2026-03-31",
            goals: q1Goals,
            weeklyPacing: { mode: 'linear' },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const q1Id = buildObjectiveId(client.id, "Q1_2026");
        await db.collection("quarterly_objectives").doc(q1Id).set(q1);
        console.log(`   Q1 2026 created: ${Object.keys(q1Goals).length} goals`);
        for (const [key, goal] of Object.entries(q1Goals)) {
            console.log(`     ${key}: baseline=${goal.baseline}, target=${goal.target}${goal.isInverse ? ' (inverse)' : ''}`);
        }

        // ── Q2 2026 ──
        const q2Goals = buildGoals(acc, refDays, client.integraciones, GROWTH_TARGET * Q2_EXTRA_GROWTH);
        const q2: QuarterlyObjective = {
            clientId: client.id,
            quarter: "Q2_2026",
            year: 2026,
            quarterNumber: 2,
            startDate: "2026-04-01",
            endDate: "2026-06-30",
            goals: q2Goals,
            weeklyPacing: { mode: 'linear' },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const q2Id = buildObjectiveId(client.id, "Q2_2026");
        await db.collection("quarterly_objectives").doc(q2Id).set(q2);
        console.log(`   Q2 2026 created: ${Object.keys(q2Goals).length} goals`);
        for (const [key, goal] of Object.entries(q2Goals)) {
            console.log(`     ${key}: baseline=${goal.baseline}, target=${goal.target}${goal.isInverse ? ' (inverse)' : ''}`);
        }
    }

    // Verify
    console.log("\n" + "═".repeat(70));
    console.log("  Verification");
    console.log("═".repeat(70));

    const allObjectives = await db.collection("quarterly_objectives").get();
    console.log(`\nTotal quarterly_objectives in Firestore: ${allObjectives.size}`);
    for (const doc of allObjectives.docs) {
        const obj = doc.data() as QuarterlyObjective;
        console.log(`  ${doc.id} — ${obj.quarter} — ${Object.keys(obj.goals).length} goals`);
    }

    console.log("\nDone!");
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
