---
name: ga4-api
description: Specialized knowledge for Google Analytics 4 Data API (GA4) via googleapis REST package. Use when working with GA4 integrations, fetching web analytics metrics, ecommerce funnel data, traffic sources, landing pages, device breakdowns, or troubleshooting GA4 API errors and OAuth scope issues.
---

# GA4 (Google Analytics 4) API Expert

This skill provides comprehensive knowledge for interacting with the **GA4 Data API v1beta** and **GA4 Admin API v1beta** via the `googleapis` npm package (Google's official REST client).

## Core Concepts

- **GA4 Data API**: Fetches analytics reports (sessions, users, events, ecommerce).
- **GA4 Admin API**: Lists properties and account summaries (used for property selector).
- **Property ID**: Numeric ID (e.g., `"123456789"`). Internally normalized to `"properties/123456789"` for API calls.
- **Date Format**: GA4 returns dates as `YYYYMMDD` — must convert to `YYYY-MM-DD` for storage.
- **Metrics as Decimals**: `bounceRate` and `engagementRate` come as 0.0-1.0 decimals — multiply by 100 for percentages.
- **No Aggregation Server-Side**: GA4 API returns raw rows per dimension; aggregation is done client-side.

## Authentication

GA4 reuses the **same OAuth2 credentials** as Google Ads — zero additional env vars:

| Credential | Env Variable | Purpose |
|---|---|---|
| OAuth Client ID | `GOOGLE_ADS_CLIENT_ID` | OAuth2 app identifier |
| OAuth Client Secret | `GOOGLE_ADS_CLIENT_SECRET` | OAuth2 app secret |
| Refresh Token | `GOOGLE_ADS_REFRESH_TOKEN` | Must include `analytics.readonly` scope |

### OAuth Scope Requirements

The refresh token **must** have these scopes (regenerate with `scripts/generate-google-refresh-token.ts` if missing):

| Scope | Purpose |
|---|---|
| `https://www.googleapis.com/auth/analytics.readonly` | Read GA4 reports |
| `https://www.googleapis.com/auth/analytics.manage.users.readonly` | List accessible properties |
| `https://www.googleapis.com/auth/adwords` | Google Ads (shared token) |

### Common Auth Error

If the refresh token is missing analytics scopes, you'll get a **403 Forbidden** error. Fix: regenerate the token with all three scopes using the generate script.

### Why Not Service Account?

A Service Account requires being added as a user to **every** GA4 property individually. With 100+ client properties across 80+ accounts, OAuth2 with the user's existing permissions is the only practical approach.

## GA4 Data API — Report Queries

All queries use `api.properties.runReport()` with a `requestBody` object.

### Query Structure

```typescript
const api = google.analyticsdata({ version: "v1beta", auth: oauth2Client });

const res = await api.properties.runReport({
    property: "properties/123456789",
    requestBody: {
        dateRanges: [{ startDate: "2025-01-01", endDate: "2025-01-31" }],
        dimensions: [{ name: "date" }],
        metrics: [
            { name: "sessions" },
            { name: "totalUsers" },
        ],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: "20",  // STRING, not number!
    },
});

const rows = res.data.rows || [];
```

### Key Rules

1. **`limit` must be a string** — `"20"` not `20`. The googleapis REST API requires it.
2. **Response is in `res.data.rows`** — not destructured like gRPC packages.
3. **Dimensions are positional** — `row.dimensionValues[0]`, `row.dimensionValues[1]`, etc.
4. **Metrics are positional** — `row.metricValues[0]`, `row.metricValues[1]`, etc. in the order you requested them.
5. **Dates come as `YYYYMMDD`** — always convert: `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`.
6. **No wildcard queries** — you must list every metric/dimension explicitly.
7. **Max 10 metrics and 9 dimensions** per query. Split into multiple requests if needed.

## GA4 Admin API — Listing Properties

```typescript
const admin = google.analyticsadmin({ version: "v1beta", auth: oauth2Client });

const res = await admin.accountSummaries.list({
    pageSize: 200,
    pageToken: nextPageToken,
});

// res.data.accountSummaries[].propertySummaries[].property → "properties/123456789"
```

Used by `/api/integrations/ga4/list-properties` to populate the ClientForm dropdown.

## Available Metrics

### Core Web Analytics

| API Metric Name | Type | Gotchas |
|---|---|---|
| `sessions` | integer | Total sessions |
| `totalUsers` | integer | Unique users |
| `newUsers` | integer | First-time visitors |
| `screenPageViews` | integer | Total pageviews (GA4 name, not "pageviews") |
| `bounceRate` | decimal | **0.0-1.0** — multiply by 100 for percentage |
| `averageSessionDuration` | decimal | In seconds |
| `engagedSessions` | integer | Sessions > 10s or with conversions |
| `engagementRate` | decimal | **0.0-1.0** — multiply by 100 |
| `sessionsPerUser` | decimal | Average sessions per user |
| `screenPageViewsPerSession` | decimal | Pages per session |

### Ecommerce Funnel

| API Metric Name | Type | Description |
|---|---|---|
| `itemsViewed` | integer | Product detail views |
| `itemsAddedToCart` | integer | Add to cart events |
| `itemsCheckedOut` | integer | Checkout starts |
| `ecommercePurchases` | integer | Completed purchases |
| `purchaseRevenue` | decimal | Total revenue (in account currency) |

**Note**: Ecommerce metrics require the site to have GA4 ecommerce events configured (`view_item`, `add_to_cart`, `begin_checkout`, `purchase`). If not configured, these return 0.

### Traffic Source Dimensions

| Dimension | Description |
|---|---|
| `sessionSource` | Traffic source (e.g., "google", "facebook") |
| `sessionMedium` | Medium (e.g., "cpc", "organic", "referral") |

### Other Useful Dimensions

| Dimension | Description |
|---|---|
| `date` | Date in YYYYMMDD format |
| `landingPage` | First page path in session |
| `deviceCategory` | "desktop", "mobile", or "tablet" |

## Rate Limits & Quotas

- **Standard quota**: 10 concurrent requests per property.
- **Tokens**: Each request costs tokens based on complexity. Simple queries ~1 token, complex ~10 tokens.
- **Daily limit**: 200,000 tokens/day per property.
- **No hard retry-after header** — use exponential backoff on 429 errors.

## Project Integration

- **Service**: `src/lib/ga4-service.ts` — `GA4Service` static class.
- **Cron**: `/api/cron/sync-ga4` fetches yesterday's data daily.
- **Property List API**: `/api/integrations/ga4/list-properties` — lists all accessible properties.
- **Storage**: Writes to `channel_snapshots` collection with `channel: 'GA4'`.
- **Document ID**: `{clientId}__GA4__{YYYY-MM-DD}` (via `buildChannelSnapshotId()`).
- **Client Config Fields**: `ga4PropertyId`, `integraciones.ga4: true`.
- **UI**: `src/components/pages/GA4Channel.tsx` at route `/ga4`.
- **Backfill**: Handled by `ChannelBackfillService` — backfills from quarter start on client create/update.

## References

- **Metrics Reference**: See [references/ga4-metrics.md](references/ga4-metrics.md) for the complete metrics catalog.
- **Implementation Patterns**: See [references/implementation-patterns.md](references/implementation-patterns.md) for code patterns and best practices.
