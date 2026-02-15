import { NextRequest, NextResponse } from "next/server";
import { RecommendationService } from "@/lib/recommendation-service";

export async function POST(req: NextRequest) {
    try {
        const { clientId, range, level, entityId } = await req.json();

        if (!clientId || !range || !level || !entityId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const result = await RecommendationService.generate(clientId, range, level, entityId);

        return NextResponse.json(result);
    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
