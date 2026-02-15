import { auth, db } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: accountId } = await params;
        const sessionCookie = request.cookies.get("session")?.value;
        if (!sessionCookie) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const decodedToken = await auth.verifySessionCookie(sessionCookie);
        const uid = decodedToken.uid;

        const body = await request.json();
        const { name, metaAdAccountId, targetCpa, goal } = body;

        // Verify ownership
        const docRef = db.collection("accounts").doc(accountId);
        const doc = await docRef.get();

        if (!doc.exists) {
            return NextResponse.json({ error: "Account not found" }, { status: 404 });
        }

        if (doc.data()?.ownerUid !== uid) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Update fields
        const updates: any = {
            updatedAt: new Date().toISOString()
        };

        if (name) updates.name = name;
        if (metaAdAccountId) updates.metaAdAccountId = metaAdAccountId;
        if (targetCpa !== undefined) updates.targetCpa = Number(targetCpa);
        if (goal) updates.goal = goal;

        await docRef.update(updates);

        return NextResponse.json({ success: true, id: accountId, ...updates });
    } catch (error: any) {
        console.error("Error updating account:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
