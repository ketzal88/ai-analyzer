import { db } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";
import { FinalDecision } from "@/types/classifications";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const clientId = "demo_golden_brand";

        const batch = db.batch();

        // 1. Create Mock Client
        const clientRef = db.collection("clients").doc(clientId);
        batch.set(clientRef, {
            id: clientId,
            name: "Golden Brand (AI Demo)",
            targetCpa: 45,
            primaryGoal: "ROAS",
            status: "active",
            active: true,
            ecommerceMode: true,
            createdAt: new Date().toISOString()
        });

        // 2. Mock Classes (for Dashboard)
        const mockAds = [
            { id: "ad_1_winning", concept: "Concepto_A", decision: "SCALE" as FinalDecision, spend: 500, cpa: 30, roas: 4.2 },
            { id: "ad_2_fatigued", concept: "Concepto_A", decision: "ROTATE_CONCEPT" as FinalDecision, spend: 800, cpa: 65, roas: 1.8 },
            { id: "ad_3_failed", concept: "Concepto_B", decision: "KILL_RETRY" as FinalDecision, spend: 120, cpa: 0, roas: 0 },
            { id: "ad_4_mofu", concept: "Concepto_C", decision: "INTRODUCE_BOFU_VARIANTS" as FinalDecision, spend: 300, cpa: 42, roas: 2.5 }
        ];

        for (const ad of mockAds) {
            // Classification
            const classRef = db.collection("entity_classifications").doc(`${clientId}__${ad.id}`);
            batch.set(classRef, {
                clientId,
                level: "ad",
                entityId: ad.id,
                conceptId: ad.concept,
                updatedAt: new Date().toISOString(),
                learningState: "EXPLOITATION",
                intentStage: ad.id.includes("mofu") ? "MOFU" : "BOFU",
                fatigueState: ad.decision === "ROTATE_CONCEPT" ? "REAL" : "NONE",
                structuralState: "HEALTHY",
                finalDecision: ad.decision,
                evidence: [`Spend: $${ad.spend}`, `CPA: $${ad.cpa}`, `ROAS: ${ad.roas}`],
                confidenceScore: 0.95,
                impactScore: ad.decision === "SCALE" ? 85 : ad.decision === "ROTATE_CONCEPT" ? 92 : 40
            });

            // Rolling Metrics
            const rollingRef = db.collection("entity_rolling_metrics").doc(`${clientId}__${ad.id}__ad`);
            batch.set(rollingRef, {
                clientId,
                entityId: ad.id,
                level: "ad",
                rolling: {
                    spend_7d: ad.spend,
                    spend_14d: ad.spend * 1.8,
                    cpa_7d: ad.cpa,
                    cpa_14d: ad.cpa * 0.9,
                    roas_7d: ad.roas,
                    frequency_7d: ad.decision === "ROTATE_CONCEPT" ? 4.5 : 2.1,
                    hook_rate_delta_pct: ad.decision === "ROTATE_CONCEPT" ? -25 : 5
                },
                lastUpdate: new Date().toISOString()
            });

            // Snapshots (needed for Context Pack / Briefs)
            const today = new Date().toISOString().split("T")[0];
            const snapId = `${clientId}__${today}__ad__${ad.id}`;
            const snapRef = db.collection("daily_entity_snapshots").doc(snapId);
            batch.set(snapRef, {
                clientId,
                date: today,
                level: "ad",
                entityId: ad.id,
                meta: { conceptId: ad.concept, formatType: "VIDEO" },
                performance: {
                    spend: ad.spend / 7,
                    impressions: 1000,
                    clicks: 20,
                    purchases: ad.cpa > 0 ? (ad.spend / 7) / ad.cpa : 0,
                    revenue: ad.roas > 0 ? (ad.spend / 7) * ad.roas : 0
                },
                engagement: { hookRate: 0.25 },
                audience: {},
                stability: { daysActive: 10, daysSinceLastEdit: 5 }
            });

            // Alerts
            if (ad.decision !== "HOLD") {
                const alertRef = db.collection("alerts").doc(`${ad.decision}_${ad.id}`);
                batch.set(alertRef, {
                    id: `${ad.decision}_${ad.id}`,
                    clientId,
                    level: "ad",
                    entityId: ad.id,
                    type: ad.decision,
                    severity: ad.decision === "ROTATE_CONCEPT" ? "CRITICAL" : "INFO",
                    title: `${ad.decision}: ${ad.id}`,
                    description: `Recomendación automática basada en performance de 7 días.`,
                    impactScore: ad.decision === "SCALE" ? 85 : 92,
                    evidence: [`Spend: $${ad.spend}`, `CPA: $${ad.cpa}`],
                    createdAt: new Date().toISOString()
                });
            }
        }

        // 3. Mock Concept Metrics
        const concepts = ["Concepto_A", "Concepto_B", "Concepto_C"];
        for (const cid of concepts) {
            const conceptRef = db.collection("concept_rolling_metrics").doc(`${clientId}__${cid}`);
            batch.set(conceptRef, {
                clientId,
                conceptId: cid,
                rolling: {
                    avg_cpa_7d: cid === "Concepto_A" ? 45 : 60,
                    avg_cpa_14d: 40,
                    hook_rate_delta: cid === "Concepto_A" ? -0.15 : 0.05,
                    spend_concentration_top1: 0.85,
                    frequency_7d: cid === "Concepto_A" ? 4.2 : 1.8,
                    fatigue_flag: cid === "Concepto_A"
                },
                lastUpdate: new Date().toISOString()
            });
        }

        // 4. Base Prompts
        const prompts = [
            { key: "recommendations_v1", system: "Eres un Director de Performance.", user: "Genera recomendación para: {{summary_json}}" },
            { key: "concept_briefs_v1", system: "Eres un Director Creativo.", user: "Genera brief para: {{summary_json}}" }
        ];

        for (const p of prompts) {
            const pRef = db.collection("prompt_templates").doc(`${p.key}_v1`);
            batch.set(pRef, {
                id: `${p.key}_v1`,
                key: p.key,
                version: 1,
                status: "active",
                system: p.system,
                userTemplate: p.user,
                variables: ["summary_json"],
                createdAt: new Date().toISOString()
            });
        }

        await batch.commit();

        return NextResponse.json({ success: true, clientId, message: "Mock data seeded. Select 'Golden Brand (AI Demo)' in the client selector." });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
