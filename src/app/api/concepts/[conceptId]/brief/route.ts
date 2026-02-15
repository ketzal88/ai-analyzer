import { NextRequest, NextResponse } from "next/server";
import { ConceptBriefService } from "@/lib/concept-brief-service";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ conceptId: string }> }
) {
    const { conceptId } = await params;
    try {
        const { clientId, range } = await req.json();

        if (!clientId || !range) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const result = await ConceptBriefService.generate(clientId, conceptId, range);
        return NextResponse.json(result);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
