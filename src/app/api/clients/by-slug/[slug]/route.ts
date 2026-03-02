import { auth, db } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";
import { withErrorReporting } from "@/lib/error-reporter";

/**
 * GET /api/clients/by-slug/[slug] - Get a single client by its slug (Admin only)
 */
export const GET = withErrorReporting("API Client by Slug GET", async (
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) => {
    const sessionCookie = request.cookies.get("session")?.value;
    if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await auth.verifySessionCookie(sessionCookie);

    const { slug } = await params;

    const snapshot = await db
        .collection("clients")
        .where("slug", "==", slug)
        .limit(1)
        .get();

    if (snapshot.empty) {
        return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    const doc = snapshot.docs[0];
    const client = { id: doc.id, ...doc.data() };

    return NextResponse.json(client);
});
