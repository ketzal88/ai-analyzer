import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { PerformanceService } from "@/lib/performance-service";
import { ClientSnapshotService } from "@/lib/client-snapshot-service";
import { BackfillService } from "@/lib/backfill-service";
import { EventService } from "@/lib/event-service";
import { reportError } from "@/lib/error-reporter";
import { Client } from "@/types";
import { buildChannelSnapshotId, ChannelDailySnapshot } from "@/types/channel-snapshots";

export const maxDuration = 300; // Allow 5 minutes

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    try {
        console.log("[Cron Data Sync] Starting daily sync job...");
        const clientsSnap = await db.collection("clients")
            .where("active", "==", true)
            .get();

        const results: Array<{ clientId: string; clientName?: string; status: string; error?: string }> = [];

        for (const clientDoc of clientsSnap.docs) {
            const client = clientDoc.data() as Client;
            const clientId = clientDoc.id;

            if (!client.metaAdAccountId) {
                results.push({ clientId, clientName: client.name, status: "skipped" });
                continue;
            }

            try {
                // CRITICAL: Using "today" instead of "this_month" to stay within Firebase free tier (20k writes/day).
                await PerformanceService.syncAllLevels(clientId, client.metaAdAccountId, "today");
                const { main } = await ClientSnapshotService.computeAndStore(clientId);
                await ClientSnapshotService.cleanupOldSnapshots(clientId);

                // Send Daily Digest & Alerts
                const { SlackService } = await import("@/lib/slack-service");
                const { EngineConfigService } = await import("@/lib/engine-config-service");

                try {
                    const config = await EngineConfigService.getEngineConfig(clientId);

                    // 1. Send Daily KPI Snapshot (Month-to-Date)
                    if ((main.accountSummary.rolling.spend_7d || 0) > 0) {
                        const kpis = SlackService.buildSnapshotFromClientSnapshot(main.accountSummary);
                        const todayStr = new Date().toISOString().split("T")[0];
                        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
                        const dateRange = { start: startOfMonth, end: todayStr };

                        await SlackService.sendDailySnapshot(clientId, client.name, dateRange, kpis, config.dailySnapshotTitle);
                    }

                    // 2. Send Alert Digest (Grouped recommendations)
                    if (main.alerts.length > 0) {
                        await SlackService.sendDigest(clientId, client.name, main.alerts);
                    }
                } catch (slackErr: any) {
                    // Non-fatal: sync succeeded, only delivery failed — still worth knowing
                    await reportError("Cron Data Sync (Slack Delivery)", slackErr, {
                        clientId,
                        clientName: client.name,
                        metadata: { stage: "slack_digest" }
                    });
                }

                // 3. Write today's actual Meta daily data into channel_snapshots
                try {
                    const todayStr = new Date().toISOString().split("T")[0];
                    const metaToken = process.env.META_ACCESS_TOKEN;
                    const metaVersion = process.env.META_API_VERSION || "v24.0";
                    if (metaToken && client.metaAdAccountId) {
                        const cleanId = client.metaAdAccountId.startsWith("act_") ? client.metaAdAccountId : `act_${client.metaAdAccountId}`;
                        const timeRange = JSON.stringify({ since: todayStr, until: todayStr });
                        const fields = "spend,impressions,clicks,reach,frequency,ctr,cpc,actions,action_values";
                        const metaUrl = `https://graph.facebook.com/${metaVersion}/${cleanId}/insights?level=account&time_increment=1&time_range=${encodeURIComponent(timeRange)}&fields=${fields}&access_token=${metaToken}`;
                        const metaRes = await fetch(metaUrl);
                        if (metaRes.ok) {
                            const metaJson = await metaRes.json();
                            const row = metaJson.data?.[0];
                            if (row) {
                                const getAct = (type: string) => Number(row.actions?.find((a: any) => a.action_type === type)?.value || 0);
                                const getActVal = (type: string) => Number(row.action_values?.find((a: any) => a.action_type === type)?.value || 0);
                                const spend = Number(row.spend || 0);
                                const impressions = Number(row.impressions || 0);
                                const clicks = Number(row.clicks || 0);
                                const purchases = getAct("purchase") || getAct("offsite_conversion.fb_pixel_purchase");
                                const revenue = getActVal("purchase") || getActVal("offsite_conversion.fb_pixel_purchase");
                                const leads = getAct("lead") || getAct("offsite_conversion.fb_pixel_lead");
                                const messages = getAct("onsite_conversion.messaging_first_reply");
                                const conversions = purchases || leads || messages || 0;

                                const metaSnapshot: ChannelDailySnapshot = {
                                    clientId,
                                    channel: 'META',
                                    date: todayStr,
                                    metrics: {
                                        spend,
                                        revenue,
                                        conversions,
                                        impressions,
                                        clicks,
                                        ctr: Number(row.ctr || 0),
                                        cpc: Number(row.cpc || 0),
                                        roas: spend > 0 ? revenue / spend : 0,
                                        cpa: conversions > 0 ? spend / conversions : 0,
                                        reach: Number(row.reach || 0),
                                        frequency: Number(row.frequency || 0),
                                    },
                                    syncedAt: new Date().toISOString(),
                                };
                                const docId = buildChannelSnapshotId(clientId, 'META', todayStr);
                                await db.collection('channel_snapshots').doc(docId).set(metaSnapshot, { merge: true });
                            }
                        }
                    }
                } catch (metaBackfillErr: any) {
                    console.warn(`[Cron Data Sync] Meta→channel_snapshots failed for ${clientId}:`, metaBackfillErr.message);
                }

                results.push({ clientId, clientName: client.name, status: "success" });
            } catch (e: any) {
                reportError("Cron Data Sync (Client)", e, { clientId, clientName: client.name });
                results.push({ clientId, clientName: client.name, status: "failed", error: e.message });
            }
        }

        // --- Historical Backfill Integration ---
        try {
            console.log("[Cron Data Sync] Processing historical backfill batch...");
            const backfillResults = await BackfillService.processBatch(3); // Conservative 3 tasks per run
            if (backfillResults.length > 0) {
                console.log(`[Cron Data Sync] Processed ${backfillResults.length} backfill tasks.`);
            }
        } catch (be: any) {
            // Non-fatal: backfill failures mean the queue may accumulate — worth monitoring
            await reportError("Cron Data Sync (Backfill Batch)", be, {
                metadata: { stage: "backfill_batch" }
            });
        }

        const completedAt = new Date().toISOString();

        // Log cron execution
        await EventService.logCronExecution({
            cronType: "data-sync",
            startedAt,
            completedAt,
            durationMs: Date.now() - startMs,
            summary: {
                total: results.length,
                success: results.filter(r => r.status === "success").length,
                failed: results.filter(r => r.status === "failed").length,
                skipped: results.filter(r => r.status === "skipped").length,
            },
            results,
            triggeredBy: request.headers.get("x-triggered-by") === "manual" ? "manual" : "schedule",
        });

        console.log("[Cron Data Sync] Completed.", results);

        return NextResponse.json({ success: true, results });

    } catch (error: any) {
        reportError("Cron Data Sync (Fatal)", error);

        // Log failed cron execution
        await EventService.logCronExecution({
            cronType: "data-sync",
            startedAt,
            completedAt: new Date().toISOString(),
            durationMs: Date.now() - startMs,
            summary: { total: 0, success: 0, failed: 1, skipped: 0 },
            results: [{ clientId: "FATAL", status: "failed", error: error.message }],
            triggeredBy: "schedule",
        }).catch(() => { });

        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
