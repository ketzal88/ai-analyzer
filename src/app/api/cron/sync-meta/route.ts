import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { EventService } from "@/lib/event-service";
import { reportError } from "@/lib/error-reporter";
import { Client } from "@/types";
import { buildChannelSnapshotId, ChannelDailySnapshot } from "@/types/channel-snapshots";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    try {
        console.log("[Cron Sync Meta] Starting Meta Ads channel sync...");

        const clientsSnap = await db.collection("clients")
            .where("active", "==", true)
            .get();

        const results: Array<{ clientId: string; clientName?: string; status: string; spend?: number; error?: string }> = [];

        // Sync only yesterday (complete closed day)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];

        const metaToken = process.env.META_ACCESS_TOKEN;
        const metaVersion = process.env.META_API_VERSION || "v24.0";

        if (!metaToken) {
            return NextResponse.json({ error: "No META_ACCESS_TOKEN configured" }, { status: 500 });
        }

        for (const clientDoc of clientsSnap.docs) {
            const client = clientDoc.data() as Client;
            const clientId = clientDoc.id;

            if (!client.integraciones?.meta || !client.metaAdAccountId) {
                results.push({ clientId, clientName: client.name, status: "skipped" });
                continue;
            }

            try {
                const cleanId = client.metaAdAccountId.startsWith("act_") ? client.metaAdAccountId : `act_${client.metaAdAccountId}`;
                const timeRange = JSON.stringify({ since: yesterdayStr, until: yesterdayStr });
                // ── Account-level insights (expanded fields) ──
                const fields = [
                    "spend", "impressions", "clicks", "reach", "frequency", "ctr", "cpc", "cpm", "cpp",
                    "actions", "action_values", "cost_per_action_type",
                    "inline_link_clicks", "inline_link_click_ctr", "outbound_clicks", "cost_per_inline_link_click",
                    "unique_clicks", "unique_inline_link_clicks",
                    "quality_ranking", "engagement_rate_ranking", "conversion_rate_ranking",
                    "video_play_actions", "video_p25_watched_actions", "video_p50_watched_actions",
                    "video_p75_watched_actions", "video_p100_watched_actions",
                    "video_30_sec_watched_actions", "video_avg_time_watched_actions",
                ].join(",");
                const metaUrl = `https://graph.facebook.com/${metaVersion}/${cleanId}/insights?level=account&time_increment=1&time_range=${encodeURIComponent(timeRange)}&fields=${fields}&access_token=${metaToken}`;

                const metaRes = await fetch(metaUrl);
                if (!metaRes.ok) {
                    const errBody: any = await metaRes.json().catch(() => ({}));
                    throw new Error(errBody.error?.message || `API ${metaRes.status}`);
                }

                const metaJson: any = await metaRes.json();
                const row = metaJson.data?.[0];

                if (row) {
                    const getAct = (type: string) => Number(row.actions?.find((a: any) => a.action_type === type)?.value || 0);
                    const getActVal = (type: string) => Number(row.action_values?.find((a: any) => a.action_type === type)?.value || 0);
                    const getCostPerAct = (type: string) => Number(row.cost_per_action_type?.find((a: any) => a.action_type === type)?.value || 0);
                    const getVideoAct = (field: string) => Number(row[field]?.[0]?.value || 0);

                    const spend = Number(row.spend || 0);
                    const impressions = Number(row.impressions || 0);
                    const clicks = Number(row.clicks || 0);
                    const purchases = getAct("purchase") || getAct("offsite_conversion.fb_pixel_purchase");
                    const revenue = getActVal("purchase") || getActVal("offsite_conversion.fb_pixel_purchase");
                    const leads = getAct("lead") || getAct("offsite_conversion.fb_pixel_lead");
                    const messages = getAct("onsite_conversion.messaging_first_reply");
                    const conversions = purchases || leads || messages || 0;

                    // Mid-funnel actions
                    const addToCart = getAct("offsite_conversion.fb_pixel_add_to_cart") || getAct("add_to_cart");
                    const initiateCheckout = getAct("offsite_conversion.fb_pixel_initiate_checkout") || getAct("initiate_checkout");
                    const viewContent = getAct("offsite_conversion.fb_pixel_view_content") || getAct("view_content");

                    const metaSnapshot: ChannelDailySnapshot = {
                        clientId,
                        channel: 'META',
                        date: yesterdayStr,
                        metrics: {
                            spend,
                            revenue,
                            conversions,
                            impressions,
                            clicks,
                            ctr: Number(row.ctr || 0),
                            cpc: Number(row.cpc || 0),
                            cpm: Number(row.cpm || 0),
                            cpp: Number(row.cpp || 0),
                            roas: spend > 0 ? revenue / spend : 0,
                            cpa: conversions > 0 ? spend / conversions : 0,
                            reach: Number(row.reach || 0),
                            frequency: Number(row.frequency || 0),
                            // Click quality
                            inlineLinkClicks: Number(row.inline_link_clicks || 0),
                            inlineLinkClickCtr: Number(row.inline_link_click_ctr || 0),
                            costPerInlineLinkClick: Number(row.cost_per_inline_link_click || 0),
                            uniqueClicks: Number(row.unique_clicks || 0),
                            outboundClicks: Number(row.outbound_clicks?.[0]?.value || row.outbound_clicks || 0),
                            // Mid-funnel
                            addToCart: addToCart || undefined,
                            initiateCheckout: initiateCheckout || undefined,
                            viewContent: viewContent || undefined,
                            costPerAddToCart: addToCart > 0 ? getCostPerAct("offsite_conversion.fb_pixel_add_to_cart") || getCostPerAct("add_to_cart") : undefined,
                            costPerInitiateCheckout: initiateCheckout > 0 ? getCostPerAct("offsite_conversion.fb_pixel_initiate_checkout") || getCostPerAct("initiate_checkout") : undefined,
                            // Quality signals
                            qualityRanking: row.quality_ranking || undefined,
                            engagementRateRanking: row.engagement_rate_ranking || undefined,
                            conversionRateRanking: row.conversion_rate_ranking || undefined,
                            // Video
                            videoPlays: getVideoAct("video_play_actions") || undefined,
                            videoP25: getVideoAct("video_p25_watched_actions") || undefined,
                            videoP50: getVideoAct("video_p50_watched_actions") || undefined,
                            videoP75: getVideoAct("video_p75_watched_actions") || undefined,
                            videoP100: getVideoAct("video_p100_watched_actions") || undefined,
                            video30sViews: getVideoAct("video_30_sec_watched_actions") || undefined,
                            videoAvgWatchTime: getVideoAct("video_avg_time_watched_actions") || undefined,
                        },
                        syncedAt: new Date().toISOString(),
                    };

                    // ── Campaign breakdown (separate API call) ──
                    try {
                        const campaignFields = "campaign_id,campaign_name,objective,spend,impressions,clicks,actions,action_values,ctr,cpc,cpm";
                        const campaignUrl = `https://graph.facebook.com/${metaVersion}/${cleanId}/insights?level=campaign&time_increment=1&time_range=${encodeURIComponent(timeRange)}&fields=${campaignFields}&limit=500&access_token=${metaToken}`;
                        const campRes = await fetch(campaignUrl);
                        if (campRes.ok) {
                            const campJson: any = await campRes.json();
                            const campaigns = (campJson.data || []).map((c: any) => {
                                const cGetAct = (type: string) => Number(c.actions?.find((a: any) => a.action_type === type)?.value || 0);
                                const cGetActVal = (type: string) => Number(c.action_values?.find((a: any) => a.action_type === type)?.value || 0);
                                const cSpend = Number(c.spend || 0);
                                const cConversions = cGetAct("purchase") || cGetAct("offsite_conversion.fb_pixel_purchase") || cGetAct("lead") || cGetAct("offsite_conversion.fb_pixel_lead") || 0;
                                const cRevenue = cGetActVal("purchase") || cGetActVal("offsite_conversion.fb_pixel_purchase") || 0;
                                return {
                                    id: c.campaign_id,
                                    name: c.campaign_name,
                                    objective: c.objective,
                                    spend: cSpend,
                                    impressions: Number(c.impressions || 0),
                                    clicks: Number(c.clicks || 0),
                                    conversions: cConversions,
                                    revenue: cRevenue,
                                    roas: cSpend > 0 ? cRevenue / cSpend : 0,
                                    ctr: Number(c.ctr || 0),
                                    cpc: Number(c.cpc || 0),
                                    cpa: cConversions > 0 ? cSpend / cConversions : 0,
                                };
                            });
                            metaSnapshot.rawData = { campaigns };
                        }
                    } catch {
                        // Non-fatal: campaign breakdown is bonus data
                    }

                    const docId = buildChannelSnapshotId(clientId, 'META', yesterdayStr);
                    await db.collection('channel_snapshots').doc(docId).set(metaSnapshot, { merge: true });
                    results.push({ clientId, clientName: client.name, status: "success", spend: Number(row.spend || 0) });
                } else {
                    // No data for yesterday — write zero-spend snapshot
                    const zeroSnapshot: ChannelDailySnapshot = {
                        clientId,
                        channel: 'META',
                        date: yesterdayStr,
                        metrics: { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, ctr: 0, cpc: 0, cpa: 0, roas: 0, reach: 0, frequency: 0 },
                        rawData: { filled: true, reason: "no_spend" },
                        syncedAt: new Date().toISOString(),
                    };
                    const docId = buildChannelSnapshotId(clientId, 'META', yesterdayStr);
                    await db.collection('channel_snapshots').doc(docId).set(zeroSnapshot);
                    results.push({ clientId, clientName: client.name, status: "success", spend: 0 });
                }
            } catch (e: any) {
                await reportError("Cron Sync Meta (Client)", e, { clientId, clientName: client.name });
                results.push({ clientId, clientName: client.name, status: "failed", error: e.message });
            }
        }

        await EventService.logCronExecution({
            cronType: "sync-meta",
            startedAt,
            completedAt: new Date().toISOString(),
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

        console.log("[Cron Sync Meta] Completed.", results);
        return NextResponse.json({ success: true, results });

    } catch (error: any) {
        await reportError("Cron Sync Meta (Fatal)", error);

        await EventService.logCronExecution({
            cronType: "sync-meta",
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
