import { NextRequest, NextResponse } from "next/server";
import { ConceptService } from "@/lib/concept-service";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ conceptId: string }> }
) {
    const { conceptId } = await params;
    try {
        const { searchParams } = new URL(req.url);
        const clientId = searchParams.get("clientId");
        const rangeStart = searchParams.get("rangeStart");
        const rangeEnd = searchParams.get("rangeEnd");

        if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 });

        const detail = await ConceptService.getConceptDetail(clientId, conceptId, {
            start: rangeStart || "",
            end: rangeEnd || ""
        });

        return NextResponse.json(detail);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
