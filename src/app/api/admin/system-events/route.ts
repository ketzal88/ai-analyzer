import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/firebase-admin";
import { EventService } from "@/lib/event-service";

export async function GET(request: NextRequest) {
    const sessionCookie = request.cookies.get("session")?.value;
    if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        await auth.verifySessionCookie(sessionCookie);
    } catch {
        return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const severity = searchParams.get("severity") || undefined;
        const service = searchParams.get("service") || undefined;
        const limit = parseInt(searchParams.get("limit") || "50", 10);

        const events = await EventService.getRecentEvents({
            limit,
            severity: severity as any,
            service,
        });

        return NextResponse.json(events);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
