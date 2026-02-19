import { db } from "@/lib/firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createHash } from "crypto";
import { reportError } from "@/lib/error-reporter";

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
            reportError("LLM Rate Limit Check", e, { clientId });
        }
    }

    // 2. Prepare Summary
    // Optimization: Filter strictly necessary fields to reduce input tokens
    const optimizedFindings = findings.slice(0, 20).map(f => ({
        type: f.type,
        title: f.title,
        desc: f.description,
        sev: f.severity,
        evidence: f.evidence
    }));

    const summary = {
        account: {
            name: clientData.name,
            biz: clientData.businessType || clientData.businessModel || "ecommerce", // support new businessType
            goal: clientData.primaryGoal || "efficiency",
            constr: clientData.constraints || {},
        },
        period: rangeLabel,
        data: optimizedFindings // "data" is shorter than "findings"
    };

    const summaryStr = JSON.stringify(summary);
    if (Buffer.byteLength(summaryStr) > 12000) {
        summary.data = summary.data.slice(0, 10);
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
    } catch (_e) {
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

    if (!activePromptSnapshot.empty) {
        const template = activePromptSnapshot.docs[0].data();
        systemPrompt = template.system;
        userTemplate = template.userTemplate;
        promptVersion = template.version;
    }

    // ENFORCE SPANISH & ROLE SEPARATION
    // Token Reduction: Use GraphQL Schema Definition for output structure instead of verbose JSON
    systemPrompt += `
    
    INSTRUCCIONES CRÍTICAS:
    1. Eres un ANALISTA ESTRATÉGICO. NO repitas datos. INTERPRETA y PLANIFICA.
    2. IDIOMA: ESPAÑOL.
    
    FORMATO DE RESPUESTA (JSON):
    Debes responder con un JSON válido que cumpla este esquema (TypeScript/GraphQL-like):
    
    type Response = {
      meta: any; // Metadatos libres
      sections: Section[];
    }
    
    type Section = {
      id: "strategy"; // Única sección requerida
      title: string;
      summary: string; // Resumen ejecutivo
      insights: Insight[];
    }
    
    type Insight = {
      title: string;
      observation: string; // Causa raíz + hallazgos
      implication: string; // Impacto en negocio
      actions: Action[];
    }

    type Action = {
      type: "DO";
      description: string;
      horizon: "IMMEDIATE" | "SHORT_TERM";
      expectedImpact: string;
    }
    `;

    const finalPrompt = userTemplate
        .replace("{{summary_json}}", JSON.stringify(summary)) // Removed null, 2 spacing to save tokens
        .replace("{{client_name}}", clientData.name)
        .replace("{{meta_id}}", clientData.metaAdAccountId || "N/A")
        .replace("{{ecommerce_mode}}", clientData.businessType === 'ecommerce' ? "ON" : "OFF")
        .replace("{{business_type}}", clientData.businessType || "ecommerce");

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
        reportError("Firebase LLM Cache", dbError, { clientId, metadata: { digest } });
        // We don't throw here, because we still want to return the report to the user
        // even if caching fails (e.g. due to index or permission issues)
    }

    return sanitizedRecord;
}
