---
name: tiendanube-api
description: Specialized knowledge for Tienda Nube (Nuvemshop) REST API v1. Use when working with Tienda Nube ecommerce integrations, fetching orders, managing OAuth authentication, handling storefront attribution, and processing order data.
---

# Tienda Nube API Expert

This skill provides comprehensive knowledge for interacting with the **Tienda Nube REST API v1**, focusing on order data retrieval, OAuth marketplace authentication, and ecommerce metrics aggregation.

## Core Concepts

- **REST API v1**: Simple resource-based endpoints returning JSON arrays.
- **Auth Header Quirk**: Uses `Authentication` (NOT `Authorization`) header with `bearer {accessToken}`.
- **User-Agent Required**: All requests must include a `User-Agent` header.
- **Storefront Attribution**: Orders attributed by `storefront` field (not UTM parameters).
- **String Monetary Values**: All money fields are strings — always `parseFloat()`.

## Authentication — OAuth Marketplace

1. **User installs app** from Tienda Nube marketplace.
2. **Callback** at `/api/tiendanube/auth` with `?code=XXX`.
3. **Token exchange**: `POST https://www.tiendanube.com/apps/authorize/token`.
4. **Auto-linking**: Searches clients by `tiendanubeStoreId`. If not found, stores in `tiendanube_auth_tokens`.

### Request Headers
```
Authentication: bearer {accessToken}
Content-Type: application/json
User-Agent: AI-Analyzer/1.0
```
**Important**: The header is `Authentication`, not `Authorization`. This is a Tienda Nube API quirk.

## API Fundamentals

- **Base URL**: `https://api.tiendanube.com/v1/{storeId}`
- **Pagination**: Page-based `?page=N&per_page=200` (max 200/page, max 10,000 total).
- **Date filtering**: ISO format without timezone: `created_at_min=YYYY-MM-DDT00:00:00`.
- **Separate paid/refunded fetches**: API only supports single `payment_status` filter per request.

## Project Integration

- **Service**: `src/lib/tiendanube-service.ts` — `TiendaNubeService` static class.
- **Client Fields**: `tiendanubeStoreId`, `tiendanubeAccessToken`, `integraciones.ecommerce: 'tiendanube'`.
- **Storage**: `channel_snapshots` with `channel: 'ECOMMERCE'`, `rawData.source: 'tiendanube'`.
- **Storefront values**: `store` (web), `meli` (MercadoLibre), `api` (external), `form` (manual), `pos` (point of sale).

## References

- **Endpoints**: See [references/endpoints.md](references/endpoints.md).
- **Data Patterns**: See [references/data-patterns.md](references/data-patterns.md).