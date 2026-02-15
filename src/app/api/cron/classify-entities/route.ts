import { NextRequest, NextResponse } from "next/server";
import { ClassificationService } from "@/lib/classification-service";
import { reportError } from "@/lib/error-reporter";

export async function POST(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const clientId = searchParams.get("clientId");
        const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
        const secret = request.headers.get("x-cron-secret");

        // Basic security check
        if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!clientId) {
            return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
        }

        const processedCount = await ClassificationService.classifyEntitiesForClient(clientId, date);

        return NextResponse.json({
            success: true,
            processedCount,
            date
        });

    } catch (error: any) {
        reportError("Cron Classification", error, { metadata: { clientId: new URL(request.url).searchParams.get('clientId') } });
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
