/**
 * GHL Webhook Endpoint — Receives leads from GoHighLevel
 *
 * POST /api/webhooks/ghl?secret=XXX&locationId=YYY
 *
 * Auth: query param `secret` matched against client's `ghlWebhookSecret`
 * or global `GHL_WEBHOOK_SECRET` env var.
 *
 * Upserts lead records to the `leads` Firestore collection.
 * Always returns 200 to avoid GHL retry storms.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { Lead, GHLWebhookPayload } from "@/types/leads";

export async function POST(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const secret = url.searchParams.get("secret");
        const locationIdParam = url.searchParams.get("locationId");

        // Parse body
        const body = (await request.json()) as GHLWebhookPayload;
        const locationId = body.location_id || locationIdParam;

        if (!locationId) {
            console.warn("[GHL Webhook] No location_id in body or query params");
            return NextResponse.json({ ok: true, warning: "no_location_id" });
        }

        // Find client by ghlLocationId
        const clientsSnap = await db.collection("clients")
            .where("ghlLocationId", "==", locationId)
            .where("active", "==", true)
            .limit(1)
            .get();

        if (clientsSnap.empty) {
            console.warn(`[GHL Webhook] No active client found for locationId: ${locationId}`);
            // Log event but don't fail — could be an unconfigured location
            return NextResponse.json({ ok: true, warning: "client_not_found" });
        }

        const clientDoc = clientsSnap.docs[0];
        const client = clientDoc.data();
        const clientId = clientDoc.id;

        // Verify secret
        const expectedSecret = client.ghlWebhookSecret || process.env.GHL_WEBHOOK_SECRET;
        if (expectedSecret && secret !== expectedSecret) {
            console.warn(`[GHL Webhook] Invalid secret for client ${clientId}`);
            return NextResponse.json({ error: "invalid_secret" }, { status: 401 });
        }

        // Normalize contact name
        const name = body.name
            || [body.first_name, body.last_name].filter(Boolean).join(" ")
            || "Sin nombre";

        // Extract UTMs
        const utm = (body.utm_source || body.utm_campaign || body.utm_medium || body.utm_content || body.utm_term)
            ? {
                source: body.utm_source || undefined,
                medium: body.utm_medium || undefined,
                campaign: body.utm_campaign || undefined,
                content: body.utm_content || undefined,
                term: body.utm_term || undefined,
            }
            : undefined;

        const now = new Date().toISOString();
        const ghlContactId = body.contact_id;

        // Build lead document
        const leadData: Omit<Lead, "id"> = {
            clientId,
            name,
            email: body.email || undefined,
            phone: body.phone || undefined,
            country: body.country || undefined,
            calendarType: body.calendar_name || undefined,
            scheduledDate: body.start_time || undefined,
            confirmationStatus: body.appointment_status || undefined,
            closerAssigned: body.assigned_to || undefined,
            utm,
            qualification: "pending",
            qualityScore: null,
            attendance: null,
            postCallStatus: "pendiente",
            revenue: 0,
            source: "ghl_webhook",
            ghlContactId: ghlContactId || undefined,
            ghlLocationId: locationId,
            createdAt: now,
            updatedAt: now,
        };

        // Upsert: if same contact already exists for this client, update instead of creating duplicate
        let docRef;
        if (ghlContactId) {
            const existingSnap = await db.collection("leads")
                .where("clientId", "==", clientId)
                .where("ghlContactId", "==", ghlContactId)
                .limit(1)
                .get();

            if (!existingSnap.empty) {
                // Update existing — preserve qualification fields if already set
                const existingDoc = existingSnap.docs[0];
                const existing = existingDoc.data() as Lead;
                docRef = existingDoc.ref;

                await docRef.update({
                    // Update contact/scheduling info (GHL may resend with updates)
                    name: leadData.name,
                    email: leadData.email,
                    phone: leadData.phone,
                    country: leadData.country,
                    calendarType: leadData.calendarType || existing.calendarType,
                    scheduledDate: leadData.scheduledDate || existing.scheduledDate,
                    confirmationStatus: leadData.confirmationStatus || existing.confirmationStatus,
                    closerAssigned: leadData.closerAssigned || existing.closerAssigned,
                    utm: leadData.utm || existing.utm,
                    updatedAt: now,
                });

                console.log(`[GHL Webhook] Updated existing lead ${docRef.id} for client ${clientId}`);
            } else {
                // Create new
                docRef = await db.collection("leads").add(leadData);
                console.log(`[GHL Webhook] Created lead ${docRef.id} for client ${clientId} (contact: ${ghlContactId})`);
            }
        } else {
            // No contact ID — always create new
            docRef = await db.collection("leads").add(leadData);
            console.log(`[GHL Webhook] Created lead ${docRef.id} for client ${clientId} (no contact ID)`);
        }

        return NextResponse.json({ ok: true, leadId: docRef.id });
    } catch (error: unknown) {
        console.error("[GHL Webhook] Error processing webhook:", error);
        // Always return 200 to prevent GHL retry storms
        return NextResponse.json({ ok: true, error: "internal_error" });
    }
}
