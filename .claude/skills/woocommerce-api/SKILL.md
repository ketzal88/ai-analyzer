---
name: woocommerce-api
description: Specialized knowledge for WooCommerce REST API v3 integration. Use when working with WooCommerce order syncing, ecommerce data extraction, UTM attribution parsing from meta_data, or troubleshooting the woocommerce-service.ts implementation.
---

# WooCommerce REST API Expert

This skill provides comprehensive knowledge for interacting with the **WooCommerce REST API v3**, focusing on order data extraction, revenue computation, UTM attribution from meta_data, and integration patterns.

## Core Concepts

- **REST API v3**: Endpoints under `/wp-json/wc/v3` on the WordPress site.
- **Authentication**: Consumer Key + Consumer Secret via query parameters. No OAuth flow required.
- **HTTPS Required**: Query parameter auth only works over HTTPS.
- **Pagination**: Page-based with `X-WP-TotalPages` header. Max `per_page=100`.

## Authentication

Keys generated in WooCommerce admin: **Settings > Advanced > REST API > Add key**. Only `read` permission needed.

```
GET https://{storeDomain}/wp-json/wc/v3/{endpoint}?consumer_key={key}&consumer_secret={secret}
```

## Key Gotchas

- **Refund totals are NEGATIVE** in WooCommerce — use `Math.abs()`.
- **UTM from meta_data**: WC 8.5+ native: `_wc_order_attribution_utm_source`. Plugins: `_utm_source`, `utm_source`.
- **Source type mapping**: `_wc_order_attribution_source_type` → organic=google_organic, direct/typein=direct.
- **Status filtering**: paid = processing|completed|on-hold, cancelled = cancelled|failed.

## Project Integration

- **Service**: `src/lib/woocommerce-service.ts` — `WooCommerceService` static class.
- **Client Fields**: `woocommerceStoreDomain`, `woocommerceConsumerKey`, `woocommerceConsumerSecret`, `integraciones.ecommerce: 'woocommerce'`.
- **Storage**: `channel_snapshots` with `channel: 'ECOMMERCE'`, `rawData.source: 'woocommerce'`.

## References

- **Endpoints**: See [references/endpoints.md](references/endpoints.md).
- **Data Patterns**: See [references/data-patterns.md](references/data-patterns.md).