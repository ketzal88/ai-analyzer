import { auth, db } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";
import { withErrorReporting } from "@/lib/error-reporter";

/**
 * GET /api/clients - List all clients (Admin only)
 */
export const GET = withErrorReporting("API Clients GET", async (request: NextRequest) => {
    const sessionCookie = request.cookies.get("session")?.value;
    if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    // TODO: In a real app, check if user has admin role
    const uid = decodedToken.uid;

    const snapshot = await db.collection("clients")
        .orderBy("createdAt", "desc")
        .get();

    const clients = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    return NextResponse.json(clients);
});

/**
 * POST /api/clients - Create a new client (Admin only)
 */
export const POST = withErrorReporting("API Clients POST", async (request: NextRequest) => {
    const sessionCookie = request.cookies.get("session")?.value;
    if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await auth.verifySessionCookie(sessionCookie);

    const body = await request.json();
    const { name, slug } = body;

    if (!name || !slug) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check for existing slug
    const existing = await db.collection("clients").where("slug", "==", slug).limit(1).get();
    if (!existing.empty) {
        return NextResponse.json({ error: "A client with this slug already exists." }, { status: 400 });
    }

    const newClient = {
        ...body,
        active: body.active ?? true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    const docRef = await db.collection("clients").add(newClient);

    // 🚀 Trigger automatic backfill for the last 60 days
    try {
        const { BackfillService } = await import("@/lib/backfill-service");
        await BackfillService.enqueueClient(docRef.id, 60);
    } catch (backfillErr) {
        console.error(`[Backfill] Failed to enqueue for new client ${docRef.id}:`, backfillErr);
    }

    return NextResponse.json({ id: docRef.id, ...newClient });
});
