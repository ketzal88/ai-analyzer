---
name: google-ads-api
description: Specialized knowledge for Google Ads API (GAQL queries, google-ads-api npm package by Opteo). Use when working with Google Ads integrations, GAQL query construction, campaign metrics fetching, MCC account management, or troubleshooting Google Ads API errors and rate limits.
---

# Google Ads API Expert

This skill provides comprehensive knowledge for interacting with the **Google Ads API** via the `google-ads-api` npm package (by Opteo), focusing on GAQL query language, resource hierarchy, and campaign performance reporting.

## Core Concepts

- **GAQL (Google Ads Query Language)**: SQL-like syntax for querying Google Ads resources. Not actual SQL — has its own grammar.
- **Resource Hierarchy**: Customer (account) > Campaign > Ad Group > Ad / Keyword / etc.
- **Micros Convention**: All monetary values (cost, CPC, CPM) are returned in micros (1/1,000,000 of the currency unit). Divide by `1_000_000`.
- **Customer ID Format**: Stored as `XXX-XXX-XXXX` but must be sent without dashes: `"835-183-5862"` becomes `"8351835862"`.

## Authentication

Google Ads API requires 5 credentials:

| Credential | Env Variable | Purpose |
|---|---|---|
| Developer Token | `GOOGLE_ADS_DEVELOPER_TOKEN` | API access key (from Google Ads API Center) |
| OAuth Client ID | `GOOGLE_ADS_CLIENT_ID` | OAuth2 app identifier |
| OAuth Client Secret | `GOOGLE_ADS_CLIENT_SECRET` | OAuth2 app secret |
| Refresh Token | `GOOGLE_ADS_REFRESH_TOKEN` | Long-lived OAuth2 refresh token |
| Customer ID | `GOOGLE_ADS_CUSTOMER_ID` | Target account (strip dashes) |
| Login Customer ID | `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | MCC manager account (optional, strip dashes) |

- **MCC (Manager) Accounts**: When accessing a client account through a manager (MCC), set `login_customer_id` to the manager account ID. Without this, API calls to managed accounts will fail with `CUSTOMER_NOT_FOUND`.
- **Developer Token Levels**: Basic = 15,000 operations/day; Standard = 100,000/day.

## GAQL Query Language

### Syntax
```sql
SELECT field1, field2, ...
FROM resource_name
WHERE condition1 AND condition2
ORDER BY field [ASC|DESC]
LIMIT n
```

### Key Rules
1. **No `*` wildcard** — you must explicitly list every field.
2. **Segments split rows** — adding `segments.date` creates one row per date per entity.
3. **WHERE date filtering** — always use `segments.date BETWEEN 'YYYY-MM-DD' AND 'YYYY-MM-DD'`.
4. **No aliases** — field names are always fully qualified (`campaign.id`, `metrics.cost_micros`).
5. **Enum comparisons** use strings: `campaign.status != 'REMOVED'`.
6. **No JOINs** — each query targets one resource.
7. **No aggregation functions** (SUM, AVG, COUNT) — aggregation must be done client-side.

## Rate Limits & Quotas

- **Developer Token (Basic)**: 15,000 operations/day.
- **Mutate operations**: 10,000/day per account.
- **Pagination**: Handled automatically by the `google-ads-api` npm package.
- **Error `RESOURCE_EXHAUSTED`**: Back off and retry.

## Campaign Statuses

| Status | Meaning |
|---|---|
| `ENABLED` | Active, serving ads |
| `PAUSED` | Manually paused, not serving |
| `REMOVED` | Deleted (soft delete). Exclude with `campaign.status != 'REMOVED'` |

## Project Integration

- **Service**: `src/lib/google-ads-service.ts` — `GoogleAdsService` static class.
- **Cron**: `/api/cron/sync-google` fetches yesterday's data daily at 09:00 UTC.
- **Storage**: Writes to `channel_snapshots` collection with `channel: 'GOOGLE'`.
- **Document ID**: `{clientId}__GOOGLE__{YYYY-MM-DD}` (via `buildChannelSnapshotId()`).
- **Client Config Fields**: `googleAdsCustomerId`, `integraciones.google: true`.
- **UI**: `src/components/pages/GoogleAdsChannel.tsx` at route `/google-ads`.

## References

- **GAQL Fields**: See [references/gaql-fields.md](references/gaql-fields.md) for the complete field reference.
- **Implementation Patterns**: See [references/implementation-patterns.md](references/implementation-patterns.md) for code patterns and best practices.