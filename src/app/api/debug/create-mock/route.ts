import { auth, db } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const sessionCookie = request.cookies.get("session")?.value;
        if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const decodedToken = await auth.verifySessionCookie(sessionCookie);
        const uid = decodedToken.uid;

        // 1. Create the Mock Client
        const mockClient = {
            name: "Cliente de Prueba (Mock)",
            slug: "prueba-mock",
            metaAdAccountId: "act_123456789",
            active: true,
            isEcommerce: true,
            ownerUid: uid,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const clientRef = await db.collection("clients").add(mockClient);
        const clientId = clientRef.id;

        // 2. Generate 14 days of Mock Insights
        const batch = db.batch();
        const baseDate = new Date();

        for (let i = 0; i < 14; i++) {
            const date = new Date();
            date.setDate(baseDate.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            // Campaign A: Consistent performance
            const insightA = {
                clientId,
                campaignId: "camp_A123",
                campaignName: "Prospecting - Purchase Goal",
                date: dateStr,
                spend: 100 + Math.random() * 20,
                impressions: 5000 + Math.random() * 500,
                clicks: 150 + Math.random() * 30,
                purchases: 5 + Math.floor(Math.random() * 3),
                purchaseValue: 250 + Math.random() * 100,
                updatedAt: new Date().toISOString()
            };

            // Campaign B: High spend, low conversion (Anomaly)
            const insightB = {
                clientId,
                campaignId: "camp_B456",
                campaignName: "Retargeting - Catalog Sales",
                date: dateStr,
                spend: 200 + Math.random() * 50,
                impressions: 3000 + Math.random() * 200,
                clicks: 80 + Math.random() * 20,
                purchases: i < 7 ? 0 : 4, // Drop in last 7 days
                purchaseValue: i < 7 ? 0 : 200,
                updatedAt: new Date().toISOString()
            };

            const refA = db.collection("insights_daily").doc(`${clientId}_campA_${dateStr}`);
            const refB = db.collection("insights_daily").doc(`${clientId}_campB_${dateStr}`);

            batch.set(refA, insightA);
            batch.set(refB, insightB);
        }

        await batch.commit();

        return NextResponse.json({
            success: true,
            clientId,
            message: "Mock client and data created successfully. You can now select 'Cliente de Prueba (Mock)' in the dashboard."
        });

    } catch (error: any) {
        console.error("Mock Data Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
