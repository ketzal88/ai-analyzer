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

        // 3. Construct Summary (max 10KB)
        const summary = {
            account: {
                name: clientData.name,
                metaAdAccountId: clientData.metaAdAccountId,
                isEcommerce: clientData.isEcommerce,
            },
            analysis_period: "last_14d_wow",
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

        const prompt = `
      Eres un ingeniero experto en crecimiento y optimización de Meta Ads. 
      Analiza el siguiente resumen diagnóstico para el cliente "${summary.account.name}".
      ID de Plataforma: ${summary.account.metaAdAccountId}.
      Modo Ecommerce: ${summary.account.isEcommerce ? "Activado" : "Desactivado"}.
      
      RESUMEN DE DATOS:
      ${JSON.stringify(summary, null, 2)}
      
      INSTRUCCIONES:
      1. Proporciona un diagnóstico profesional del estado actual en ESPAÑOL.
      2. Agrupa los problemas por probabilidad e impacto.
      3. Sugiere acciones específicas para las próximas 72 horas.
      4. Enumera preguntas para que el usuario confirme la configuración técnica.
      5. TODA LA RESPUESTA DEBE ESTAR EN ESPAÑOL.
      
      FORMATO DE SALIDA (SOLO JSON):
      {
        "analysis": {
          "diagnosis": ["punto 1", "punto 2"],
          "hypotheses": [
            { "title": "título en español", "probability": "low|medium|high", "reasoning": "razonamiento en español" }
          ],
          "actions_next_72h": [
            { "action": "acción en español", "priority": "critical|high|medium", "expected_impact": "impacto esperado en español" }
          ],
          "questions_to_confirm": ["pregunta 1"]
        }
      }
    `;

        let result;
        let usedModel = PRIMARY_MODEL;
        let isFallbackUsed = false;

        try {
            const model = genAI.getGenerativeModel({ model: PRIMARY_MODEL });
            result = await model.generateContent(prompt);
        } catch (error: any) {
            if (isModelNotFoundError(error)) {
                console.warn(`Gemini fallback used: ${FALLBACK_MODEL} (Error: ${error.message})`);
                usedModel = FALLBACK_MODEL;
                isFallbackUsed = true;
                const model = genAI.getGenerativeModel({ model: FALLBACK_MODEL });
                result = await model.generateContent(prompt);
            } else {
                throw error;
            }
        }

        const response = result.response;
        const text = response.text();

        if (!text) {
            throw new Error("Empty response from Gemini");
        }

        // Clean potential markdown wrap
        const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const analysis = JSON.parse(jsonStr);

        const fullReport = {
            clientId,
            digest,
            summary,
            analysis: analysis.analysis,
            modelUsed: usedModel,
            fallbackUsed: isFallbackUsed,
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
