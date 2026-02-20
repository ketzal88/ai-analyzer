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
        const limit = parseInt(searchParams.get("limit") || "30", 10);

        const executions = await EventService.getRecentCronExecutions(limit);

        return NextResponse.json(executions);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
