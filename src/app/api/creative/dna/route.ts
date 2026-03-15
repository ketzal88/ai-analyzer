import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { CreativeDNA, DiversityScore } from "@/types/creative-dna";

/**
 * GET /api/creative/dna?clientId=xxx
 * Returns all DNA records for a client plus diversity score.
 */
export async function GET(req: NextRequest) {
    const clientId = req.nextUrl.searchParams.get("clientId");
    if (!clientId) {
        return NextResponse.json({ error: "clientId required" }, { status: 400 });
    }

    try {
        const [dnaSnap, diversityDoc] = await Promise.all([
            db.collection("creative_dna")
                .where("clientId", "==", clientId)
                .orderBy("analyzedAt", "desc")
                .limit(100)
                .get(),
            db.collection("creative_diversity_scores").doc(clientId).get(),
        ]);

        const dnaRecords: CreativeDNA[] = dnaSnap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => d.data() as CreativeDNA);
        const diversityScore: DiversityScore | null = diversityDoc.exists
            ? (diversityDoc.data() as DiversityScore)
            : null;

        return NextResponse.json({ dnaRecords, diversityScore });
    } catch (err: any) {
        console.error("[creative/dna API]", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
