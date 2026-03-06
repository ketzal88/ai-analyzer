---
name: klaviyo-api
description: Specialized knowledge for Klaviyo Email Marketing API. Use when working with Klaviyo integrations, fetching campaign/flow reports, managing metrics, handling strict rate limits, and parsing JSON:API response formats.
---

# Klaviyo API Expert

This skill provides comprehensive knowledge for interacting with the **Klaviyo API** (revision 2025-04-15), focusing on email marketing data retrieval, reporting, and integration patterns.

## Core Concepts

- **JSON:API Specification**: Responses have `data`, `links`, and optional `included` top-level keys.
- **Revision Header**: Every request MUST include `revision: 2025-04-15`. Omitting returns errors.
- **Reporting API**: Separate from CRUD endpoints. Uses POST requests for aggregated statistics.

## Authentication

- **Header**: `Authorization: Klaviyo-API-Key {pk_...}`. No OAuth needed.
- **Key Format**: Private keys start with `pk_`. Public key is 6-char identifier.
- **Base URL**: `https://a.klaviyo.com/api`

## Rate Limits (CRITICAL)

| Endpoint Category | Burst | Steady | Daily |
|---|---|---|---|
| **Reporting API** (`*-values-reports`) | 1/s | 2/min | 225/day |
| **Campaigns/Flows/Metrics** | 10/s | 150/min | - |

Our service enforces **31-second pause** between Reporting API calls to stay within 2/min. The 225/day limit means max ~112 client syncs per day.

## Key Patterns

- **Conversion metric discovery**: Must find "Placed Order" metric ID via `GET /metrics` first. Cache per API key.
- **Percentages as decimals**: Reporting returns rates as decimals (0.25 = 25%). Multiply by 100.
- **Flow stats are lifetime**: No date-range filtering for flow reports.
- **Campaign filter**: Use `filter=equals(messages.channel,'email')` to exclude SMS.
- **Pagination**: Cursor-based via `links.next` in response.

## Project Integration

- **Service**: `src/lib/klaviyo-service.ts` — `KlaviyoService` static class.
- **Client Fields**: `klaviyoApiKey` (pk_...), `klaviyoPublicKey` (6 chars), `integraciones.email: 'klaviyo'`.
- **Storage**: `channel_snapshots` with `channel: 'EMAIL'`, `rawData.source: 'klaviyo'`.
- **Writes ONE snapshot per period** (not per day) — aggregated totals.
- **Cron**: `/api/cron/sync-email` — Daily, last 30 days.

## References

- **Endpoints**: See [references/endpoints.md](references/endpoints.md).
- **Data Patterns**: See [references/data-patterns.md](references/data-patterns.md).