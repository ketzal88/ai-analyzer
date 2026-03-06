---
name: perfit-api
description: Specialized knowledge for Perfit email marketing API (Latin American platform). Use when working with Perfit API integrations, fetching campaign metrics, automation stats, account info, and handling data normalization for the channel_snapshots collection.
---

# Perfit API Expert

This skill provides comprehensive knowledge for interacting with the **Perfit API v2**, a Latin American email marketing platform focused on campaigns, automations, and ecommerce conversion tracking.

## Core Concepts

- **Inline Metrics**: Campaign performance data returned inline with campaign objects (no separate reporting API).
- **Lifetime Automations**: Automation stats are cumulative lifetime aggregates with no date filtering.
- **Account-Scoped**: All endpoints prefixed with account ID extracted from API key.

## Authentication

- **Header**: `Authorization: Bearer {apiKey}`. No OAuth needed.
- **Key Format**: `{accountId}-{secret}` — account ID is substring before first dash.
- **Base URL**: `https://api.myperfit.com/v2`

## Key Differences from Klaviyo

| Aspect | Perfit | Klaviyo |
|--------|--------|---------|
| Auth header | `Bearer {key}` | `Klaviyo-API-Key {key}` |
| Metrics retrieval | Inline with campaign objects | Separate reporting API |
| Rate limits | Standard REST (generous) | 2/min reporting, 225/day |
| Date filtering | Client-side by `launchDate` | Server-side via reporting params |
| Automation stats | Lifetime aggregates only | Flow-level with date ranges |
| Snapshot granularity | Per-day (by launch date) | Period aggregates |
| Revenue field | `conversionsAmount` | "Placed Order" metric discovery |

## Key Patterns

- **Account ID extraction**: `apiKey.substring(0, apiKey.indexOf('-'))`.
- **Campaign states**: DRAFT, PENDING_APPROVAL, SCHEDULED, SENT, CANCELLED. Filter for SENT only.
- **Subject extraction**: `description` field, strip "Asunto: " prefix.
- **Pagination**: Offset-based `?offset=N&limit=50` (max 50 for campaigns).
- **Percentage fields** (sentP, openedP) exist but we compute our own from raw counts.

## Project Integration

- **Service**: `src/lib/perfit-service.ts` — `PerfitService` static class.
- **Client Fields**: `perfitApiKey`, `integraciones.email: 'perfit'`.
- **Storage**: `channel_snapshots` with `channel: 'EMAIL'`, `rawData.source: 'perfit'`.
- **Per-day snapshots** (campaigns grouped by launch date, unlike Klaviyo's period aggregates).
- **Cron**: `/api/cron/sync-email` dispatches based on `integraciones.email`.

## References

- **Endpoints**: See [references/endpoints.md](references/endpoints.md).
- **Data Patterns**: See [references/data-patterns.md](references/data-patterns.md).