import { auth, db } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";
import { withErrorReporting } from "@/lib/error-reporter";

/**
 * GET /api/clients/[id] - Get single client
 */
export const GET = withErrorReporting("API Clients GET by ID", async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const { id } = await params;
    const sessionCookie = request.cookies.get("session")?.value;
    if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await auth.verifySessionCookie(sessionCookie);

    const doc = await db.collection("clients").doc(id).get();
    if (!doc.exists) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    return NextResponse.json({ client: { id: doc.id, ...doc.data() } });
});

/**
 * PATCH /api/clients/[id] - Update client (e.g., toggle active, soft delete)
 */
export const PATCH = withErrorReporting("API Clients PATCH", async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const { id } = await params;
    const sessionCookie = request.cookies.get("session")?.value;
    if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await auth.verifySessionCookie(sessionCookie);

    const updates = await request.json();
    const docRef = db.collection("clients").doc(id);

    const doc = await docRef.get();
    if (!doc.exists) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    const prev = doc.data() as any;

    await docRef.update({
        ...updates,
        updatedAt: new Date().toISOString()
    });

    // Detect newly enabled channels and enqueue previous-year backfill
    try {
        const { ChannelBackfillService } = await import("@/lib/channel-backfill-service");
        type BC = import("@/lib/channel-backfill-service").BackfillChannel;
        const channelsToBackfill: BC[] = [];

        const newInt = updates.integraciones || {};
        const prevInt = prev.integraciones || {};

        if (newInt.meta && !prevInt.meta && (updates.metaAdAccountId || prev.metaAdAccountId)) {
            channelsToBackfill.push("META");
        }
        if (newInt.google && !prevInt.google && (updates.googleAdsId || prev.googleAdsId)) {
            channelsToBackfill.push("GOOGLE");
        }
        if (newInt.ga4 && !prevInt.ga4 && (updates.ga4PropertyId || prev.ga4PropertyId)) {
            channelsToBackfill.push("GA4");
        }
        if (newInt.ecommerce && newInt.ecommerce !== prevInt.ecommerce) {
            channelsToBackfill.push("ECOMMERCE");
        }
        if (newInt.email && newInt.email !== prevInt.email) {
            channelsToBackfill.push("EMAIL");
        }

        if (channelsToBackfill.length > 0) {
            await ChannelBackfillService.enqueueBackfill(id, channelsToBackfill);
        }
    } catch (backfillErr) {
        console.error(`[Channel Backfill] Enqueue failed for ${id}:`, backfillErr);
    }

    return NextResponse.json({ success: true });
});

/**
 * DELETE /api/clients/[id] - Archive/Delete client
 */
export const DELETE = withErrorReporting("API Clients DELETE", async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const { id } = await params;
    const sessionCookie = request.cookies.get("session")?.value;
    if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await auth.verifySessionCookie(sessionCookie);

    // Soft delete/Archive
    await db.collection("clients").doc(id).update({
        archived: true,
        active: false,
        updatedAt: new Date().toISOString()
    });

    return NextResponse.json({ success: true });
});
