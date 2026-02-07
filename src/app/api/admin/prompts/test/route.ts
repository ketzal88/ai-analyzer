import { db } from "@/lib/firebase-admin";
import { getAdminStatus } from "@/lib/server-utils";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

export async function POST(request: NextRequest) {
    const { isAdmin, uid } = await getAdminStatus(request);
    if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { clientId, promptId, range = "last_14d" } = await request.json();

        if (!clientId || !promptId) {
            return NextResponse.json({ error: "Missing clientId or promptId" }, { status: 400 });
        }

        // 1. Load Prompt Template
        const promptDoc = await db.collection("prompt_templates").doc(promptId).get();
        if (!promptDoc.exists) return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
        const promptTemplate = promptDoc.data()!;

        // 2. Load Client
        const clientDoc = await db.collection("clients").doc(clientId).get();
        if (!clientDoc.exists) return NextResponse.json({ error: "Client not found" }, { status: 404 });
        const clientData = clientDoc.data()!;

        // 3. Prepare Data based on Key
        let finalUserPrompt = "";
        const clientName = clientData.name;

        if (promptTemplate.key === "report") {
            const findingsSnapshot = await db.collection("findings")
                .where("clientId", "==", clientId)
                .orderBy("createdAt", "desc")
                .limit(20)
                .get();

            const summary = {
                account: {
                    name: clientData.name,
                    biz: clientData.businessModel || "",
                    goal: clientData.primaryGoal || "efficiency",
                },
                period: range,
                data: findingsSnapshot.docs.map(doc => ({
                    type: doc.data().type,
                    title: doc.data().title,
                    sev: doc.data().severity
                }))
            };
            finalUserPrompt = promptTemplate.userTemplate.replace("{{summary_json}}", JSON.stringify(summary));
        } else if (promptTemplate.key === "creative-audit" || promptTemplate.key === "creative-variations") {
            const mockCreative = {
                id: "test_ad_123",
                format: "IMAGE",
                primaryText: "¡Prueba nuestro nuevo producto hoy!",
                headline: "Oferta limitada",
                metrics: { spend: 1000, roas: 3.5, ctr: 1.2 }
            };
            finalUserPrompt = promptTemplate.userTemplate.replace("{{summary_json}}", JSON.stringify(mockCreative));
        }

        // Global variable replacements
        finalUserPrompt = finalUserPrompt
            .replace("{{client_name}}", clientData.name)
            .replace("{{meta_id}}", clientData.metaAdAccountId || "N/A")
            .replace("{{ecommerce_mode}}", clientData.isEcommerce ? "ON" : "OFF");

        const systemPrompt = promptTemplate.system;

        // 4. Call Gemini
        const start = Date.now();
        const model = genAI.getGenerativeModel({
            model: PRIMARY_MODEL,
            systemInstruction: systemPrompt
        });

        const result = await model.generateContent(finalUserPrompt);
        const latencyMs = Date.now() - start;

        const response = result.response;
        const text = response.text();
        const outputClean = text.replace(/```json/g, "").replace(/```/g, "").trim();

        // 5. Log Run
        const runLog = {
            promptId,
            clientId,
            range,
            modelUsed: PRIMARY_MODEL,
            latencyMs,
            cacheHit: false,
            output: outputClean.substring(0, 8000), // Max 8KB
            success: true,
            createdAt: new Date().toISOString(),
            createdByUid: uid
        };

        await db.collection("prompt_runs").add(runLog);

        return NextResponse.json({
            output: outputClean,
            metadata: {
                modelUsed: PRIMARY_MODEL,
                latencyMs,
                cacheHit: false
            }
        });

    } catch (error: any) {
        console.error("Prompt Test Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
