import { auth, db } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/clients/by-slug/[slug] - Fetch client by slug
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { slug: string } }
) {
    try {
        const { slug } = params;
        const sessionCookie = request.cookies.get("session")?.value;
        if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await auth.verifySessionCookie(sessionCookie);

        const snapshot = await db.collection("clients")
            .where("slug", "==", slug)
            .limit(1)
            .get();

        if (snapshot.empty) {
            return NextResponse.json({ error: "Client not found" }, { status: 404 });
        }

        const doc = snapshot.docs[0];
        return NextResponse.json({ id: doc.id, ...doc.data() });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * PATCH /api/clients/by-slug/[slug] - Update client by slug
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: { slug: string } }
) {
    try {
        const { slug } = params;
        const sessionCookie = request.cookies.get("session")?.value;
        if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await auth.verifySessionCookie(sessionCookie);

        const updates = await request.json();

        const snapshot = await db.collection("clients")
            .where("slug", "==", slug)
            .limit(1)
            .get();

        if (snapshot.empty) {
            return NextResponse.json({ error: "Client not found" }, { status: 404 });
        }

        const docRef = snapshot.docs[0].ref;
        await docRef.update({
            ...updates,
            updatedAt: new Date().toISOString()
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
