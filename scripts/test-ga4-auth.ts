/**
 * Quick test: check if current Google OAuth credentials work for GA4
 * Run: npx tsx scripts/test-ga4-auth.ts
 */

require("./load-env.cjs");

import { google } from "googleapis";

async function main() {
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        console.error("Missing GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, or GOOGLE_ADS_REFRESH_TOKEN");
        process.exit(1);
    }

    console.log("Testing GA4 auth with existing Google Ads OAuth credentials...\n");

    const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
    oauth2.setCredentials({ refresh_token: refreshToken });

    try {
        // Try listing GA4 account summaries via REST API
        const admin = google.analyticsadmin({ version: "v1beta", auth: oauth2 });

        const res = await admin.accountSummaries.list({ pageSize: 200 });
        const accounts = res.data.accountSummaries || [];

        let totalProps = 0;
        for (const account of accounts) {
            const props = account.propertySummaries || [];
            console.log(`  Account: ${account.displayName} (${props.length} properties)`);
            for (const p of props.slice(0, 3)) {
                console.log(`    → ${p.displayName} (${p.property})`);
            }
            if (props.length > 3) console.log(`    ... and ${props.length - 3} more`);
            totalProps += props.length;
        }

        console.log(`\n✅ GA4 auth works! Found ${totalProps} properties across ${accounts.length} accounts.\n`);
        console.log("No need to regenerate the refresh token.");
    } catch (err: any) {
        const status = err?.response?.status || err?.code;
        const msg = err?.response?.data?.error?.message || err.message;

        if (status === 403 || msg?.includes("insufficient")) {
            console.error("\n❌ Current refresh token does NOT have analytics scope.");
            console.error("Run: npx tsx scripts/generate-google-refresh-token.ts");
            console.error("to generate a new one with the required scopes.\n");
        } else {
            console.error(`\n❌ Error (${status}):`, msg);
        }
    }
}

main();
