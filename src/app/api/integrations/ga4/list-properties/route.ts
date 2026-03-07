/**
 * GA4 List Properties API
 *
 * GET /api/integrations/ga4/list-properties
 * Returns all GA4 properties accessible via the shared Google OAuth credentials.
 * Used by ClientForm to populate the property selector dropdown.
 */

import { NextResponse } from "next/server";
import { google } from "googleapis";

interface GA4PropertyOption {
    propertyId: string;       // e.g. "123456789"
    displayName: string;      // e.g. "Mi Tienda Online"
    accountName: string;      // e.g. "Worker Agency"
}

function getOAuth2Client() {
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error("Google OAuth credentials not configured");
    }

    const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
    oauth2.setCredentials({ refresh_token: refreshToken });
    return oauth2;
}

export async function GET() {
    try {
        const auth = getOAuth2Client();
        const admin = google.analyticsadmin({ version: "v1beta", auth });

        const properties: GA4PropertyOption[] = [];

        // Fetch all account summaries (paginated)
        let pageToken: string | undefined;
        do {
            const res = await admin.accountSummaries.list({
                pageSize: 200,
                pageToken,
            });

            for (const account of res.data.accountSummaries || []) {
                const accountName = account.displayName || account.account || "Unknown";

                for (const ps of account.propertySummaries || []) {
                    const rawId = ps.property?.replace("properties/", "") || "";
                    if (!rawId) continue;

                    properties.push({
                        propertyId: rawId,
                        displayName: ps.displayName || rawId,
                        accountName,
                    });
                }
            }

            pageToken = res.data.nextPageToken || undefined;
        } while (pageToken);

        properties.sort((a, b) =>
            a.accountName.localeCompare(b.accountName) || a.displayName.localeCompare(b.displayName)
        );

        return NextResponse.json(properties);
    } catch (err: any) {
        console.error("[GA4 List Properties]", err.message);
        return NextResponse.json(
            { error: err.message, properties: [] },
            { status: err.message.includes("not configured") ? 501 : 500 }
        );
    }
}
