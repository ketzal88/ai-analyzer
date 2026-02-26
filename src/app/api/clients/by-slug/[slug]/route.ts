import { auth, db } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/clients/by-slug/[slug] - Get a single client by its slug (Admin only)
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
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
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
