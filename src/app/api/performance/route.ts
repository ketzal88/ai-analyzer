import { db } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const clientId = searchParams.get("clientId");

        if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 });

        // Fetch Rolling Metrics
        const rollingSnap = await db.collection("entity_rolling_metrics")
            .where("clientId", "==", clientId)
            .get();
        const rolling = rollingSnap.docs.map(d => d.data());

        // Fetch Concept Metrics
        const conceptSnap = await db.collection("concept_rolling_metrics")
            .where("clientId", "==", clientId)
            .get();
        const concepts = conceptSnap.docs.map(d => d.data());

        // Fetch Recent Alerts
        const alertsSnap = await db.collection("alerts")
            .where("clientId", "==", clientId)
            .limit(50)
            .get();
        const alerts = alertsSnap.docs.map(d => d.data())
            .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        // Fetch Classifications
        const classSnap = await db.collection("entity_classifications")
            .where("clientId", "==", clientId)
            .get();
        const classifications = classSnap.docs.map(d => d.data());

        return NextResponse.json({
            rolling,
            concepts,
            alerts,
            classifications
        });

    } catch (error: any) {
        console.error("API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
