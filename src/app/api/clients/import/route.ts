import { auth, db } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";
import { Client } from "@/types";

/**
 * POST /api/clients/import - Batch create/update clients
 */
export async function POST(request: NextRequest) {
    try {
        const sessionCookie = request.cookies.get("session")?.value;
        if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await auth.verifySessionCookie(sessionCookie);

        const { clients } = await request.json();
        if (!Array.isArray(clients)) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        const batch = db.batch();
        const updatedAt = new Date().toISOString();

        for (const clientData of clients) {
            const { slug, name } = clientData;

            // Try to find existing by slug
            const existingSnapshot = await db.collection("clients")
                .where("slug", "==", slug)
                .limit(1)
                .get();

            if (!existingSnapshot.empty) {
                // Update
                batch.update(existingSnapshot.docs[0].ref, {
                    ...clientData,
                    updatedAt
                });
            } else {
                // Create
                const newDocRef = db.collection("clients").doc();
                batch.set(newDocRef, {
                    ...clientData,
                    createdAt: updatedAt,
                    updatedAt
                });
            }
        }

        await batch.commit();

        return NextResponse.json({ success: true, count: clients.length });
    } catch (error: any) {
        console.error("Import error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
