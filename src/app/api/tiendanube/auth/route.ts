/**
 * Tienda Nube OAuth Callback
 *
 * When a merchant installs the app, Tienda Nube redirects here with a `code`.
 * We exchange it for an access_token + user_id (store_id), then store in Firestore.
 *
 * Flow:
 * 1. Merchant clicks "Aceptar" on install screen
 * 2. Tienda Nube redirects to this URL with ?code=XXXXX
 * 3. We POST to /apps/authorize/token to exchange code → token
 * 4. Save tiendanubeStoreId + tiendanubeAccessToken to the client doc
 * 5. Redirect to success page
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

const TIENDANUBE_APP_ID = process.env.TIENDANUBE_APP_ID;
const TIENDANUBE_CLIENT_SECRET = process.env.TIENDANUBE_CLIENT_SECRET;

export async function GET(request: NextRequest) {
    const code = request.nextUrl.searchParams.get("code");

    if (!code) {
        return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
    }

    if (!TIENDANUBE_APP_ID || !TIENDANUBE_CLIENT_SECRET) {
        console.error("[TiendaNube Auth] Missing TIENDANUBE_APP_ID or TIENDANUBE_CLIENT_SECRET");
        return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    try {
        // Exchange code for access token
        const tokenResponse = await fetch("https://www.tiendanube.com/apps/authorize/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: TIENDANUBE_APP_ID,
                client_secret: TIENDANUBE_CLIENT_SECRET,
                grant_type: "authorization_code",
                code,
            }),
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error(`[TiendaNube Auth] Token exchange failed: ${tokenResponse.status} ${errorText}`);
            return NextResponse.json({
                error: "Token exchange failed",
                detail: errorText,
                status: tokenResponse.status,
            }, { status: 400 });
        }

        const tokenData = await tokenResponse.json();
        // tokenData = { access_token, token_type, scope, user_id }
        const { access_token, user_id, scope } = tokenData;

        console.log(`[TiendaNube Auth] Success! store_id=${user_id}, scope=${scope}`);

        // Try to find a client that already has this store ID, or log it for manual linking
        const existingSnap = await db.collection("clients")
            .where("tiendanubeStoreId", "==", String(user_id))
            .limit(1)
            .get();

        if (!existingSnap.empty) {
            // Update existing client with fresh token
            const clientDoc = existingSnap.docs[0];
            await clientDoc.ref.update({
                tiendanubeAccessToken: access_token,
                tiendanubeStoreId: String(user_id),
            });
            console.log(`[TiendaNube Auth] Updated client ${clientDoc.id} (${clientDoc.data().name})`);
        } else {
            // Store in a pending collection for manual linking
            await db.collection("tiendanube_auth_tokens").doc(String(user_id)).set({
                storeId: String(user_id),
                accessToken: access_token,
                scope,
                createdAt: new Date().toISOString(),
                linked: false,
            });
            console.log(`[TiendaNube Auth] Stored pending token for store ${user_id} — needs manual linking to a client`);
        }

        // Redirect to a success page
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
        return NextResponse.redirect(`${baseUrl}/api/tiendanube/auth/success?store_id=${user_id}`);

    } catch (error: any) {
        console.error("[TiendaNube Auth] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
