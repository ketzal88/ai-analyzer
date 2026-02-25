import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { withErrorReporting } from "@/lib/error-reporter";

export const GET = withErrorReporting("API Recommendations Detail", async (req: NextRequest) => {
    try {
        const { searchParams } = new URL(req.url);
        const clientId = searchParams.get("clientId");
        const level = searchParams.get("level");
        const entityId = searchParams.get("entityId");
        const rangeStart = searchParams.get("rangeStart");
        const rangeEnd = searchParams.get("rangeEnd");

        if (!clientId || !level || !entityId || !rangeStart || !rangeEnd) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const promptKey = "recommendations_v1";
        const rangeStr = `${rangeStart}_${rangeEnd}`;
        const docId = `${clientId}__${rangeStr}__${promptKey}__${entityId}`;

        const doc = await db.collection("ai_recommendations").doc(docId).get();

        if (!doc.exists) {
            return NextResponse.json({ status: "not_found" });
        }

        return NextResponse.json({ status: "success", recommendation: doc.data() });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
});
