import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/firebase-admin";

/**
 * Shopify OAuth — Step 1: Redirect to Shopify authorization
 *
 * Two entry points:
 * 1. From ClientForm: GET ?shop=xxx&clientId=abc123
 * 2. From Shopify install: GET ?shop=xxx (no clientId) — looks up client by shop domain
 */
export async function GET(request: NextRequest) {
    const shop = request.nextUrl.searchParams.get("shop");
    let clientId = request.nextUrl.searchParams.get("clientId");

    if (!shop) {
        return NextResponse.json(
            { error: "Missing required parameter: shop" },
            { status: 400 }
        );
    }

    const clientID = process.env.SHOPIFY_CLIENT_ID;
    if (!clientID) {
        return NextResponse.json(
            { error: "SHOPIFY_CLIENT_ID not configured" },
            { status: 500 }
        );
    }

    // Sanitize shop domain
    const shopDomain = shop.includes(".myshopify.com")
        ? shop.replace(/^https?:\/\//, "")
        : `${shop}.myshopify.com`;

    // If no clientId provided (Shopify install flow), look up by shop domain
    if (!clientId) {
        const clientsSnap = await db.collection("clients")
            .where("shopifyStoreDomain", "==", shopDomain)
            .limit(1)
            .get();

        if (!clientsSnap.empty) {
            clientId = clientsSnap.docs[0].id;
        } else {
            // Try without the domain suffix
            const shopName = shopDomain.replace(".myshopify.com", "");
            const byNameSnap = await db.collection("clients")
                .where("shopifyStoreDomain", "==", shopName)
                .limit(1)
                .get();

            if (!byNameSnap.empty) {
                clientId = byNameSnap.docs[0].id;
            } else {
                // No client found — redirect to admin to create/link one
                const host = request.headers.get("host") || "localhost:3000";
                const protocol = host.includes("localhost") ? "http" : "https";
                return NextResponse.redirect(
                    `${protocol}://${host}/admin/clients?shopify_pending=${encodeURIComponent(shopDomain)}`
                );
            }
        }
    }

    // Generate nonce for CSRF protection
    const nonce = crypto.randomBytes(16).toString("hex");

    // State encodes clientId + nonce for verification in callback
    const state = Buffer.from(JSON.stringify({ clientId, nonce })).toString("base64url");

    const scopes = "read_orders,read_products,read_analytics";

    // Determine redirect URI based on environment
    const host = request.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const redirectUri = `${protocol}://${host}/api/integrations/shopify/callback`;

    const authUrl = `https://${shopDomain}/admin/oauth/authorize?client_id=${clientID}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    return NextResponse.redirect(authUrl);
}
