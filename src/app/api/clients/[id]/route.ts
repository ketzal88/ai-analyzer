import { auth, db } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";
import { reportError } from "@/lib/error-reporter";

/**
 * PATCH /api/clients/[id] - Update client (e.g., toggle active, soft delete)
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const sessionCookie = request.cookies.get("session")?.value;
        if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await auth.verifySessionCookie(sessionCookie);

        const updates = await request.json();
        const docRef = db.collection("clients").doc(id);

        const doc = await docRef.get();
        if (!doc.exists) return NextResponse.json({ error: "Client not found" }, { status: 404 });

        await docRef.update({
            ...updates,
            updatedAt: new Date().toISOString()
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        await reportError("API Clients PATCH", error, { metadata: { id: (await params).id } });
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * DELETE /api/clients/[id] - Archive/Delete client
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
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
    } catch (error: any) {
        await reportError("API Clients DELETE", error, { metadata: { id: (await params).id } });
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
