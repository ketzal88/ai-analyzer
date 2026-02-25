import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/firebase-admin";
import { selectCreativesForAudit } from "@/lib/creative-kpi-service";
import { CreativeSelectionResponse } from "@/types/creative-kpi";
import { reportError } from "@/lib/error-reporter";

/**
 * AG-42: Get active creatives with KPIs and intelligent selection
 * GET /api/creative/active?clientId=xxx&range=last_14d&limit=40
 * 
 * Returns top N creatives scored by:
 * - Spend/impressions (movers)
 * - Fatigue risk
 * - Underfunded opportunities
 * - Newness
 * 
 * With fingerprint-based deduplication
 */
export async function GET(request: NextRequest) {
    try {
        // 1. Auth check (bypass in development)
        const isDev = process.env.NODE_ENV === "development";
        const sessionCookie = request.cookies.get("session")?.value;

        if (!isDev) {
            if (!sessionCookie) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
            await auth.verifySessionCookie(sessionCookie);
        }


        // 2. Parse query params
        const { searchParams } = new URL(request.url);
        const clientId = searchParams.get("clientId");
        const range = searchParams.get("range") || "last_14d";
        const limit = parseInt(searchParams.get("limit") || "40");

        if (!clientId) {
            return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
        }

        // Validate range
        const validRanges = ["last_7d", "last_14d", "last_30d"];
        if (!validRanges.includes(range)) {
            return NextResponse.json({
                error: "Invalid range",
                validRanges
            }, { status: 400 });
        }

        // Validate limit
        if (limit < 1 || limit > 50) {
            return NextResponse.json({
                error: "Limit must be between 1 and 50"
            }, { status: 400 });
        }

        console.log(`[Creative Active] Selecting creatives for ${clientId}, range: ${range}, limit: ${limit}`);

        // 3. Run intelligent selection
        const startTime = Date.now();
        const selected = await selectCreativesForAudit(clientId, range, limit);
        const duration = Date.now() - startTime;

        // 4. Calculate metadata
        const totalEvaluated = selected.reduce((sum, c) => sum + (c.cluster?.size || 1), 0);
        const dedupedCount = totalEvaluated - selected.length;
        const lowSignalCount = selected.filter(c => c.reasons.includes("LOW_SIGNAL")).length;
        const avgScore = selected.reduce((sum, c) => sum + c.score, 0) / selected.length || 0;

        // 5. Determine cache hit (if duration < 100ms, likely from cache)
        const cacheHit = duration < 100;

        // 6. Build response
        const response: CreativeSelectionResponse = {
            clientId,
            range: {
                start: "", // Will be filled from snapshot
                end: ""
            },
            cacheHit,
            coverage: {
                daysRequested: range === "last_7d" ? 7 : range === "last_30d" ? 30 : 14,
                daysAvailable: 0 // Will be filled from snapshot
            },
            selected,
            skipped: {
                lowSignalCount,
                dedupedCount
            },
            meta: {
                totalCreativesEvaluated: totalEvaluated,
                avgScore,
                generatedAt: new Date().toISOString()
            }
        };

        console.log(`[Creative Active] Selected ${selected.length} creatives (${dedupedCount} deduped, ${lowSignalCount} low signal) in ${duration}ms`);

        return NextResponse.json(response);

    } catch (error: any) {
        const { searchParams } = new URL(request.url);
        await reportError("API Creative Active", error, {
            clientId: searchParams.get("clientId") || undefined
        });

        // Handle missing index error
        if (error.code === 9 || error.message?.toLowerCase().includes("index")) {
            return NextResponse.json({
                error: "Missing Firestore index",
                message: "Please create the required composite index for this query",
                details: error.message
            }, { status: 500 });
        }

        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
