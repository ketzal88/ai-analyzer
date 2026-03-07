# GA4 API Implementation Patterns

## Setting Up the OAuth2 Client

```typescript
import { google } from "googleapis";

function getOAuth2Client() {
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error("GA4 requires Google OAuth credentials.");
    }

    const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
    oauth2.setCredentials({ refresh_token: refreshToken });
    return oauth2;
}
```

**Important**: Reuses the same env vars as Google Ads. The refresh token must have `analytics.readonly` scope.

## Creating API Instances

```typescript
// Data API — for running reports
const dataApi = google.analyticsdata({ version: "v1beta", auth: getOAuth2Client() });

// Admin API — for listing properties
const adminApi = google.analyticsadmin({ version: "v1beta", auth: getOAuth2Client() });
```

## Running a Report

```typescript
const res = await dataApi.properties.runReport({
    property: "properties/123456789",  // Always "properties/" prefix
    requestBody: {
        dateRanges: [{ startDate: "2025-01-01", endDate: "2025-01-31" }],
        dimensions: [{ name: "date" }],
        metrics: [
            { name: "sessions" },
            { name: "totalUsers" },
            { name: "bounceRate" },
        ],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: "20",  // MUST be string
    },
});

const rows = res.data.rows || [];
for (const row of rows) {
    const date = row.dimensionValues?.[0]?.value || "";        // "20250115"
    const sessions = parseInt(row.metricValues?.[0]?.value || "0", 10);
    const users = parseInt(row.metricValues?.[1]?.value || "0", 10);
    const bounceRate = parseFloat(row.metricValues?.[2]?.value || "0") * 100; // 0.43 → 43%
}
```

## Normalizing Property ID

```typescript
function normalizePropertyId(propertyId: string): string {
    if (propertyId.startsWith("properties/")) return propertyId;
    return `properties/${propertyId}`;
}
```

We store property IDs as plain numbers (`"123456789"`) in Firestore but API requires the `"properties/"` prefix.

## Converting GA4 Dates

```typescript
// GA4 returns "20250115" → we need "2025-01-15"
const raw = row.dimensionValues?.[0]?.value || "";
const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
```

## Parallel Data Fetching

Our sync fetches 5 different reports in parallel:

```typescript
const [coreRows, funnelRows, trafficSources, landingPages, deviceBreakdown] = await Promise.all([
    GA4Service.fetchCoreMetrics(propertyId, startDate, endDate),
    GA4Service.fetchEcommerceFunnel(propertyId, startDate, endDate).catch(() => []),
    GA4Service.fetchTrafficSources(propertyId, startDate, endDate).catch(() => []),
    GA4Service.fetchLandingPages(propertyId, startDate, endDate).catch(() => []),
    GA4Service.fetchDeviceBreakdown(propertyId, startDate, endDate).catch(() => []),
]);
```

**Note**: Ecommerce funnel, traffic sources, landing pages, and device breakdowns use `.catch(() => [])` — graceful fallback if the property doesn't have those features configured.

## Listing All Accessible Properties

```typescript
const admin = google.analyticsadmin({ version: "v1beta", auth });
const properties: { propertyId: string; displayName: string; accountName: string }[] = [];

let pageToken: string | undefined;
do {
    const res = await admin.accountSummaries.list({
        pageSize: 200,
        pageToken,
    });

    for (const account of res.data.accountSummaries || []) {
        const accountName = account.displayName || "Unknown";
        for (const ps of account.propertySummaries || []) {
            const rawId = ps.property?.replace("properties/", "") || "";
            if (rawId) {
                properties.push({
                    propertyId: rawId,
                    displayName: ps.displayName || rawId,
                    accountName,
                });
            }
        }
    }
    pageToken = res.data.nextPageToken || undefined;
} while (pageToken);
```

Used by the ClientForm dropdown to show all available GA4 properties.

## Writing to Firestore

```typescript
const batch = db.batch();

for (const agg of dailyAggregates) {
    const docId = buildChannelSnapshotId(clientId, 'GA4', agg.date);
    // → "{clientId}__GA4__2025-01-15"

    const snapshot: ChannelDailySnapshot = {
        clientId,
        channel: 'GA4',
        date: agg.date,
        metrics: agg.metrics,
        rawData: {
            source: 'ga4',
            trafficSources: agg.trafficSources,
            topLandingPages: agg.topLandingPages,
            deviceBreakdown: agg.deviceBreakdown,
        },
        syncedAt: new Date().toISOString(),
    };

    batch.set(db.collection('channel_snapshots').doc(docId), snapshot, { merge: true });
}

await batch.commit(); // Max 500 ops per batch
```

## Weighted Average for Period Aggregation

When aggregating bounce rate and avg session duration across multiple days, use **weighted average by sessions** (not simple average):

```typescript
const totalBounce = snapshots.reduce((s, x) =>
    s + (x.metrics.bounceRate || 0) * (x.metrics.sessions || 0), 0);
const bounceRate = totalSessions > 0 ? totalBounce / totalSessions : 0;
```

This is used in `OverviewDashboard.tsx` when computing period-level summaries.

## Error Handling

| Error | Cause | Fix |
|---|---|---|
| 403 Forbidden | Missing `analytics.readonly` scope | Regenerate refresh token with all scopes |
| 404 Not Found | Invalid property ID | Verify property exists in GA4 Admin |
| 429 Too Many Requests | Rate limit exceeded | Exponential backoff |
| `(not set)` in dimension values | Dimension not available for that traffic | Normal — treat as "unknown" |
| Empty `rows` (undefined) | No data for date range | Always default to `res.data.rows \|\| []` |

## gRPC vs REST — Why We Use googleapis

**Do NOT use** `@google-analytics/data` or `@google-analytics/admin` (gRPC packages). They have a known incompatibility with `OAuth2Client` from `google-auth-library`:

```
TypeError: headers.forEach is not a function
```

The gRPC transport expects plain header objects but `OAuth2Client` returns `Headers` instances. Using the `googleapis` REST package avoids this entirely.

## Token Generation Script

If the refresh token needs new scopes:

```bash
npx tsx scripts/generate-google-refresh-token.ts
```

1. Opens browser for OAuth consent
2. User authorizes with analytics + ads scopes
3. Local server on port 3456 catches callback
4. Prints new refresh token to console
5. Update `GOOGLE_ADS_REFRESH_TOKEN` in `.env.local` and Vercel

**Requires**: `http://localhost:3456/oauth2callback` as authorized redirect URI in Google Cloud Console.

## Complete Data Flow

```
Cron (/api/cron/sync-ga4)
  → iterates active clients with integraciones.ga4 = true
  → GA4Service.syncToChannelSnapshots(clientId, propertyId, yesterday, yesterday)
    → fetchCoreMetrics()          — sessions, users, bounce, duration
    → fetchEcommerceFunnel()      — view_item → cart → checkout → purchase
    → fetchTrafficSources()       — top 20 by sessions
    → fetchLandingPages()         — top 15 by sessions
    → fetchDeviceBreakdown()      — desktop/mobile/tablet
    → aggregateByDay()            — merge core + funnel + raw breakdowns
    → batch.set() to channel_snapshots (channel: 'GA4')
```