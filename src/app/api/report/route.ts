import { auth, db } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Configuration from environment variables
const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-1.5-pro";

/**
 * Detects if the error is 404 or a "model not found/supported" message
 */
function isModelNotFoundError(error: any): boolean {
    const message = error?.message?.toLowerCase() || "";
    return (
        message.includes("404") ||
        message.includes("not found") ||
        message.includes("not supported") ||
        message.includes("not eligible")
    );
}

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

        // --- RATE LIMIT CHECK (Mission 18) ---
        // Prevent spamming Gemini if inputs changed but very frequently
        const lastReportSnapshot = await db.collection("llm_reports")
            .where("clientId", "==", clientId)
            .orderBy("createdAt", "desc")
            .limit(1)
            .get();

        if (!lastReportSnapshot.empty) {
            const lastReport = lastReportSnapshot.docs[0].data();
            const lastTime = new Date(lastReport.createdAt).getTime();
            const now = new Date().getTime();
            if (now - lastTime < 60 * 1000) { // 60 seconds cooldown
                console.warn(`Rate limit hit for client ${clientId}. Returning recent report.`);
                return NextResponse.json(lastReport);
            }
        }

        // 3. Construct Summary (max 10KB)
        // Mission 18: Enriched Client Context
        const summary = {
            account: {
                name: clientData.name,
                metaAdAccountId: clientData.metaAdAccountId,
                isEcommerce: clientData.isEcommerce,
                // Business Context
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
            analysis_period: "last_14d_wow", // TODO: Link to request range
            findings: findings
        };

        const summaryStr = JSON.stringify(summary);
        if (Buffer.byteLength(summaryStr) > 10240) {
            console.warn("Summary exceeds 10KB limit, truncating findings...");
            summary.findings = summary.findings.slice(0, 10);
        }

        // 4. Calculate Digest
        const digest = createHash("sha256").update(JSON.stringify(summary)).digest("hex");

        // 5. Check Cache
        const cachedReport = await db.collection("llm_reports")
            .where("clientId", "==", clientId)
            .where("digest", "==", digest)
            .limit(1)
            .get();

        if (!cachedReport.empty) {
            console.log("Returning cached Gemini report");
            return NextResponse.json(cachedReport.docs[0].data());
        }

        // 6. Call Gemini with Fallback Logic
        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({ error: "GEMINI_API_KEY_MISSING", message: "Gemini API Key not configured" }, { status: 500 });
        }

        // --- DYNAMIC PROMPT (Mission 15 + 17) ---
        const activePromptSnapshot = await db.collection("prompt_templates")
            .where("key", "==", "report")
            .where("status", "==", "active")
            .limit(1)
            .get();

        let systemPrompt = "Eres un ingeniero experto en crecimiento y optimización de Meta Ads.";
        let userTemplate = `Analiza... {{summary_json}}... (default fallback)`; // truncated for brevity
        let promptVersion = 0;
        let promptSchemaVersion = "v1";

        if (!activePromptSnapshot.empty) {
            const template = activePromptSnapshot.docs[0].data();
            systemPrompt = template.system;
            userTemplate = template.userTemplate;
            promptVersion = template.version;
            promptSchemaVersion = template.outputSchemaVersion || "v1";
        }

        const finalPrompt = userTemplate
            .replace("{{summary_json}}", JSON.stringify(summary, null, 2))
            .replace("{{client_name}}", summary.account.name)
            .replace("{{meta_id}}", summary.account.metaAdAccountId)
            .replace("{{ecommerce_mode}}", summary.account.isEcommerce ? "Activado" : "Desactivado");

        let result;
        let usedModel = PRIMARY_MODEL;
        let isFallbackUsed = false;

        try {
            const model = genAI.getGenerativeModel({
                model: PRIMARY_MODEL,
                systemInstruction: systemPrompt
            });
            result = await model.generateContent(finalPrompt);
        } catch (error: any) {
            if (isModelNotFoundError(error)) {
                console.warn(`Gemini fallback used: ${FALLBACK_MODEL} (Error: ${error.message})`);
                usedModel = FALLBACK_MODEL;
                isFallbackUsed = true;
                const model = genAI.getGenerativeModel({
                    model: FALLBACK_MODEL,
                    systemInstruction: systemPrompt
                });
                result = await model.generateContent(finalPrompt);
            } else {
                throw error;
            }
        }

        const response = result.response;
        const text = response.text();
        if (!text) throw new Error("Empty response from Gemini");

        // Clean & Parse
        const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
        let parsedOutput;
        try {
            parsedOutput = JSON.parse(jsonStr);
        } catch (e) {
            console.error("Failed to parse LLM output:", text);
            throw new Error("Invalid JSON from LLM");
        }

        // --- NORMALIZATION (Mission 17) ---
        // Ensure frontend always gets a GemReport structure
        let normalizedReport: any = {};

        if (promptSchemaVersion === "v2" && parsedOutput.meta && parsedOutput.sections) {
            // It's v2, but we overwrite critical meta with authoritative backend data
            normalizedReport = {
                ...parsedOutput,
                meta: {
                    ...parsedOutput.meta,
                    reportId: digest.substring(0, 8),
                    generatedAt: new Date().toISOString(),
                    model: usedModel,
                    account: {
                        ...parsedOutput.meta?.account,
                        id: clientId,
                        currency: clientData.currency || parsedOutput.meta?.account?.currency || "USD",
                        timezone: clientData.timezone || parsedOutput.meta?.account?.timezone || "UTC"
                    }
                }
            };
        } else {
            // It's v1 or unknown, map to v2 compatible structure
            // V1 output usually has { analysis: { diagnosis, hypotheses, actions_next_72h } }
            const analysis = parsedOutput.analysis || parsedOutput;

            normalizedReport = {
                meta: {
                    reportId: digest.substring(0, 8),
                    generatedAt: new Date().toISOString(),
                    schemaVersion: "v2",
                    period: { start: "Last 14d", end: "Now" },
                    account: {
                        id: clientId,
                        currency: clientData.currency || "USD",
                        timezone: clientData.timezone || "UTC"
                    },
                    model: usedModel
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
                            implication: "Review original output for context."
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

        const fullReport = {
            clientId,
            digest,
            summary, // raw data input
            report: normalizedReport, // new structured output
            // metadata
            modelUsed: usedModel,
            promptVersion,
            promptKey: "report",
            schemaVersion: "v2", // We always store v2 wrapper now
            createdAt: new Date().toISOString()
        };

        // 7. Store in Cache
        await db.collection("llm_reports").add(fullReport);

        return NextResponse.json(fullReport);

    } catch (error: any) {
        if (isModelNotFoundError(error)) {
            console.error(`Gemini unavailable for client ${request.nextUrl.searchParams.get("clientId")}`);
            return NextResponse.json({
                error: "LLM_UNAVAILABLE",
                message: "Gemini model not available"
            }, { status: 503 });
        }

        console.error("Gemini Report Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
