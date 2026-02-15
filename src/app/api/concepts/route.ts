import { NextRequest, NextResponse } from "next/server";
import { ConceptService } from "@/lib/concept-service";

export async function GET(req: NextRequest) {
    try {
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
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
