import { db } from "@/lib/firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createHash } from "crypto";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-1.5-pro";

function isModelNotFoundError(error: any): boolean {
    const message = error?.message?.toLowerCase() || "";
    return message.includes("404") || message.includes("not found") || message.includes("not supported");
}

/**
 * Service to handle LLM Report Generation
 */
export async function generateGeminiReport(
    clientId: string,
    clientData: any,
    findings: any[],
    rangeLabel: string
): Promise<any> {

    // 1. Rate Limit Check (60s)
    try {
        const lastReportSnapshot = await db.collection("llm_reports")
            .where("clientId", "==", clientId)
            .orderBy("createdAt", "desc")
            .limit(1)
            .get();

        if (!lastReportSnapshot.empty) {
            const lastReport = lastReportSnapshot.docs[0].data();
            const lastTime = new Date(lastReport.createdAt).getTime();
            if ((Date.now() - lastTime) < 60 * 1000) {
                console.warn(`Rate limit hit for ${clientId}. Returning cached.`);
                return lastReport;
            }
        }
    } catch (e: any) {
        if (e.code === 9 || e.message?.toLowerCase().includes("index")) {
            console.warn("Index missing for llm_reports rate limit check. Proceeding with generation.");
        } else {
            console.error("Rate limit check error:", e);
        }
    }

    // 2. Prepare Summary
    const summary = {
        account: {
            name: clientData.name,
            metaAdAccountId: clientData.metaAdAccountId,
            isEcommerce: clientData.isEcommerce,
            description: clientData.description || "",
            businessModel: clientData.businessModel || "",
            goals: {
                primary: clientData.primaryGoal || "efficiency",
                targetCpa: clientData.targetCpa,
                targetRoas: clientData.targetRoas,
            },
            constraints: clientData.constraints || {},
            conversions: clientData.conversionSchema || {}
        },
        analysis_period: rangeLabel,
        findings: findings.length > 20 ? findings.slice(0, 20) : findings
    };

    const summaryStr = JSON.stringify(summary);
    if (Buffer.byteLength(summaryStr) > 12000) {
        summary.findings = summary.findings.slice(0, 10);
    }

    const digest = createHash("sha256").update(JSON.stringify(summary)).digest("hex");

    // 3. Digest Cache Check
    try {
        const cachedReport = await db.collection("llm_reports")
            .where("clientId", "==", clientId)
            .where("digest", "==", digest)
            .limit(1)
            .get();
        if (!cachedReport.empty) return cachedReport.docs[0].data();
    } catch (_e) { // Renamed e to _e
        // Ignore cache read errors
    }

    // 4. Fetch Prompt
    const activePromptSnapshot = await db.collection("prompt_templates")
        .where("key", "==", "report")
        .where("status", "==", "active")
        .limit(1)
        .get();

    let systemPrompt = "Eres un analista experto en Meta Ads.";
    let userTemplate = `Analiza... {{summary_json}}`;
    let promptVersion = 0;
    // let promptSchemaVersion = "v1"; - Removed unused

    if (!activePromptSnapshot.empty) {
        const template = activePromptSnapshot.docs[0].data();
        systemPrompt = template.system;
        userTemplate = template.userTemplate;
        promptVersion = template.version;
        // promptSchemaVersion = template.outputSchemaVersion || "v1";
    }

    // ENFORCE SPANISH & ROLE SEPARATION
    systemPrompt += `
    
    INSTRUCCIONES CRÍTICAS DE ROL:
    1. TÚ ERES EL ANALISTA ESTRATÉGICO. El usuario ya tiene una lista de hallazgos numéricos (ej: "CPA subió 20%"). NO repitas esa lista.
    2. TU TRABAJO ES INTERPRETAR: ¿Por qué pasó eso? ¿Qué significa para el negocio?
    3. TU TRABAJO ES PLANIFICAR: ¿Qué hacemos en los próximos 14-30 días?
    4. IDIOMA: Genera TODO el contenido EXCLUSIVAMENTE EN ESPAÑOL.
    
    ESTRUCTURA DE RESPUESTA REQUERIDA (JSON V2):
    {
       "meta": { ... },
       "sections": [
           {
               "id": "strategy",
               "title": "Interpretación y Estrategia",
               "summary": "Resumen ejecutivo de alto nivel...",
               "insights": [
                   {
                       "title": "Análisis de Causa Raíz",
                       "observation": "Explica la causa probable combinando los hallazgos...",
                       "implication": "Impacto en objetivos comerciales...",
                       "actions": [ ... pasos concretos ... ]
                   }
               ]
           }
       ]
    }
    `;

    const finalPrompt = userTemplate
        .replace("{{summary_json}}", JSON.stringify(summary, null, 2))
        .replace("{{client_name}}", summary.account.name)
        .replace("{{meta_id}}", summary.account.metaAdAccountId || "N/A")
        .replace("{{ecommerce_mode}}", summary.account.isEcommerce ? "Activado" : "Desactivado");

    // 5. Generate
    let result;
    let usedModel = PRIMARY_MODEL;

    try {
        if (!process.env.GEMINI_API_KEY) throw new Error("API Key missing");

        const model = genAI.getGenerativeModel({
            model: PRIMARY_MODEL,
            systemInstruction: systemPrompt
        });
        result = await model.generateContent(finalPrompt);
    } catch (error: any) {
        if (isModelNotFoundError(error)) {
            console.warn(`Fallback to ${FALLBACK_MODEL}`);
            usedModel = FALLBACK_MODEL;
            const model = genAI.getGenerativeModel({ model: FALLBACK_MODEL, systemInstruction: systemPrompt });
            result = await model.generateContent(finalPrompt);
        } else {
            throw error;
        }
    }

    const text = result.response.text();
    const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsedOutput = JSON.parse(jsonStr); // prefer-const

    // 6. Normalize
    let normalizedReport: any = {};
    if (parsedOutput.meta && parsedOutput.sections) {
        // Native V2 format
        normalizedReport = {
            ...parsedOutput,
            meta: {
                ...parsedOutput.meta,
                reportId: digest.substring(0, 8),
                generatedAt: new Date().toISOString(),
                model: usedModel,
                period: parsedOutput.meta?.period || { start: rangeLabel, end: "Now" },
                account: {
                    ...parsedOutput.meta?.account,
                    id: clientId,
                    currency: clientData.currency || "USD",
                    timezone: clientData.timezone || "UTC"
                }
            }
        };
    } else {
        // Fallback: Map legacy V1 schema to V2 structure
        const analysis = parsedOutput.analysis || parsedOutput;

        normalizedReport = {
            meta: {
                reportId: digest.substring(0, 8),
                generatedAt: new Date().toISOString(),
                schemaVersion: "v2",
                period: { start: rangeLabel, end: "Now" },
                model: usedModel,
                account: { id: clientId, currency: clientData.currency }
            },
            sections: [
                {
                    id: "legacy_diagnosis",
                    title: "Diagnóstico General (Formato Legacy)",
                    insights: (analysis.diagnosis || []).map((d: string, i: number) => ({
                        id: `diag_${i}`,
                        title: "Observación Generada",
                        severity: "INFO",
                        confidence: "MEDIUM",
                        classification: "STRUCTURE",
                        observation: d,
                        evidence: { metrics: [] },
                        actions: [],
                        interpretation: "Migrated from legacy format.",
                        implication: "Check original output for context."
                    }))
                },
                {
                    id: "legacy_actions",
                    title: "Acciones Inmediatas",
                    insights: (analysis.actions_next_72h || []).map((a: any, i: number) => ({
                        id: `act_${i}`,
                        title: a.action,
                        severity: a.priority === "critical" ? "CRITICAL" : "WARNING",
                        confidence: "HIGH",
                        classification: "TECHNICAL",
                        observation: a.action,
                        evidence: { metrics: [] },
                        actions: [{
                            type: "DO",
                            description: a.action,
                            horizon: "IMMEDIATE",
                            expectedImpact: a.expected_impact
                        }],
                        interpretation: "Acción recomendada automáticamente.",
                        implication: "Impacto en rendimiento a corto plazo."
                    }))
                }
            ]
        };
    }

    const fullReportRecord = {
        clientId,
        digest,
        summary,
        report: normalizedReport,
        modelUsed: usedModel,
        promptVersion,
        promptKey: "report",
        schemaVersion: "v2",
        createdAt: new Date().toISOString()
    };

    // 7. Store
    // Sanitize undefined values which Firestore hates
    const sanitizedRecord = JSON.parse(JSON.stringify(fullReportRecord));

    try {
        await db.collection("llm_reports").add(sanitizedRecord);
    } catch (dbError) {
        console.error("Failed to cache report in Firestore:", dbError);
        // We don't throw here, because we still want to return the report to the user
        // even if caching fails (e.g. due to index or permission issues)
    }

    return sanitizedRecord;
}
