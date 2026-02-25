import { NextRequest, NextResponse } from "next/server";
import { ConceptService } from "@/lib/concept-service";
import { withErrorReporting } from "@/lib/error-reporter";

export const GET = withErrorReporting("API Concepts", async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    const rangeStart = searchParams.get("rangeStart");
    const rangeEnd = searchParams.get("rangeEnd");

    if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 });

    const concepts = await ConceptService.listConcepts(clientId, {
        start: rangeStart || "",
        end: rangeEnd || ""
    });

    return NextResponse.json({ concepts });
});
