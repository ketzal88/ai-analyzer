import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

/**
 * GET /api/objectives/[id] — Get a specific objective
 * PUT /api/objectives/[id] — Update a specific objective
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const doc = await db.collection("quarterly_objectives").doc(params.id).get();
        if (!doc.exists) {
            return NextResponse.json({ error: "Objective not found" }, { status: 404 });
        }
        return NextResponse.json({ id: doc.id, ...doc.data() });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const body = await request.json();
        const doc = await db.collection("quarterly_objectives").doc(params.id).get();
        if (!doc.exists) {
            return NextResponse.json({ error: "Objective not found" }, { status: 404 });
        }

        const updates = {
            ...body,
            updatedAt: new Date().toISOString(),
        };

        await db.collection("quarterly_objectives").doc(params.id).update(updates);
        return NextResponse.json({ success: true, id: params.id });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
