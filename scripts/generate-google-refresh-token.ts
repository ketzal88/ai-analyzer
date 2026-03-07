/**
 * Generate Google OAuth Refresh Token with Analytics + Ads scopes
 *
 * Run: npx tsx scripts/generate-google-refresh-token.ts
 *
 * This opens a browser for Google login. After authorizing, it prints
 * the new refresh token to paste into .env.local as GOOGLE_ADS_REFRESH_TOKEN.
 *
 * Scopes included:
 * - Google Ads API (existing)
 * - Google Analytics Data API (read-only)
 * - Google Analytics Admin API (read-only, for listing properties)
 */

import * as http from "http";
import { OAuth2Client } from "google-auth-library";

// Load env
require("./load-env.cjs");

const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error("Missing GOOGLE_ADS_CLIENT_ID or GOOGLE_ADS_CLIENT_SECRET in .env.local");
    process.exit(1);
}

const REDIRECT_URI = "http://localhost:3456/oauth2callback";

const SCOPES = [
    "https://www.googleapis.com/auth/adwords",                          // Google Ads
    "https://www.googleapis.com/auth/analytics.readonly",               // GA4 Data API
    "https://www.googleapis.com/auth/analytics.manage.users.readonly",  // GA4 Admin (list properties)
];

async function main() {
    const oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",   // Force new refresh token
        scope: SCOPES,
    });

    console.log("\n=== Google OAuth Refresh Token Generator ===\n");
    console.log("Opening browser for authorization...\n");
    console.log("If the browser doesn't open, visit this URL:\n");
    console.log(authUrl);
    console.log("\n");

    // Open browser
    const { exec } = require("child_process");
    const openCmd = process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open";
    exec(`${openCmd} "${authUrl}"`);

    // Start local server to catch the callback
    return new Promise<void>((resolve) => {
        const server = http.createServer(async (req, res) => {
            if (!req.url?.startsWith("/oauth2callback")) return;

            const url = new URL(req.url, `http://localhost:3456`);
            const code = url.searchParams.get("code");

            if (!code) {
                res.end("Error: no code received");
                server.close();
                resolve();
                return;
            }

            try {
                const { tokens } = await oauth2Client.getToken(code);

                res.writeHead(200, { "Content-Type": "text/html" });
                res.end("<h1>Success! You can close this tab.</h1><p>Check your terminal for the refresh token.</p>");

                console.log("\n✅ Authorization successful!\n");
                console.log("========================================");
                console.log("REFRESH TOKEN (paste into .env.local):");
                console.log("========================================\n");
                console.log(`GOOGLE_ADS_REFRESH_TOKEN=${tokens.refresh_token}\n`);
                console.log("========================================\n");

                if (tokens.scope) {
                    console.log("Authorized scopes:", tokens.scope);
                }
            } catch (err: any) {
                res.end(`Error: ${err.message}`);
                console.error("Token exchange failed:", err.message);
            }

            server.close();
            resolve();
        });

        server.listen(3456, () => {
            console.log("Waiting for authorization callback on http://localhost:3456 ...\n");
        });
    });
}

main().catch(console.error);
