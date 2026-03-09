import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { SlackService } from "@/lib/slack-service";
import { EventService } from "@/lib/event-service";
import { reportError } from "@/lib/error-reporter";
import { Client } from "@/types";
import { ChannelDailySnapshot } from "@/types/channel-snapshots";

export const maxDuration = 300;

/**
 * GET /api/cron/daily-briefing
 *
 * Daily cron: For each active client with a Slack channel configured,
 * reads channel_snapshots from 1st of month to yesterday, aggregates
 * per channel, and sends ONE unified Slack message.
 *
 * Revenue dedup: Ecommerce revenue is source of truth.
 * Blended ROAS = ecommerce_revenue / (meta_spend + google_spend).
 *
 * Schedule: 10:15 UTC (after data-sync at 10:00 and channel syncs at 09:00)
 */
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    try {
        // Optional: test a single client with ?clientId=XXX
        const filterClientId = request.nextUrl.searchParams.get("clientId");

        console.log(`[Cron Daily Briefing] Starting multi-channel digest...${filterClientId ? ` (single client: ${filterClientId})` : ""}`);

        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

        let clientsSnap;
        if (filterClientId) {
            // Single client mode — fetch just that one doc
            const doc = await db.collection("clients").doc(filterClientId).get();
            clientsSnap = { docs: doc.exists ? [doc] : [] };
        } else {
            clientsSnap = await db.collection("clients")
                .where("active", "==", true)
                .get();
        }

        const results: Array<{
            clientId: string;
            clientName: string;
            status: string;
            channels: string[];
            error?: string;
        }> = [];

        for (const clientDoc of clientsSnap.docs) {
            const client = clientDoc.data() as Client;
            const clientId = clientDoc.id;

            // Skip clients without Slack channel
            if (!client.slackInternalChannel) {
                results.push({ clientId, clientName: client.name, status: "skipped", channels: [] });
                continue;
            }

            try {
                // Fetch all channel_snapshots for this client from month start to yesterday
                const snapshotsSnap = await db.collection("channel_snapshots")
                    .where("clientId", "==", clientId)
                    .where("date", ">=", startOfMonth)
                    .where("date", "<=", yesterdayStr)
                    .get();

                if (snapshotsSnap.empty) {
                    console.log(`[Daily Briefing] ${client.name}: no snapshots found for ${startOfMonth} to ${yesterdayStr}`);
                    results.push({ clientId, clientName: client.name, status: "skipped", channels: [] });
                    continue;
                }

                const snapshots = snapshotsSnap.docs.map(d => d.data() as ChannelDailySnapshot);

                // Aggregate per channel
                const channelData = aggregateChannelData(snapshots);
                const activeChannels = Object.keys(channelData).filter(ch => {
                    const d = channelData[ch as keyof typeof channelData];
                    return d !== undefined;
                });

                if (activeChannels.length === 0) {
                    results.push({ clientId, clientName: client.name, status: "skipped", channels: [] });
                    continue;
                }

                await SlackService.sendMultiChannelDigest(
                    clientId,
                    client.name,
                    { start: startOfMonth, end: yesterdayStr },
                    channelData,
                    client.currency
                );

                console.log(`[Daily Briefing] ${client.name}: sent (${activeChannels.join(", ")})`);
                results.push({ clientId, clientName: client.name, status: "success", channels: activeChannels });

            } catch (clientError: any) {
                reportError("Cron Daily Briefing", clientError, { clientId, clientName: client.name });
                results.push({ clientId, clientName: client.name, status: "failed", channels: [], error: clientError.message });
            }
        }

        await EventService.logCronExecution({
            cronType: "daily-briefing",
            startedAt,
            completedAt: new Date().toISOString(),
            durationMs: Date.now() - startMs,
            summary: {
                total: results.length,
                success: results.filter(r => r.status === "success").length,
                failed: results.filter(r => r.status === "failed").length,
                skipped: results.filter(r => r.status === "skipped").length,
            },
            results: results.map(r => ({
                clientId: r.clientId,
                clientName: r.clientName,
                status: r.status,
                error: r.error,
            })),
            triggeredBy: request.headers.get("x-triggered-by") === "manual" ? "manual" : "schedule",
        });

        const successCount = results.filter(r => r.status === "success").length;
        console.log(`[Cron Daily Briefing] Done. ${successCount}/${results.length} clients sent.`);

        return NextResponse.json({ success: true, results });

    } catch (error: any) {
        await reportError("Cron Daily Briefing (Fatal)", error);

        await EventService.logCronExecution({
            cronType: "daily-briefing",
            startedAt,
            completedAt: new Date().toISOString(),
            durationMs: Date.now() - startMs,
            summary: { total: 0, success: 0, failed: 1, skipped: 0 },
            results: [{ clientId: "FATAL", status: "failed", error: error.message }],
            triggeredBy: "schedule",
        }).catch(() => {});

        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * Aggregate channel_snapshots into per-channel summaries.
 */
function aggregateChannelData(snapshots: ChannelDailySnapshot[]) {
    const meta = { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
    const google = { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
    const ecommerce = { revenue: 0, orders: 0, refunds: 0, totalRefundAmount: 0, newCustomers: 0, returningCustomers: 0, source: "" };
    const email = { sent: 0, opens: 0, emailClicks: 0, emailRevenue: 0, source: "" };

    let hasMeta = false, hasGoogle = false, hasEcom = false, hasEmail = false;

    for (const snap of snapshots) {
        const m = snap.metrics;

        switch (snap.channel) {
            case "META":
                hasMeta = true;
                meta.spend += m.spend || 0;
                meta.impressions += m.impressions || 0;
                meta.clicks += m.clicks || 0;
                meta.conversions += m.conversions || 0;
                meta.revenue += m.revenue || 0;
                break;

            case "GOOGLE":
                hasGoogle = true;
                google.spend += m.spend || 0;
                google.impressions += m.impressions || 0;
                google.clicks += m.clicks || 0;
                google.conversions += m.conversions || 0;
                google.revenue += m.revenue || 0;
                break;

            case "ECOMMERCE":
                hasEcom = true;
                ecommerce.revenue += m.revenue || 0;
                ecommerce.orders += m.orders || 0;
                ecommerce.refunds += m.refunds || 0;
                ecommerce.totalRefundAmount += m.totalRefundAmount || 0;
                ecommerce.newCustomers += m.newCustomers || 0;
                ecommerce.returningCustomers += m.returningCustomers || 0;
                if (snap.rawData?.source) ecommerce.source = snap.rawData.source as string;
                break;

            case "EMAIL":
                hasEmail = true;
                email.sent += m.sent || 0;
                email.opens += m.opens || 0;
                email.emailClicks += m.emailClicks || 0;
                email.emailRevenue += m.emailRevenue || 0;
                if (snap.rawData?.source) email.source = snap.rawData.source as string;
                break;
        }
    }

    const result: Parameters<typeof SlackService.sendMultiChannelDigest>[3] = {};

    if (hasMeta) {
        const ctr = meta.impressions > 0 ? (meta.clicks / meta.impressions) * 100 : 0;
        const roas = meta.spend > 0 ? meta.revenue / meta.spend : 0;
        const cpa = meta.conversions > 0 ? meta.spend / meta.conversions : 0;
        result.meta = { ...meta, ctr, roas, cpa };
    }

    if (hasGoogle) {
        const ctr = google.impressions > 0 ? (google.clicks / google.impressions) * 100 : 0;
        const roas = google.spend > 0 ? google.revenue / google.spend : 0;
        const cpa = google.conversions > 0 ? google.spend / google.conversions : 0;
        result.google = { ...google, ctr, roas, cpa };
    }

    if (hasEcom) {
        const avgOrderValue = ecommerce.orders > 0 ? ecommerce.revenue / ecommerce.orders : 0;
        result.ecommerce = { ...ecommerce, avgOrderValue };
    }

    if (hasEmail) {
        const openRate = email.sent > 0 ? (email.opens / email.sent) * 100 : 0;
        const clickRate = email.sent > 0 ? (email.emailClicks / email.sent) * 100 : 0;
        const clickToOpenRate = email.opens > 0 ? (email.emailClicks / email.opens) * 100 : 0;
        result.email = { ...email, openRate, clickRate, clickToOpenRate };
    }

    return result;
}
