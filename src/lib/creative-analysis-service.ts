import { db } from "@/lib/firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createHash } from "crypto";
import { CreativeAIReport } from "@/types/creative-analysis";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

/**
 * AG-45: Creative Analysis Service
 * Handles AI audits for specific creatives with caching
 */

export async function generateCreativeAudit(
    clientId: string,
    creative: any,
    kpis: any,
    range: { start: string; end: string }
): Promise<CreativeAIReport> {

    // 1. Prepare Inputs for Hashing & Prompt
    const inputData = {
        creative: {
            id: creative.ad?.id || "N/A",
            format: creative.creative?.format || "UNKNOWN",
            headline: creative.creative?.headline || "",
            primaryText: creative.creative?.primaryText || "",
            cta: creative.creative?.ctaType || ""
        },
        metrics: {
            spend: kpis.spend || 0,
            roas: kpis.roas || 0,
            cpa: kpis.cpa || 0,
            ctr: kpis.ctr || 0,
            frequency: kpis.frequency || 0,
            conv: kpis.primaryConversions || 0
        },
        range
    };

    const inputsHash = createHash("sha256").update(JSON.stringify(inputData)).digest("hex");

    // 2. Fetch Active Prompt
    const promptSnap = await db.collection("prompt_templates")
        .where("key", "==", "creative-audit")
        .where("status", "==", "active")
        .limit(1)
        .get();

    let systemPrompt = `Eres un experto en Creative Strategy para Meta Ads. 
    Analiza el creativo proporcionado y genera una auditoría estratégica.
    
    FORMATO JSON REQUERIDO:
    {
      "diagnosis": "Resumen del rendimiento actual.",
      "risks": {
        "fatigue": "Evaluación de saturación.",
        "collision": "Riesgo de canibalización con otros activos."
      },
      "actions": {
        "horizon7d": "Acción inmediata de optimización.",
        "horizon14d": "Siguiente paso estratégico.",
        "horizon30d": "Visión a largo plazo para este activo."
      },
      "score": 0-100
    }
    
    IDIOMA: ESPAÑOL.
    SE BREVE Y ACCIONABLE.`;

    let promptId = "default";
    let promptVersion = 1;

    if (!promptSnap.empty) {
        const p = promptSnap.docs[0].data();
        systemPrompt = p.system;
        promptId = promptSnap.docs[0].id;
        promptVersion = p.version || 1;
    }

    // 3. Cache Check (24h)
    // New Human Readable Key: clientId__adId__YYYY-MM-DD_YYYY-MM-DD__p{version}
    const rangeKey = `${range.start}_${range.end}`;
    const rangeHash = createHash("md5").update(rangeKey).digest("hex");

    const newReportId = `${clientId}__${creative.ad.id}__${rangeKey}__p${promptVersion}`;
    const oldReportId = `${clientId}__${creative.ad.id}__${rangeHash}__${promptId}`;

    const checkCache = async (id: string) => {
        try {
            const snap = await db.collection("creative_ai_reports").doc(id).get();
            if (snap.exists) {
                const data = snap.data();
                if (!data?.metadata?.generatedAt) {
                    console.warn(`[AI Analysis] Cached report ${id} missing metadata.generatedAt. Skipping.`);
                    return null;
                }

                const age = (Date.now() - new Date(data.metadata.generatedAt).getTime()) / (1000 * 60 * 60);
                if (age < 24) return data as CreativeAIReport;
            }
        } catch (e) {
            console.error(`[AI Analysis] Cache check error for ${id}:`, e);
        }
        return null;
    };

    let cachedReport = await checkCache(newReportId);

    // Fallback to old hash-based ID and migrate if found
    if (!cachedReport) {
        cachedReport = await checkCache(oldReportId);
        if (cachedReport) {
            try {
                console.log(`[AI Analysis] Migrating legacy report ${oldReportId} -> ${newReportId}`);
                const migratedReport = {
                    ...cachedReport,
                    id: newReportId,
                    range: {
                        start: cachedReport.range?.start || range.start,
                        end: cachedReport.range?.end || range.end,
                        tz: "UTC"
                    },
                    rangeKey
                };
                await db.collection("creative_ai_reports").doc(newReportId).set(migratedReport);
                return migratedReport as CreativeAIReport;
            } catch (migError) {
                console.warn("[AI Analysis] Migration failed, proceeding to fresh generation:", migError);
                cachedReport = null;
            }
        }
    }

    if (cachedReport) {
        console.log(`[AI Analysis] Returning cached report for ${creative.ad.id}`);
        return cachedReport;
    }

    // 4. Generate with Gemini
    try {
        console.log(`[AI Analysis] Generating fresh audit for ${creative.ad.id}...`);
        const model = genAI.getGenerativeModel({
            model: MODEL,
            systemInstruction: systemPrompt
        });

        const userPrompt = `Datos del Creativo y KPIs:
        ${JSON.stringify(inputData, null, 2)}
        
        Analiza y responde solo con el JSON.`;

        const result = await model.generateContent(userPrompt);
        const text = result.response.text();

        // Parse JSON safely
        const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
        let output;
        try {
            output = JSON.parse(jsonStr);
        } catch (parseError) {
            console.error("[AI Analysis] Gemini output parse error:", parseError, "Raw text:", text);
            throw new Error("La IA no devolvió un formato válido. Por favor, reintenta.");
        }

        const report: any = {
            id: newReportId,
            clientId,
            adId: creative.ad.id,
            range: {
                ...range,
                tz: "UTC"
            },
            rangeKey,
            promptId,
            promptVersion,
            model: MODEL,
            output,
            metadata: {
                tokensEstimate: text.length / 4, // heuristic
                inputsHash,
                generatedAt: new Date().toISOString()
            }
        };

        // 5. Store in Firestore
        await db.collection("creative_ai_reports").doc(newReportId).set(report);

        return report;
    } catch (genError: any) {
        console.error("[AI Analysis] Generation Error:", genError);
        throw genError;
    }
}

/**
 * AG-45: Creative Variations Service
 * Generates new copy/concept variations based on a winner
 */
export async function generateCreativeVariations(
    clientId: string,
    creative: any,
    kpis: any
): Promise<any> {
    const promptSnap = await db.collection("prompt_templates")
        .where("key", "==", "creative-variations")
        .where("status", "==", "active")
        .limit(1)
        .get();

    // Default Fallback Prompt (Hardcoded)
    let systemPrompt = `Eres un experto en Creative Strategy (GEM). Generá 3 variaciones de exploración real, no cambios cosméticos. Responde en JSON.`;

    if (!promptSnap.empty) {
        systemPrompt = promptSnap.docs[0].data().system;
    }

    const model = genAI.getGenerativeModel({
        model: MODEL,
        systemInstruction: systemPrompt
    });

    const creativeData = {
        adName: creative.ad.name,
        format: creative.creative.format,
        copy: creative.creative.primaryText,
        headline: creative.creative.headline,
        metrics: {
            roas: kpis.roas,
            cpa: kpis.cpa,
            spend: kpis.spend
        }
    };

    const userPrompt = `Fuente única de verdad:
    {{summary_json}}`.replace("{{summary_json}}", JSON.stringify(creativeData, null, 2));

    try {
        const result = await model.generateContent(userPrompt);
        const text = result.response.text();
        const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error("[Creative Variations] Error generating or parsing variations:", error);
        return { error: "Failed to generate variations", raw: null };
    }
}
