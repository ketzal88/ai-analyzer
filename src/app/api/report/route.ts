import { auth, db } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const accountId = searchParams.get("accountId");

        if (!accountId) {
            return NextResponse.json({ error: "Missing accountId" }, { status: 400 });
        }

        // 1. Auth check
        const sessionCookie = request.cookies.get("session")?.value;
        if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const decodedToken = await auth.verifySessionCookie(sessionCookie);
        const uid = decodedToken.uid;

        // 2. Load account & findings
        const accountDoc = await db.collection("accounts").doc(accountId).get();
        if (!accountDoc.exists) return NextResponse.json({ error: "Account not found" }, { status: 404 });
        const accountData = accountDoc.data()!;
        if (accountData.ownerUid !== uid) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const findingsSnapshot = await db.collection("findings")
            .where("accountId", "==", accountId)
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
                name: accountData.name,
                targetCpa: accountData.targetCpa,
                goal: accountData.goal,
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
            .where("accountId", "==", accountId)
            .where("digest", "==", digest)
            .limit(1)
            .get();

        if (!cachedReport.empty) {
            console.log("Returning cached Gemini report");
            return NextResponse.json(cachedReport.docs[0].data());
        }

        // 6. Call Gemini
        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({ error: "Gemini API Key not configured" }, { status: 500 });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const prompt = `
      You are a specialized Meta Ads growth engineer. 
      Analyze the following diagnostic summary for the ad account "${summary.account.name}".
      The user goal is ${summary.account.goal} with a target CPA of $${summary.account.targetCpa}.
      
      DATA SUMMARY:
      ${JSON.stringify(summary, null, 2)}
      
      INSTRUCTIONS:
      1. Provide a professional diagnosis of the current state.
      2. Group issues by probability and impact.
      3. Suggest specific actions for the next 72 hours.
      4. List questions for the user to confirm technical setup.
      
      OUTPUT FORMAT (JSON ONLY):
      {
        "analysis": {
          "diagnosis": ["bullet 1", "bullet 2"],
          "hypotheses": [
            { "title": "...", "probability": "low|medium|high", "reasoning": "..." }
          ],
          "actions_next_72h": [
            { "action": "...", "priority": "critical|high|medium", "expected_impact": "..." }
          ],
          "questions_to_confirm": ["question 1"]
        }
      }
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Clean potential markdown wrap
        const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const analysis = JSON.parse(jsonStr);

        const fullReport = {
            accountId,
            digest,
            summary,
            analysis: analysis.analysis,
            createdAt: new Date().toISOString()
        };

        // 7. Store in Cache
        await db.collection("llm_reports").add(fullReport);

        return NextResponse.json(fullReport);

    } catch (error: any) {
        console.error("Gemini Report Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
