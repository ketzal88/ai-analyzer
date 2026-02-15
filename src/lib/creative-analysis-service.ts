import { db } from "@/lib/firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createHash } from "crypto";
import { CreativeAIReport } from "@/types/creative-analysis";
import { reportError } from "@/lib/error-reporter";

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
                if (!data?.metadata?.generatedAt) return null;

                // Validation: if it lacks diagnosis/score (audit) or variations (copy), it's a "broken" cache
                const isAudit = !data.metadata.capability || data.metadata.capability === 'audit';
                const isVar = data.metadata.capability === 'variations_copy';

                if (isAudit && !data.output?.diagnosis) return null;
                if (isVar && (!data.variations || data.variations.length === 0)) return null;

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
        console.log(`[AI Analysis] RAW Gemini Response for ${creative.ad.id}:`, text);

        // Parse JSON safely
        const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
        let output: any;
        try {
            const parsed = JSON.parse(jsonStr);
            const raw = parsed.output || parsed.report || parsed.audit || parsed;

            // Standardisation Mapper
            output = {
                diagnosis: raw.diagnosis || raw.analysis?.intent_signal || raw.analysis?.diagnosis || raw.diagnosis_summary || "Análisis completado.",
                risks: {
                    fatigue: raw.risks?.fatigue || raw.analysis?.fatigue_risk || raw.diagnosis?.risks?.fatigue || "Bajo",
                    collision: raw.risks?.collision || raw.analysis?.semantic_collision_risk || raw.diagnosis?.risks?.collision || "Bajo"
                },
                actions: {
                    horizon7d: raw.actions?.horizon7d || raw.analysis?.recommendations?.[0]?.description || raw.recommended_actions?.[0] || "Mantener monitoreo.",
                    horizon14d: raw.actions?.horizon14d || raw.analysis?.recommendations?.[1]?.description || raw.recommended_actions?.[1] || "Evaluar escala.",
                    horizon30d: raw.actions?.horizon30d || raw.analysis?.recommendations?.[2]?.description || raw.recommended_actions?.[2] || "Iterar concepto."
                },
                score: raw.score !== undefined ? Number(raw.score) : (raw.analysis?.score !== undefined ? Number(raw.analysis.score) : (raw.score_ia !== undefined ? Number(raw.score_ia) : 0))
            };

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
                tokensEstimate: text.length / 4,
                inputsHash,
                generatedAt: new Date().toISOString(),
                capability: 'audit'
            }
        };

        // 5. Store in Firestore
        await db.collection("creative_ai_reports").doc(newReportId).set(report);

        return report;
    } catch (genError: any) {
        reportError("LLM Creative Audit", genError, { clientId, metadata: { adId: creative.ad?.id } });
        throw genError;
    }
}

/**
 * AG-45: Creative Variations Service
 * Generates new copy/concept variations based on a winner with caching
 */
