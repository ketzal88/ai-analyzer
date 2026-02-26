import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { SlackService } from "@/lib/slack-service";
import { AlertEngine } from "@/lib/alert-engine";
import { Client, Alert } from "@/types";
import { withErrorReporting } from "@/lib/error-reporter";

/**
 * On-demand Slack Alert Sender
 * 
 * POST /api/slack/send-alert
 * Body: { clientId: string, mode: "snapshot" | "digest" | "critical" | "all" }
 * 
 * Useful for manual triggering from the UI or testing.
 */
export const POST = withErrorReporting("API Slack Send Alert", async (request: NextRequest) => {
    try {
        const body = await request.json();
        const { clientId, mode = "all" } = body;

        if (!clientId) {
            return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
        }

        const clientDoc = await db.collection("clients").doc(clientId).get();
        if (!clientDoc.exists) {
            return NextResponse.json({ error: "Client not found" }, { status: 404 });
        }

        const client = clientDoc.data() as Client;
        const result: Record<string, any> = { clientId, clientName: client.name };

        // ── SNAPSHOT ──
        if (mode === "snapshot" || mode === "all") {
            const rollingSnap = await db.collection("entity_rolling_metrics")
                .where("clientId", "==", clientId)
                .where("level", "==", "account")
                .limit(1)
                .get();

            if (!rollingSnap.empty) {
                const rolling = rollingSnap.docs[0].data();
                const kpis = SlackService.buildSnapshotFromRolling(rolling as any);

                const today = new Date().toISOString().split("T")[0];
                const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

                await SlackService.sendDailySnapshot(clientId, client.name, { start: weekAgo, end: today }, kpis);
                result.snapshotSent = true;
            } else {
                result.snapshotSent = false;
                result.snapshotError = "No rolling metrics found";
            }
        }

        // ── ALERTS ──
        if (mode === "digest" || mode === "critical" || mode === "all") {
            const alerts: Alert[] = await AlertEngine.run(clientId);

            if (mode === "critical" || mode === "all") {
                const criticals = alerts.filter((a: Alert) => a.severity === "CRITICAL");
                for (const alert of criticals) {
                    await SlackService.sendCriticalAlert(clientId, client.name, alert);
                }
                result.criticalAlertsSent = criticals.length;
            }

            if (mode === "digest" || mode === "all") {
                if (alerts.length > 0) {
                    await SlackService.sendDigest(clientId, client.name, alerts);
                    result.digestSent = true;
                } else {
                    result.digestSent = false;
                    result.digestNote = "No alerts generated";
                }
            }

            result.totalAlerts = alerts.length;
        }

        return NextResponse.json({ success: true, ...result });

    } catch (error: any) {
        console.error("[Slack Send Alert] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
});
