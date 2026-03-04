import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

/**
 * GET /api/semaforo?clientId=xxx
 * Returns the current semáforo snapshot for a client.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");

    if (!clientId) {
        return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    }

    try {
        const doc = await db.collection("semaforo_snapshots").doc(clientId).get();

        if (!doc.exists) {
            return NextResponse.json({ snapshot: null, message: "No semáforo data" });
        }

        return NextResponse.json({ snapshot: doc.data() });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
