import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { TiendaNubeService } from "@/lib/tiendanube-service";
import { ShopifyService } from "@/lib/shopify-service";
import { EventService } from "@/lib/event-service";
import { reportError } from "@/lib/error-reporter";
import { Client } from "@/types";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    try {
        console.log("[Cron Sync Ecommerce] Starting ecommerce sync...");

        const clientsSnap = await db.collection("clients")
            .where("active", "==", true)
            .get();

        const results: Array<{ clientId: string; clientName?: string; status: string; daysWritten?: number; totalOrders?: number; error?: string }> = [];

        for (const clientDoc of clientsSnap.docs) {
            const client = clientDoc.data() as Client;
            const clientId = clientDoc.id;

            if (!client.integraciones?.ecommerce) {
                results.push({ clientId, clientName: client.name, status: "skipped" });
                continue;
            }

            try {
                const endDate = new Date().toISOString().split("T")[0];
                const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

                if (client.integraciones.ecommerce === 'tiendanube') {
                    const storeId = client.tiendanubeStoreId;
                    const accessToken = client.tiendanubeAccessToken;
                    if (!storeId || !accessToken) {
                        results.push({ clientId, clientName: client.name, status: "skipped", error: "No tiendanubeStoreId or tiendanubeAccessToken configured" });
                        continue;
                    }
                    const { daysWritten, totalOrders, totalRevenue } = await TiendaNubeService.syncToChannelSnapshots(
                        clientId,
                        storeId,
                        accessToken,
                        startDate,
                        endDate
                    );
                    results.push({ clientId, clientName: client.name, status: "success", daysWritten, totalOrders });
                } else if (client.integraciones.ecommerce === 'shopify') {
                    const storeDomain = client.shopifyStoreDomain;
                    const accessToken = client.shopifyAccessToken;
                    if (!storeDomain || !accessToken) {
                        results.push({ clientId, clientName: client.name, status: "skipped", error: "No shopifyStoreDomain or shopifyAccessToken configured" });
                        continue;
                    }
                    const { daysWritten, totalOrders, totalRevenue } = await ShopifyService.syncToChannelSnapshots(
                        clientId,
                        storeDomain,
                        accessToken,
                        startDate,
                        endDate
                    );
                    results.push({ clientId, clientName: client.name, status: "success", daysWritten, totalOrders });
                } else {
                    results.push({ clientId, clientName: client.name, status: "skipped" });
                }
            } catch (e: any) {
                await reportError("Cron Sync Ecommerce (Client)", e, { clientId, clientName: client.name });
                results.push({ clientId, clientName: client.name, status: "failed", error: e.message });
            }
        }

        await EventService.logCronExecution({
            cronType: "sync-ecommerce",
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

        console.log("[Cron Sync Ecommerce] Completed.", results);
        return NextResponse.json({ success: true, results });

    } catch (error: any) {
        await reportError("Cron Sync Ecommerce (Fatal)", error);

        await EventService.logCronExecution({
            cronType: "sync-ecommerce",
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
