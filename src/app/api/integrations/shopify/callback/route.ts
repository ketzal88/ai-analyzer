import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/firebase-admin";

/**
 * Shopify OAuth — Step 2: Exchange code for permanent access token
 *
 * Shopify redirects here with ?code=xxx&hmac=xxx&shop=xxx&state=xxx
 * We verify the HMAC, exchange the code, and store the token in Firestore.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const code = searchParams.get("code");
    const shop = searchParams.get("shop");
    const hmac = searchParams.get("hmac");
    const state = searchParams.get("state");

    if (!code || !shop || !hmac || !state) {
        return NextResponse.json(
            { error: "Missing required OAuth parameters" },
            { status: 400 }
        );
    }

    const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
    const clientID = process.env.SHOPIFY_CLIENT_ID;

    if (!clientSecret || !clientID) {
        return NextResponse.json(
            { error: "Shopify credentials not configured" },
            { status: 500 }
        );
    }

    // ── 1. Verify HMAC ─────────────────────────────
    const params = new URLSearchParams();
    for (const [key, value] of searchParams.entries()) {
        if (key !== "hmac") {
            params.append(key, value);
        }
    }
    // Sort params alphabetically
    const sortedParams = new URLSearchParams([...params.entries()].sort());
    const message = sortedParams.toString();
    const generatedHmac = crypto
        .createHmac("sha256", clientSecret)
        .update(message)
        .digest("hex");

    if (!crypto.timingSafeEqual(Buffer.from(generatedHmac, "hex"), Buffer.from(hmac, "hex"))) {
        return NextResponse.json(
            { error: "HMAC verification failed" },
            { status: 403 }
        );
    }

    // ── 2. Decode state to get clientId ─────────────
    let clientId: string;
    try {
        const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
        clientId = decoded.clientId;
        if (!clientId) throw new Error("No clientId in state");
    } catch {
        return NextResponse.json(
            { error: "Invalid state parameter" },
            { status: 400 }
        );
    }

    // ── 3. Exchange code for permanent token ────────
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            client_id: clientID,
            client_secret: clientSecret,
            code,
        }),
    });

    if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("[Shopify OAuth] Token exchange failed:", errorText);
        return NextResponse.json(
            { error: "Failed to exchange authorization code" },
            { status: 502 }
        );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
        return NextResponse.json(
            { error: "No access_token in Shopify response" },
            { status: 502 }
        );
    }

    // ── 4. Save to Firestore ────────────────────────
    const clientRef = db.collection("clients").doc(clientId);
    await clientRef.update({
        shopifyStoreDomain: shop,
        shopifyAccessToken: accessToken,
        "integraciones.ecommerce": "shopify",
        updatedAt: new Date().toISOString(),
    });

    // Read slug for redirect
    const clientDoc = await clientRef.get();
    const slug = clientDoc.data()?.slug || clientId;

    console.log(`[Shopify OAuth] Token saved for client ${clientId} (${shop})`);

    // ── 5. Redirect back to client edit page ────────
    const host = request.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";

    return NextResponse.redirect(
        `${protocol}://${host}/admin/clients/${slug}?shopify=connected`
    );
}
