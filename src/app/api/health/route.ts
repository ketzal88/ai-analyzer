import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

/**
 * GET /api/health
 *
 * Public health check endpoint for uptime monitoring.
 * Verifies Firebase connectivity and required env vars.
 */
export async function GET() {
    const checks: Record<string, "ok" | "fail"> = {};

    // Check Firebase connectivity
    try {
        await db.collection("clients").limit(1).get();
        checks.firestore = "ok";
    } catch {
        checks.firestore = "fail";
    }

    // Check required env vars
    checks.envMetaToken = process.env.META_ACCESS_TOKEN ? "ok" : "fail";
    checks.envCronSecret = process.env.CRON_SECRET ? "ok" : "fail";
    checks.envGemini = process.env.GEMINI_API_KEY ? "ok" : "fail";

    const allOk = Object.values(checks).every(v => v === "ok");

    return NextResponse.json({
        status: allOk ? "ok" : "degraded",
        timestamp: new Date().toISOString(),
        checks,
    }, { status: allOk ? 200 : 503 });
}
