import { db } from "@/lib/firebase-admin";
import { reportError } from "@/lib/error-reporter";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createHash } from "crypto";
import { RecommendationDoc, RecommendationResponse } from "@/types/ai-recommendations";
import { EntityClassification } from "@/types/classifications";
import { EntityRollingMetrics, DailyEntitySnapshot, ConceptRollingMetrics } from "@/types/performance-snapshots";
import { Client } from "@/types";
import { ClientSnapshot, ClientSnapshotAds } from "@/types/client-snapshot";
import { buildSystemPrompt } from "@/lib/prompt-utils";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

export class RecommendationService {

    static async generate(
        clientId: string,
        range: { start: string; end: string },
        level: 'account' | 'campaign' | 'adset' | 'ad',
        entityId: string
    ): Promise<RecommendationResponse> {

        // 1. Build Context Pack
        const contextPack = await this.buildEntityContextPack(clientId, range, level, entityId);
        if (!contextPack || !contextPack.classification) {
            return { status: 'insufficient_evidence', message: 'No classification data found for this entity/range.' };
        }

        // 2. Cache Check (ID: clientId__rangeStart_rangeEnd__promptKey__entityId)
        const promptKey = "recommendations_v1";
        const rangeStr = `${range.start}_${range.end}`;
        const docId = `${clientId}__${rangeStr}__${promptKey}__${entityId}`;

        const cachedDoc = await db.collection("ai_recommendations").doc(docId).get();
        if (cachedDoc.exists) {
            return {
                status: 'cached',
                recommendation: cachedDoc.data() as RecommendationDoc
            };
        }

        // 3. Fetch Prompt
        const activePromptSnapshot = await db.collection("prompt_templates")
            .where("key", "==", promptKey)
            .where("status", "==", "active")
            .limit(1)
            .get();

        let baseSystemPrompt = "Eres un estratega senior de Performance Marketing experto en el método GEM (Growth, Efficiency, Maintenance).";
        let userTemplate = "Basado en los siguientes datos de la entidad, genera un playbook de acción concreto:\n\n{{summary_json}}";
        let promptVersion = "v1-default";
        let dbCriticalInstructions: string | undefined;

        if (!activePromptSnapshot.empty) {
            const template = activePromptSnapshot.docs[0].data();
            baseSystemPrompt = template.system;
            userTemplate = template.userTemplate;
            promptVersion = `${template.version}`;
            dbCriticalInstructions = template.criticalInstructions;
        }

        // Build final system prompt: base + critical instructions (from DB or default)
        const systemPrompt = buildSystemPrompt(baseSystemPrompt, dbCriticalInstructions, promptKey);

        // 4. Generate with Gemini
        try {
            if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");

            const model = genAI.getGenerativeModel({ model: MODEL, systemInstruction: systemPrompt });
            const prompt = userTemplate.replace("{{summary_json}}", JSON.stringify(contextPack));

            const result = await model.generateContent(prompt);
            const text = result.response.text();
            const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
            const parsed = JSON.parse(jsonStr);

            if (parsed.status === "insufficient_evidence") {
                return { status: 'insufficient_evidence', message: 'Gemini determined evidence is insufficient.' };
            }

            // 5. Persist
            const recommendation: RecommendationDoc = {
                id: docId,
                clientId,
                range,
                rangeHash: createHash("sha256").update(rangeStr).digest("hex"),
                level,
                entityId,
                decision: parsed.decision,
                evidence: parsed.evidence,
                actions: parsed.actions,
                experiments: parsed.experiments,
                creativeBrief: parsed.creativeBrief,
                confidence: parsed.confidence,
                impactScore: parsed.impactScore,
                promptVersionId: promptVersion,
                createdAt: new Date().toISOString()
            };

            await db.collection("ai_recommendations").doc(docId).set(recommendation);

            return { status: 'generated', recommendation };
        } catch (e: any) {
            reportError("LLM Recommendations", e, { clientId, metadata: { entityId, level } });
            return { status: 'error', message: e.message };
        }
    }

    private static async buildEntityContextPack(
        clientId: string,
        range: { start: string; end: string },
        level: string,
        entityId: string
    ) {
        // Read from pre-computed snapshot + client doc (2 reads instead of 4+ queries)
        const [snapshotDoc, adsDoc, clientSnap] = await Promise.all([
            db.collection("client_snapshots").doc(clientId).get(),
            db.collection("client_snapshots_ads").doc(clientId).get(),
            db.collection("clients").doc(clientId).get()
        ]);

        if (!snapshotDoc.exists) return null;

        const snapshot = snapshotDoc.data() as ClientSnapshot;
        const adsSnapshot = adsDoc.exists ? adsDoc.data() as ClientSnapshotAds : null;
        const client = clientSnap.exists ? clientSnap.data() as Client : null;

        // Find classification for this entity
        const allClassifications = [
            ...snapshot.classifications,
            ...(adsSnapshot?.classifications || [])
        ];
        const classification = allClassifications.find(c => c.entityId === entityId && c.level === level);

        if (!classification) return null;

        // Find rolling metrics for this entity
        const allEntities = [
            ...snapshot.entities.account,
            ...snapshot.entities.campaign,
            ...snapshot.entities.adset,
            ...(adsSnapshot?.ads || [])
        ];
        const entity = allEntities.find(e => e.entityId === entityId && e.level === level);

        // Find concept metrics if ad level
        let conceptMetrics = null;
        if (level === 'ad' && entity?.conceptId) {
            const concept = snapshot.concepts.find(c => c.conceptId === entity.conceptId);
            if (concept) {
                conceptMetrics = { conceptId: concept.conceptId, rolling: concept.rolling };
            }
        }

        // Build creative category summary for context
        const adClassifications = adsSnapshot?.classifications || [];
        const categoryCounts: Record<string, number> = {};
        for (const c of adClassifications) {
            if (c.creativeCategory) {
                categoryCounts[c.creativeCategory] = (categoryCounts[c.creativeCategory] || 0) + 1;
            }
        }

        return {
            classification: {
                clientId,
                level,
                entityId,
                ...classification,
                updatedAt: snapshot.computedDate
            },
            rolling: entity?.rolling,
            concept: conceptMetrics,
            clientTarget: {
                cpa: client?.targetCpa,
                roas: client?.targetRoas,
                goal: client?.primaryGoal,
                bizModel: client?.businessModel,
                growthMode: client?.growthMode,
                funnelPriority: client?.funnelPriority,
                ltv: client?.ltv,
            },
            creativeInsights: {
                totalAds: adClassifications.length,
                categoryCounts,
                entityCategory: classification.creativeCategory || null,
                entityCategoryReasoning: classification.creativeCategoryReasoning || null,
            }
        };
    }
}
