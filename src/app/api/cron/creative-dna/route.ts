import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { Client } from "@/types";
import { CreativeDNAService } from "@/lib/creative-dna-service";
import { EventService } from "@/lib/event-service";
import { reportError } from "@/lib/error-reporter";

/**
 * Creative DNA Cron
 *
 * Analyzes new creatives using Gemini Vision to extract:
 * - Visual style (UGC, polished, meme, etc.)
 * - Hook type (question, shock, offer, etc.)
 * - Copy analysis (message type, CTA type)
 * - Estimated Entity Group for diversity scoring
 *
 * Runs daily after sync-creatives.
 * Only analyzes creatives that haven't been analyzed yet (by fingerprint).
 *
 * Auth: Bearer token via CRON_SECRET
 */
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    try {
        const clientsSnap = await db.collection("clients")
            .where("active", "==", true)
            .get();

        const results: Array<{
            clientId: string;
            clientName: string;
            analyzed: number;
            error?: string;
        }> = [];

        for (const clientDoc of clientsSnap.docs) {
            const client = clientDoc.data() as Client;
            const clientId = clientDoc.id;

            try {
                const analyzed = await CreativeDNAService.analyzeNewCreatives(clientId);
                results.push({ clientId, clientName: client.name, analyzed });
                console.log(`[CreativeDNA] ${client.name}: ${analyzed} creatives analyzed`);
            } catch (clientError: any) {
                reportError("Cron Creative DNA", clientError, { clientId, clientName: client.name });
                results.push({ clientId, clientName: client.name, analyzed: 0, error: clientError.message });
            }
        }

        await EventService.logCronExecution({
            cronType: "creative-dna",
            startedAt,
            completedAt: new Date().toISOString(),
            durationMs: Date.now() - startMs,
            summary: {
                total: results.length,
                success: results.filter(r => !r.error).length,
                failed: results.filter(r => r.error).length,
                skipped: results.filter(r => r.analyzed === 0 && !r.error).length,
            },
            results: results.map(r => ({
                clientId: r.clientId,
                clientName: r.clientName,
                status: r.error ? "failed" : "success",
                error: r.error,
            })),
            triggeredBy: request.headers.get("x-triggered-by") === "manual" ? "manual" : "schedule",
        });

        const totalAnalyzed = results.reduce((sum, r) => sum + r.analyzed, 0);

        return NextResponse.json({
            success: true,
            processed: results.length,
            totalAnalyzed,
            details: results
        });
    } catch (error: any) {
        reportError("Cron Creative DNA (Fatal)", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
