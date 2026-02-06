import { db } from "@/lib/firebase-admin";
import { getAdminStatus } from "@/lib/server-utils";
import { NextRequest, NextResponse } from "next/server";

// POST /api/admin/prompts/activate -> set status active
export async function POST(request: NextRequest) {
    const { isAdmin } = await getAdminStatus(request);
    if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { id } = await request.json();
        if (!id) return NextResponse.json({ error: "Missing prompt ID" }, { status: 400 });

        const promptRef = db.collection("prompt_templates").doc(id);
        const promptDoc = await promptRef.get();

        if (!promptDoc.exists) return NextResponse.json({ error: "Prompt not found" }, { status: 404 });

        const { key } = promptDoc.data()!;

        // Use transaction to ensure only one active
        await db.runTransaction(async (transaction) => {
            // 1. Archive current active
            const activeSnapshot = await transaction.get(
                db.collection("prompt_templates")
                    .where("key", "==", key)
                    .where("status", "==", "active")
            );

            activeSnapshot.forEach(doc => {
                transaction.update(doc.ref, { status: "archived", updatedAt: new Date().toISOString() });
            });

            // 2. Activate selected
            transaction.update(promptRef, { status: "active", updatedAt: new Date().toISOString() });
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
