import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/firebase-admin";
import { AccountHealthService } from "@/lib/account-health-service";

export async function GET(request: NextRequest) {
    const sessionCookie = request.cookies.get("session")?.value;
    if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        await auth.verifySessionCookie(sessionCookie);
    } catch {
        return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    try {
        const healthRecords = await AccountHealthService.getAll();
        return NextResponse.json(healthRecords);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