export async function generateCreativeVariations(
    clientId: string,
    creative: any,
    kpis: any,
    range: { start: string; end: string },
    objective: string = "Explorar nuevos hooks"
): Promise<any> {
    // 1. Fetch Active Prompt
    const promptSnap = await db.collection("prompt_templates")
        .where("key", "==", "creative-variations")
        .where("status", "==", "active")
        .limit(1)
        .get();

    let systemPrompt = `Eres un experto en Creative Strategy (GEM). Generá variaciones de exploración real, no cambios cosméticos. Responde en JSON.`;
    let promptId = "default";
    let promptVersion = 1;

    if (!promptSnap.empty) {
        systemPrompt = promptSnap.docs[0].data().system;
        promptId = promptSnap.docs[0].id;
        promptVersion = promptSnap.docs[0].data().version || 1;
    }

    // 2. Cache Check
    const rangeKey = `${range.start}_${range.end}`;
    const reportId = `${clientId}__${creative.ad.id}__${rangeKey}__${promptId}`;

    const cacheSnap = await db.collection("creative_ai_reports").doc(reportId).get();
    if (cacheSnap.exists) {
        const data = cacheSnap.data();
        if (data?.metadata?.capability === 'variations_copy' && data.variations?.length > 0) {
            console.log(`[AI Variations] Returning cached variations for ${creative.ad.id}`);
            return data;
        }
    }

    // 3. Generate
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
        },
        objective
    };

    const userPrompt = `Fuente única de verdad:
    {{summary_json}}`.replace("{{summary_json}}", JSON.stringify(creativeData, null, 2));

    try {
        console.log(`[AI Variations] Generating fresh variations for ${creative.ad.id}...`);
        const result = await model.generateContent(userPrompt);
        const text = result.response.text();
        const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();

        let variations = [];
        try {
            const parsed = JSON.parse(jsonStr);
            // Robust parsing for a list of variations
            variations = Array.isArray(parsed)
                ? parsed
                : (parsed.variations || parsed.concepts || parsed.conceptos || parsed.variaciones || parsed.output || []);

            // If it's still not an array but contains a property that is an array, take the first one
            if (!Array.isArray(variations) || variations.length === 0) {
                const firstArrayKey = Object.keys(parsed).find(key => Array.isArray(parsed[key]) && (parsed[key] as any).length > 0);
                if (firstArrayKey) variations = parsed[firstArrayKey];
            }

            if (!Array.isArray(variations) || variations.length === 0) {
                console.error("[AI Variations] Empty or invalid variations from Gemini. RAW:", text);
                throw new Error("La IA no pudo generar variaciones válidas para este contenido. Por favor, reintenta.");
            }

            // Normalization Mapper for Variations
            variations = variations.map((v: any) => {
                // Determine Copy: check arrays and strings
                const copyCandidates = v.copy_variations || v.copy || v.primary_text || v.primaryText || v.textos || v.texto || [];
                const copy = Array.isArray(copyCandidates) ? copyCandidates : (copyCandidates ? [copyCandidates] : []);

                // Determine Headlines: check arrays and strings
                const headlineCandidates = v.headline_variations || v.headline || v.headlines || v.titles || v.titulos || v.titulo || [];
                const headlines = Array.isArray(headlineCandidates) ? headlineCandidates : (headlineCandidates ? [headlineCandidates] : []);

                // Determine Hooks/Context
                const hookCandidates = v.hooks || v.hook || v.ganchos || v.gancho || [];
                const hooks = Array.isArray(hookCandidates) ? hookCandidates : (hookCandidates ? [hookCandidates] : []);

                return {
                    concept_name: v.concept_name || v.concept || v.adName || v.name || "Nuevo Concepto",
                    difference_axis: v.difference_axis || v.axis || v.variationType || v.change || "Exploración",
                    gem_intent: v.gem_intent || v.intent || v.rationale || "",
                    target_context: v.target_context || v.context || v.target || v.rationale || "",
                    hooks: hooks.length > 0 ? hooks : (v.target_context ? [v.target_context] : []),
                    copy_variations: copy.length > 0 ? copy : ["Sin texto generado"],
                    headline_variations: headlines.length > 0 ? headlines : ["Sin título generado"],
                    visual_context: v.visual_context || v.visual || v.shot_suggestion || v.format || "",
                    cta_suggestion: v.cta_suggestion || v.cta || ""
                };
            });

        } catch (e: any) {
            console.error("[AI Variations] Parsing Error:", e.message, "Text:", text);
            throw new Error(e.message || "Error al procesar las variaciones de la IA.");
        }

        const report: any = {
            id: reportId,
            clientId,
            adId: creative.ad.id,
            range: { ...range, tz: "UTC" },
            rangeKey,
            promptId,
            promptVersion,
            model: MODEL,
            objective,
            variations,
            metadata: {
                generatedAt: new Date().toISOString(),
                capability: 'variations_copy',
                creative_role: 'exploration'
            }
        };

        await db.collection("creative_ai_reports").doc(reportId).set(report);
        return report;
    } catch (error: any) {
        reportError("LLM Creative Variations", error, { clientId, metadata: { adId: creative.ad?.id } });
        return { error: error.message || "Failed to generate variations", status: "error" };
    }
}
