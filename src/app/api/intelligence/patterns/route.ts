import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { CreativePatternService } from "@/lib/creative-pattern-service";
import { CreativeClassifier } from "@/lib/creative-classifier";
import { ClientSnapshot, ClientSnapshotAds } from "@/types/client-snapshot";

export async function GET(req: NextRequest) {
    const clientId = req.nextUrl.searchParams.get("clientId");
    if (!clientId) {
        return NextResponse.json({ error: "clientId required" }, { status: 400 });
    }

    try {
        // Fetch client snapshot + ads snapshot in parallel
        const [snapDoc, adsDoc] = await Promise.all([
            db.collection("client_snapshots").doc(clientId).get(),
            db.collection("client_snapshots_ads").doc(clientId).get(),
        ]);

        if (!snapDoc.exists) {
            return NextResponse.json({ error: "No snapshot found for this client" }, { status: 404 });
        }

        const snapshot = snapDoc.data() as ClientSnapshot;
        const adsData = adsDoc.exists ? (adsDoc.data() as ClientSnapshotAds) : null;

        // Combine all entity data
        const allAds = adsData?.ads || [];
        const allClassifications = [
            ...snapshot.classifications,
            ...(adsData?.classifications || []),
        ];

        // Run creative classifier to get categories
        const accountSpend7d = snapshot.accountSummary?.rolling?.spend_7d || 0;
        const categories = CreativeClassifier.classifyAll(
            allAds,
            allClassifications,
            accountSpend7d,
        );

        // Extract patterns from winners
        const patterns = CreativePatternService.extractPatterns(
            allAds,
            allClassifications,
            categories,
            accountSpend7d,
        );

        // Also include category distribution for the UI
        const categoryDistribution: Record<string, number> = {};
        for (const cat of categories) {
            categoryDistribution[cat.category] = (categoryDistribution[cat.category] || 0) + 1;
        }

        return NextResponse.json({
            patterns,
            categoryDistribution,
            totalAds: allAds.length,
            computedDate: snapshot.computedDate,
        });
    } catch (err: any) {
        console.error("[patterns API]", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
