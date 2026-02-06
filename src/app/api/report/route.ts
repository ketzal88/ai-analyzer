import { auth, db } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";
import { generateGeminiReport } from "@/lib/gemini-service";

// Configuration from environment variables
const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-1.5-pro";


export async function POST(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const clientId = searchParams.get("clientId");

        if (!clientId) {
            return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
        }

        // 1. Auth check
        const sessionCookie = request.cookies.get("session")?.value;
        if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        await auth.verifySessionCookie(sessionCookie);

        // 2. Load client & findings
        const clientDoc = await db.collection("clients").doc(clientId).get();
        if (!clientDoc.exists) return NextResponse.json({ error: "Client not found" }, { status: 404 });
        const clientData = clientDoc.data()!;
        if (!clientData.active) return NextResponse.json({ error: "Client is inactive" }, { status: 403 });

        const findingsSnapshot = await db.collection("findings")
            .where("clientId", "==", clientId)
            .orderBy("createdAt", "desc")
            .limit(20)
            .get();

        const findings = findingsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                type: data.type,
                title: data.title,
                severity: data.severity,
                evidence: data.evidence
            };
        });

        // 3. Generate Report via Service (includes cache, rate limit, and token optimization)
        try {
            console.log("Delegating to generateGeminiReport service...");
            const fullReport = await generateGeminiReport(
                clientId,
                clientData,
                findings,
                "last_14d_wow" // Default period for direct report calls
            );

            return NextResponse.json(fullReport);
        } catch (error: any) {
            console.error("Gemini Service Error:", error);
            if (error.message?.includes("not available") || error.message?.includes("404")) {
                return NextResponse.json({
                    error: "LLM_UNAVAILABLE",
                    message: "Gemini model not available"
                }, { status: 503 });
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
    } catch (error: any) {
        console.error("Report Route Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
