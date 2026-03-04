import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { QuarterlyObjective, buildObjectiveId } from "@/types/semaforo";

/**
 * GET /api/objectives?clientId=xxx
 * POST /api/objectives — Create a new quarterly objective
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");

    if (!clientId) {
        return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    }

    try {
        const snap = await db.collection("quarterly_objectives")
            .where("clientId", "==", clientId)
            .orderBy("endDate", "desc")
            .limit(10)
            .get();

        const objectives = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return NextResponse.json({ objectives });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { clientId, quarter, year, quarterNumber, startDate, endDate, goals, channelGoals, weeklyPacing } = body;

        if (!clientId || !quarter || !goals) {
            return NextResponse.json({ error: "clientId, quarter, and goals are required" }, { status: 400 });
        }

        const docId = buildObjectiveId(clientId, quarter);
        const objective: QuarterlyObjective = {
            clientId,
            quarter,
            year: year || new Date().getFullYear(),
            quarterNumber: quarterNumber || 1,
            startDate,
            endDate,
            goals,
            channelGoals: channelGoals || undefined,
            weeklyPacing: weeklyPacing || { mode: 'linear' },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        await db.collection("quarterly_objectives").doc(docId).set(objective);

        return NextResponse.json({ success: true, id: docId, objective });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
