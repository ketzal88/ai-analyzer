import { db } from "@/lib/firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ConceptBriefDoc } from "@/types/concept-ai-brief";
import { ConceptService } from "./concept-service";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

export class ConceptBriefService {

    static async generate(
        clientId: string,
        conceptId: string,
        range: { start: string; end: string }
    ) {
        // 1. Build Context Pack
        const contextPack = await ConceptService.getConceptDetail(clientId, conceptId, range);
        if (!contextPack) {
            return { status: 'insufficient_evidence', message: 'No concept data found.' };
        }

        // 2. Cache Check
        const promptKey = "concept_briefs_v1";
        const rangeStr = `${range.start}_${range.end}`;
        const docId = `${clientId}__${conceptId}__${rangeStr}__v1`;

        const cached = await db.collection("concept_ai_briefs").doc(docId).get();
        if (cached.exists) {
            return { status: 'cached', brief: cached.data() as ConceptBriefDoc };
        }

        // 3. Fetch Prompt Template
        const activePromptSnapshot = await db.collection("prompt_templates")
            .where("key", "==", promptKey)
            .where("status", "==", "active")
            .limit(1)
            .get();

        let systemPrompt = "Eres un Director Creativo de Performance experto en Meta Ads.";
        let userTemplate = "Genera un Creative Brief para este concepto:\n\n{{summary_json}}";

        if (!activePromptSnapshot.empty) {
            const template = activePromptSnapshot.docs[0].data();
            systemPrompt = template.system;
            userTemplate = template.userTemplate;
        }

        systemPrompt += `
    INSTRUCCIONES CRÍTICAS:
    - Responde EXCLUSIVAMENTE en JSON.
    - IDIOMA: TODO EL CONTENIDO DEL JSON (exceptuando las keys) DEBE ESTAR EN ESPAÑOL.
    - No uses markdown.
    
    ESQUEMA JSON REQUERIDO:
    {
      "context": "string",
      "evidence": string[],
      "diagnosis": "string",
      "rotationPlan": {
        "avatar": "string",
        "conflict": "string",
        "proof": "string",
        "format": "string",
        "context": "string"
      },
      "deliverables": [
        {
          "title": "string",
          "hooks": [string, string],
          "script": "string",
          "visual": "string",
          "cta": "string",
          "proofType": "string"
        }
      ],
      "successCriteria": "string"
    }
    `;

        // 4. Generate with Gemini
        try {
            if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");

            const model = genAI.getGenerativeModel({ model: MODEL, systemInstruction: systemPrompt });
            const prompt = userTemplate.replace("{{summary_json}}", JSON.stringify(contextPack));

            const result = await model.generateContent(prompt);
            const text = result.response.text();
            const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
            const parsed = JSON.parse(jsonStr);

            const briefDoc: ConceptBriefDoc = {
                id: docId,
                clientId,
                conceptId,
                range,
                ...parsed,
                promptVersionId: "v1",
                createdAt: new Date().toISOString()
            };

            await db.collection("concept_ai_briefs").doc(docId).set(briefDoc);

            return { status: 'generated', brief: briefDoc };
        } catch (e: any) {
            console.error(e);
            return { status: 'error', message: e.message };
        }
    }
}
