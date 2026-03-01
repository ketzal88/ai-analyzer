import { auth, db } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";

async function findClientBySlug(slug: string) {
    const snapshot = await db
        .collection("clients")
        .where("slug", "==", slug)
        .limit(1)
        .get();

    if (snapshot.empty) return null;
    return snapshot.docs[0];
}

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
        const doc = await findClientBySlug(slug);

        if (!doc) {
            return NextResponse.json({ error: "Client not found." }, { status: 404 });
        }

        const client = { id: doc.id, ...doc.data() };
        return NextResponse.json(client);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * PATCH /api/clients/by-slug/[slug] - Update a client by its slug (Admin only)
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const sessionCookie = request.cookies.get("session")?.value;
        if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await auth.verifySessionCookie(sessionCookie);

        const { slug } = await params;
        const doc = await findClientBySlug(slug);

        if (!doc) {
            return NextResponse.json({ error: "Client not found." }, { status: 404 });
        }

        const updates = await request.json();

        await doc.ref.update({
            ...updates,
            updatedAt: new Date().toISOString()
        });

        return NextResponse.json({ success: true, id: doc.id });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
