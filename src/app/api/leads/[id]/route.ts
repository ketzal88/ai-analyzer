/**
 * Lead Detail API — Update individual lead records
 *
 * PATCH /api/leads/:id — Update qualification fields
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const body = await request.json();
        const now = new Date().toISOString();

        // Only allow updating specific qualification fields
        const allowedFields = [
            "qualification",
            "qualityScore",
            "attendance",
            "postCallStatus",
            "revenue",
            "closerComments",
            "closerAssigned",
            "scheduledDate",
            "calendarType",
            "name",
            "email",
            "phone",
        ];

        const updates: Record<string, unknown> = { updatedAt: now };

        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updates[field] = body[field];
            }
        }

        // Set qualifiedAt when qualification changes from pending
        if (body.qualification && body.qualification !== "pending") {
            updates.qualifiedAt = now;
        }

        const docRef = db.collection("leads").doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return NextResponse.json({ error: "Lead not found" }, { status: 404 });
        }

        await docRef.update(updates);

        return NextResponse.json({ id, ...updates });
    } catch (error: unknown) {
        console.error("[Leads API] Error updating lead:", error);
        return NextResponse.json({ error: "Failed to update lead" }, { status: 500 });
    }
}
