import { NextRequest, NextResponse } from "next/server";
import { auth, db } from "@/lib/firebase-admin";
import { MetaCreativeDoc, CreativeLibraryFilters } from "@/types/meta-creative";
import { withErrorReporting } from "@/lib/error-reporter";

/**
 * AG-41: Get creative library for a client
 * GET /api/creative/library?clientId=xxx&campaignId=xxx&format=VIDEO&status=ACTIVE&activeSince=2026-01-01
 */
export const GET = withErrorReporting("API Creative Library", async (request: NextRequest) => {
    try {
        // 1. Auth check
        const sessionCookie = request.cookies.get("session")?.value;
        if (!sessionCookie) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        await auth.verifySessionCookie(sessionCookie);

        // 2. Parse query params
        const { searchParams } = new URL(request.url);
        const clientId = searchParams.get("clientId");
        const campaignId = searchParams.get("campaignId");
        const format = searchParams.get("format");
        const status = searchParams.get("status");
        const activeSince = searchParams.get("activeSince");
        const limit = parseInt(searchParams.get("limit") || "100");

        if (!clientId) {
            return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
        }

        // 3. Build query
        let query: any = db.collection("meta_creatives")
            .where("clientId", "==", clientId);

        if (campaignId) {
            query = query.where("campaign.id", "==", campaignId);
        }

        if (format) {
            query = query.where("creative.format", "==", format);
        }

        if (status) {
            query = query.where("status", "==", status);
        }

        // Default: only show creatives active in last 14 days
        const defaultActiveSince = new Date();
        defaultActiveSince.setDate(defaultActiveSince.getDate() - 14);
        const activeSinceDate = activeSince || defaultActiveSince.toISOString();

        query = query
            .where("lastSeenActiveAt", ">=", activeSinceDate)
            .orderBy("lastSeenActiveAt", "desc")
            .limit(limit);

        // 4. Execute query
        const snapshot = await query.get();
        const creatives: MetaCreativeDoc[] = snapshot.docs.map((doc: any) => ({
            ...doc.data(),
            id: doc.id
        } as MetaCreativeDoc));

        // 5. Return results
        return NextResponse.json({
            creatives,
            count: creatives.length,
            filters: {
                clientId,
                campaignId,
                format,
                status,
                activeSince: activeSinceDate
            }
        });

    } catch (error: any) {
        console.error("Creative library error:", error);

        // Handle missing index error
        if (error.code === 9 || error.message?.toLowerCase().includes("index")) {
            return NextResponse.json({
                error: "Missing Firestore index",
                message: "Please create the required composite index for this query",
                indexUrl: error.message
            }, { status: 500 });
        }

        return NextResponse.json({ error: error.message }, { status: 500 });
    }
});
