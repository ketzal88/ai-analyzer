import { db } from "@/lib/firebase-admin";
import { getAdminStatus } from "@/lib/server-utils";
import { PromptTemplate } from "@/types";
import { NextRequest, NextResponse } from "next/server";

// GET /api/admin/prompts?key=report
export async function GET(request: NextRequest) {
    const { isAdmin } = await getAdminStatus(request);
    if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const key = request.nextUrl.searchParams.get("key") || "report";

    try {
        const snapshot = await db.collection("prompt_templates")
            .where("key", "==", key)
            .get();

        const prompts = snapshot.docs
            .map(doc => {
                const data = doc.data();
                return { ...data, id: doc.id } as PromptTemplate;
            })
            .sort((a, b) => b.version - a.version);

        return NextResponse.json(prompts);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST /api/admin/prompts -> create draft
export async function POST(request: NextRequest) {
    const { isAdmin, uid } = await getAdminStatus(request);
    if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await request.json();
        const { key, system, userTemplate, variables, outputSchemaVersion, criticalInstructions, outputSchema } = body;

        if (!userTemplate.includes("{{summary_json}}")) {
            return NextResponse.json({ error: "userTemplate must include {{summary_json}}" }, { status: 400 });
        }

        // Validate prompt size
        if (system.length > 20000 || userTemplate.length > 20000) {
            return NextResponse.json({ error: "Prompt too large (max 20k chars)" }, { status: 400 });
        }

        if (criticalInstructions && criticalInstructions.length > 10000) {
            return NextResponse.json({ error: "Critical instructions too large (max 10k chars)" }, { status: 400 });
        }

        if (outputSchema && outputSchema.length > 5000) {
            return NextResponse.json({ error: "Output schema too large (max 5k chars)" }, { status: 400 });
        }

        // Get latest version (in-memory sort to avoid index)
        const allVersions = await db.collection("prompt_templates")
            .where("key", "==", key)
            .get();

        let newVersion = 1;
        if (!allVersions.empty) {
            const versions = allVersions.docs.map(doc => doc.data().version as number);
            newVersion = Math.max(...versions) + 1;
        }

        const newPrompt: Omit<PromptTemplate, "id"> = {
            key,
            version: newVersion,
            status: "draft",
            system,
            userTemplate,
            variables: variables || ["summary_json"],
            outputSchemaVersion: outputSchemaVersion || "v1",
            ...(criticalInstructions && { criticalInstructions }),
            ...(outputSchema && { outputSchema }),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdByUid: uid!
        };

        const docRef = await db.collection("prompt_templates").add(newPrompt);
        return NextResponse.json({ id: docRef.id, ...newPrompt });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
