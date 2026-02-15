import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { EngineConfigService } from "@/lib/engine-config-service";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: clientId } = await params;
        if (!clientId) {
            return NextResponse.json({ error: "Client ID is required" }, { status: 400 });
        }

        const config = await EngineConfigService.getEngineConfig(clientId);
        return NextResponse.json(config);
    } catch (error: any) {
        console.error("Error fetching engine config:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: clientId } = await params;
        if (!clientId) {
            return NextResponse.json({ error: "Client ID is required" }, { status: 400 });
        }

        const body = await request.json();

        // Save to Firestore
        await db.collection("engine_configs").doc(clientId).set({
            ...body,
            clientId,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error updating engine config:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
