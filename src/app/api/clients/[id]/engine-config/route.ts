import { auth } from "@/lib/firebase-admin";
import { EngineConfigService } from "@/lib/engine-config-service";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const sessionCookie = request.cookies.get("session")?.value;
        if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await auth.verifySessionCookie(sessionCookie);

        const config = await EngineConfigService.getEngineConfig(id);
        return NextResponse.json(config);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

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
        await EngineConfigService.saveEngineConfig(id, updates);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
