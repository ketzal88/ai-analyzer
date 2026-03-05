import { auth, db } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";
import { withErrorReporting } from "@/lib/error-reporter";

/**
 * GET /api/teams - List all teams
 */
export const GET = withErrorReporting("API Teams GET", async (request: NextRequest) => {
    const sessionCookie = request.cookies.get("session")?.value;
    if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await auth.verifySessionCookie(sessionCookie);

    const snapshot = await db.collection("teams").orderBy("name").get();
    const teams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json(teams);
});

/**
 * POST /api/teams - Create a new team
 */
export const POST = withErrorReporting("API Teams POST", async (request: NextRequest) => {
    const sessionCookie = request.cookies.get("session")?.value;
    if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await auth.verifySessionCookie(sessionCookie);

    const { name } = await request.json();
    if (!name || !name.trim()) {
        return NextResponse.json({ error: "Team name is required" }, { status: 400 });
    }

    // Check uniqueness
    const existing = await db.collection("teams").where("name", "==", name.trim()).limit(1).get();
    if (!existing.empty) {
        return NextResponse.json({ error: "A team with this name already exists" }, { status: 400 });
    }

    const newTeam = {
        name: name.trim(),
        createdAt: new Date().toISOString(),
    };

    const docRef = await db.collection("teams").add(newTeam);
    return NextResponse.json({ id: docRef.id, ...newTeam });
});
