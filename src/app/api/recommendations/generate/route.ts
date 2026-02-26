import { NextRequest, NextResponse } from "next/server";
import { RecommendationService } from "@/lib/recommendation-service";
import { withErrorReporting } from "@/lib/error-reporter";

export const POST = withErrorReporting("API Recommendations Generate", async (req: NextRequest) => {
    const { clientId, range, level, entityId } = await req.json();

    if (!clientId || !range || !level || !entityId) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const result = await RecommendationService.generate(clientId, range, level, entityId);

    return NextResponse.json(result);
});
