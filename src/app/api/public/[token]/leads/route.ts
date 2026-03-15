/**
 * Public Leads API — Token-authenticated access for clients
 *
 * GET   /api/public/:token/leads?startDate=X&endDate=Y&closer=N&qualification=S
 * PATCH /api/public/:token/leads  { leadId, updates }
 *
 * No session required — validated via public_tokens collection (type='crm').
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { PublicToken } from "@/types";
import { Lead } from "@/types/leads";

/** Validate a CRM token. Returns clientId on success, NextResponse on failure. */
async function validateCrmToken(token: string): Promise<{ clientId: string } | NextResponse> {
    const tokenDoc = await db.collection("public_tokens").doc(token).get();
    if (!tokenDoc.exists) {
        return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }

    const tokenData = tokenDoc.data() as PublicToken;

    if (!tokenData.active) {
        return NextResponse.json({ error: "Token revoked" }, { status: 403 });
    }

    if (tokenData.expiresAt && new Date(tokenData.expiresAt) < new Date()) {
        return NextResponse.json({ error: "Token expired" }, { status: 403 });
    }

    if (tokenData.type !== "crm") {
        return NextResponse.json({ error: "Token is not a CRM token" }, { status: 403 });
    }

    // Update access stats (fire and forget)
    db.collection("public_tokens").doc(token).update({
        accessCount: (tokenData.accessCount || 0) + 1,
        lastAccessedAt: new Date().toISOString(),
    }).catch(() => {});

    return { clientId: tokenData.clientId };
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> },
) {
    const { token } = await params;

    try {
        const result = await validateCrmToken(token);
        if (result instanceof NextResponse) return result;
        const { clientId } = result;

        const url = new URL(request.url);
        const startDate = url.searchParams.get("startDate");
        const endDate = url.searchParams.get("endDate");
        const closer = url.searchParams.get("closer");
        const qualification = url.searchParams.get("qualification");
        const postCallStatus = url.searchParams.get("postCallStatus");

        // Base query
        let query: FirebaseFirestore.Query = db.collection("leads")
            .where("clientId", "==", clientId)
            .orderBy("createdAt", "desc");

        if (startDate) {
            query = query.where("createdAt", ">=", `${startDate}T00:00:00.000Z`);
        }
        if (endDate) {
            query = query.where("createdAt", "<=", `${endDate}T23:59:59.999Z`);
        }

        let snap;
        try {
            snap = await query.get();
        } catch (queryError: any) {
            const msg = queryError?.message || queryError?.details || String(queryError);
            if (msg.includes("index") || msg.includes("requires an index")) {
                const fallback = await db.collection("leads")
                    .where("clientId", "==", clientId)
                    .get();
                snap = fallback;
            } else {
                throw queryError;
            }
        }

        let leads: Lead[] = snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as Lead[];

        // Client-side filters
        if (startDate) leads = leads.filter((l) => l.createdAt >= `${startDate}T00:00:00.000Z`);
        if (endDate) leads = leads.filter((l) => l.createdAt <= `${endDate}T23:59:59.999Z`);
        if (closer) leads = leads.filter((l) => l.closerAssigned === closer);
        if (qualification) leads = leads.filter((l) => l.qualification === qualification);
        if (postCallStatus) leads = leads.filter((l) => l.postCallStatus === postCallStatus);

        leads.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

        // Load client config for closers list and mode
        const clientDoc = await db.collection("clients").doc(clientId).get();
        const clientData = clientDoc.exists ? clientDoc.data() : null;

        return NextResponse.json({
            leads,
            total: leads.length,
            config: {
                closers: clientData?.leadsConfig?.closers || [],
                mode: clientData?.leadsConfig?.mode || "full_funnel",
                clientName: clientData?.name || "",
            },
        });
    } catch (error: any) {
        console.error("[Public Leads API] Error listing leads:", error?.message || String(error));
        return NextResponse.json({ error: "Failed to list leads" }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> },
) {
    const { token } = await params;

    try {
        const result = await validateCrmToken(token);
        if (result instanceof NextResponse) return result;
        const { clientId } = result;

        const body = await request.json();
        const { leadId, updates } = body as { leadId: string; updates: Record<string, unknown> };

        if (!leadId || !updates) {
            return NextResponse.json({ error: "leadId and updates are required" }, { status: 400 });
        }

        // Verify lead belongs to this client
        const docRef = db.collection("leads").doc(leadId);
        const doc = await docRef.get();

        if (!doc.exists) {
            return NextResponse.json({ error: "Lead not found" }, { status: 404 });
        }

        const lead = doc.data() as Lead;
        if (lead.clientId !== clientId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Whitelist of editable fields
        const allowedFields = [
            "qualification",
            "qualityScore",
            "attendance",
            "postCallStatus",
            "revenue",
            "closerComments",
            "closerAssigned",
        ];

        const now = new Date().toISOString();
        const safeUpdates: Record<string, unknown> = { updatedAt: now };

        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                safeUpdates[field] = updates[field];
            }
        }

        // Auto-set qualifiedAt
        if (updates.qualification && updates.qualification !== "pending") {
            safeUpdates.qualifiedAt = now;
        }

        await docRef.update(safeUpdates);

        return NextResponse.json({ id: leadId, ...safeUpdates });
    } catch (error: any) {
        console.error("[Public Leads API] Error updating lead:", error?.message || String(error));
        return NextResponse.json({ error: "Failed to update lead" }, { status: 500 });
    }
}
