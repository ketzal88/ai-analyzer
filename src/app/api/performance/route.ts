import { db } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";
import { ClientSnapshot, ClientSnapshotAds } from "@/types/client-snapshot";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const clientId = searchParams.get("clientId");
        const date = searchParams.get("date"); // YYYY-MM-DD

        if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 });

        const mainId = date ? `${clientId}_${date}` : clientId;
        const adsId = date ? `${clientId}_${date}` : clientId;

        // 2 parallel doc reads instead of 4 collection scans (~700 docs → 2 docs)
        const [snapshotDoc, adsDoc] = await Promise.all([
            db.collection("client_snapshots").doc(mainId).get(),
            db.collection("client_snapshots_ads").doc(adsId).get()
        ]);

        if (!snapshotDoc.exists) {
            return NextResponse.json({
                error: date ? `No snapshot found for date ${date}` : "No snapshot found. Run data-sync first."
            }, { status: 404 });
        }

        const snapshot = snapshotDoc.data() as ClientSnapshot;
        const adsSnapshot = adsDoc.exists ? adsDoc.data() as ClientSnapshotAds : { ads: [], classifications: [] };

        // Transform to the existing frontend contract
        const allEntities = [
            ...snapshot.entities.account,
            ...snapshot.entities.campaign,
            ...snapshot.entities.adset,
            ...adsSnapshot.ads
        ];

        const rolling = allEntities.map(e => ({
            clientId,
            entityId: e.entityId,
            level: e.level,
            name: e.name,
            rolling: e.rolling,
            lastUpdate: snapshot.computedDate
        }));

        const concepts = snapshot.concepts.map(c => ({
            clientId,
            conceptId: c.conceptId,
            rolling: c.rolling,
            lastUpdate: snapshot.computedDate
        }));

        const classifications = [
            ...snapshot.classifications,
            ...adsSnapshot.classifications
        ].map(c => ({
            clientId,
            ...c,
            updatedAt: snapshot.computedDate
        }));

        return NextResponse.json({
            rolling,
            concepts,
            alerts: snapshot.alerts,
            classifications
        });

    } catch (error: any) {
        console.error("API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
