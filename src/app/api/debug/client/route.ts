import { db } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const clientId = searchParams.get("clientId");

        if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 });

        // 1. Check snapshots
        const snapshots = await db.collection("daily_entity_snapshots")
            .where("clientId", "==", clientId)
            .orderBy("date", "desc")
            .limit(10)
            .get();

        const snapshotSummary = snapshots.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                date: data.date,
                level: data.level,
                entityId: data.entityId,
                name: data.name,
                spend: data.performance?.spend
            };
        });

        // 2. Check computed snapshots
        const [mainDoc, adsDoc] = await Promise.all([
            db.collection("client_snapshots").doc(clientId).get(),
            db.collection("client_snapshots_ads").doc(clientId).get()
        ]);

        return NextResponse.json({
            clientId,
            snapshotCount: snapshots.size,
            latestSnapshots: snapshotSummary,
            computedSnapshot: {
                exists: mainDoc.exists,
                date: mainDoc.data()?.computedDate,
                entityCounts: mainDoc.data()?.meta?.entityCounts
            },
            computedAdsSnapshot: {
                exists: adsDoc.exists,
                date: adsDoc.data()?.computedDate,
                adCount: adsDoc.data()?.meta?.adCount
            }
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
