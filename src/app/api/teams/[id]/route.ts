import { auth, db } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";
import { withErrorReporting } from "@/lib/error-reporter";

/**
 * PATCH /api/teams/[id] - Update team name
 */
export const PATCH = withErrorReporting("API Teams PATCH", async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const { id } = await params;
    const sessionCookie = request.cookies.get("session")?.value;
    if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await auth.verifySessionCookie(sessionCookie);

    const { name } = await request.json();
    if (!name || !name.trim()) {
        return NextResponse.json({ error: "Team name is required" }, { status: 400 });
    }

    const docRef = db.collection("teams").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return NextResponse.json({ error: "Team not found" }, { status: 404 });

    // Check uniqueness (excluding current)
    const existing = await db.collection("teams").where("name", "==", name.trim()).limit(1).get();
    if (!existing.empty && existing.docs[0].id !== id) {
        return NextResponse.json({ error: "A team with this name already exists" }, { status: 400 });
    }

    await docRef.update({ name: name.trim() });
    return NextResponse.json({ success: true });
});

/**
 * DELETE /api/teams/[id] - Delete team and unassign from clients
 */
export const DELETE = withErrorReporting("API Teams DELETE", async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const { id } = await params;
    const sessionCookie = request.cookies.get("session")?.value;
    if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await auth.verifySessionCookie(sessionCookie);

    const docRef = db.collection("teams").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return NextResponse.json({ error: "Team not found" }, { status: 404 });

    // Unassign team from all clients that reference it
    const clientsWithTeam = await db.collection("clients").where("team", "==", id).get();
    const batch = db.batch();
    clientsWithTeam.docs.forEach(clientDoc => {
        batch.update(clientDoc.ref, { team: null, updatedAt: new Date().toISOString() });
    });
    batch.delete(docRef);
    await batch.commit();

    return NextResponse.json({ success: true });
});
