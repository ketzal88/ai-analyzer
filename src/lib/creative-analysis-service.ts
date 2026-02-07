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
            id: creative.ad.id,
            format: creative.creative.format,
            headline: creative.creative.headline,
            primaryText: creative.creative.primaryText,
            cta: creative.creative.ctaType
        },
        metrics: {
            spend: kpis.spend,
            roas: kpis.roas,
            cpa: kpis.cpa,
            ctr: kpis.ctr,
            frequency: kpis.frequency,
            conv: kpis.primaryConversions
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

    let promptId = "default-creative-v1";
    if (!promptSnap.empty) {
        const p = promptSnap.docs[0].data();
        systemPrompt = p.system;
        promptId = promptSnap.docs[0].id;
    }

    // 3. Cache Check (24h)
    // Key: clientId__adId__rangeHash__promptId
    const rangeHash = createHash("md5").update(`${range.start}_${range.end}`).digest("hex");
    const reportId = `${clientId}__${creative.ad.id}__${rangeHash}__${promptId}`;

    const cachedSnap = await db.collection("creative_ai_reports").doc(reportId).get();
    if (cachedSnap.exists) {
        const data = cachedSnap.data() as CreativeAIReport;
        const age = (Date.now() - new Date(data.metadata.generatedAt).getTime()) / (1000 * 60 * 60);
        if (age < 24) {
            console.log(`[AI Analysis] Returning cached report for ${creative.ad.id}`);
            return data;
        }
    }

    // 4. Generate with Gemini
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
    const output = JSON.parse(jsonStr);

    const report: CreativeAIReport = {
        id: reportId,
        clientId,
        adId: creative.ad.id,
        range,
        promptId,
        model: MODEL,
        output,
        metadata: {
            tokensEstimate: text.length / 4, // heuristic
            inputsHash,
            generatedAt: new Date().toISOString()
        }
    };

    // 5. Store in Firestore
    await db.collection("creative_ai_reports").doc(reportId).set(report);

    return report;
}
