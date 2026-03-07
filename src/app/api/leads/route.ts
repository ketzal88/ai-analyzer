/**
 * Leads API — List and create lead records
 *
 * GET  /api/leads?clientId=X&startDate=Y&endDate=Z&closer=N&qualification=S&limit=50&offset=0
 * POST /api/leads (manual lead creation)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { Lead } from "@/types/leads";

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const clientId = url.searchParams.get("clientId");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const closer = url.searchParams.get("closer");
    const qualification = url.searchParams.get("qualification");
    const postCallStatus = url.searchParams.get("postCallStatus");
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    if (!clientId) {
        return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    }

    try {
        let query: FirebaseFirestore.Query = db.collection("leads")
            .where("clientId", "==", clientId)
            .orderBy("createdAt", "desc");

        if (startDate) {
            query = query.where("createdAt", ">=", `${startDate}T00:00:00.000Z`);
        }
        if (endDate) {
            query = query.where("createdAt", "<=", `${endDate}T23:59:59.999Z`);
        }

        const snap = await query.get();

        let leads: Lead[] = snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as Lead[];

        // Client-side filters (Firestore doesn't support multiple inequality fields)
        if (closer) {
            leads = leads.filter((l) => l.closerAssigned === closer);
        }
        if (qualification) {
            leads = leads.filter((l) => l.qualification === qualification);
        }
        if (postCallStatus) {
            leads = leads.filter((l) => l.postCallStatus === postCallStatus);
        }

        const total = leads.length;
        const paginated = leads.slice(offset, offset + limit);

        return NextResponse.json({ leads: paginated, total });
    } catch (error: unknown) {
        console.error("[Leads API] Error listing leads:", error);
        return NextResponse.json({ error: "Failed to list leads" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        if (!body.clientId || !body.name) {
            return NextResponse.json({ error: "clientId and name are required" }, { status: 400 });
        }

        const now = new Date().toISOString();
        const leadData: Omit<Lead, "id"> = {
            clientId: body.clientId,
            name: body.name,
            email: body.email || undefined,
            phone: body.phone || undefined,
            country: body.country || undefined,
            calendarType: body.calendarType || undefined,
            scheduledDate: body.scheduledDate || undefined,
            confirmationStatus: body.confirmationStatus || undefined,
            closerAssigned: body.closerAssigned || undefined,
            utm: body.utm || undefined,
            qualification: body.qualification || "pending",
            qualityScore: body.qualityScore ?? null,
            attendance: body.attendance ?? null,
            postCallStatus: body.postCallStatus || "pendiente",
            revenue: body.revenue || 0,
            closerComments: body.closerComments || undefined,
            source: body.source || "manual",
            ghlContactId: body.ghlContactId || undefined,
            ghlLocationId: body.ghlLocationId || undefined,
            createdAt: body.createdAt || now,
            updatedAt: now,
        };

        const docRef = await db.collection("leads").add(leadData);

        return NextResponse.json({ id: docRef.id, ...leadData });
    } catch (error: unknown) {
        console.error("[Leads API] Error creating lead:", error);
        return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
    }
}
