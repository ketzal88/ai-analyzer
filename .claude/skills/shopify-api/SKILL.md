---
name: shopify-api
description: Specialized knowledge for Shopify REST Admin API (v2024-01). Use when working with Shopify integrations, fetching orders, managing OAuth flows, handling cursor-based pagination, UTM attribution, and ecommerce data sync to channel_snapshots.
---

# Shopify REST Admin API Expert

This skill provides comprehensive knowledge for interacting with the **Shopify REST Admin API** (v2024-01), focusing on OAuth authentication, order data retrieval, ecommerce metrics, and integration with our unified `channel_snapshots` collection.

## Core Concepts

- **REST Architecture**: Standard REST endpoints under `https://{storeDomain}/admin/api/2024-01/`.
- **Authentication**: OAuth 2.0 Partners App flow. All requests use header `X-Shopify-Access-Token: {token}`.
- **Cursor-based Pagination**: Shopify uses Link headers with `rel="next"` — never page numbers.
- **Rate Limits**: Bucket-based, 40 requests/second per store. `Retry-After` header on 429 responses.
- **Per Page Max**: 250 items.

## Authentication — OAuth Partners App

Our app ("Worker Brain") uses the Shopify Partners Custom Distribution model.

1. **Initiate**: `GET /api/integrations/shopify/auth` — Redirects to Shopify authorization.
2. **Callback**: `GET /api/integrations/shopify/callback` — Receives `code`, verifies HMAC, exchanges code for token via `POST https://{storeDomain}/admin/oauth/access_token`.
3. **Scopes**: `read_orders`, `read_products`, `read_analytics`, `read_customers`, `read_checkouts`.

## Pagination — Cursor-Based via Link Header

Shopify does NOT use page numbers. Parse `rel="next"` from Link header:
```
Link: <https://store.myshopify.com/admin/api/2024-01/orders.json?page_info=abc123&limit=250>; rel="next"
```
Do NOT manually construct `page_info` values. Always parse them from the Link header.

## Project Integration

- **Service**: `src/lib/shopify-service.ts` — `ShopifyService` static class.
- **Client Fields**: `shopifyStoreDomain`, `shopifyAccessToken`, `integraciones.ecommerce: 'shopify'`.
- **Storage**: `channel_snapshots` with `channel: 'ECOMMERCE'`, ID: `{clientId}__ECOMMERCE__{YYYY-MM-DD}`.
- **Cron**: `/api/cron/sync-ecommerce` dispatches to ShopifyService based on `integraciones.ecommerce`.
- **UI**: `src/components/pages/EcommerceChannel.tsx` — detects `rawData.source === 'shopify'`.

## Metrics Collected

Financial (grossRevenue, netRevenue, totalDiscounts, discountRate, totalTax, totalShipping), Customer (newCustomers, returningCustomers, repeatPurchaseRate), Operations (fulfilledOrders, cancelledOrders, fulfillmentRate, itemsPerOrder), Abandoned Carts (abandonedCheckouts, abandonedCheckoutValue, cartAbandonmentRate), Attribution (UTM parsing from landing_site + referring_site).

## References

- **Endpoints**: See [references/endpoints.md](references/endpoints.md) for the complete endpoint and field reference.
- **Data Patterns**: See [references/data-patterns.md](references/data-patterns.md) for UTM attribution, revenue calculations, customer segmentation, and aggregation patterns.