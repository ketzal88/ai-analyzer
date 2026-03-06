# WooCommerce Endpoints Reference

Base URL: `https://{storeDomain}/wp-json/wc/v3`

## Orders

### `GET /orders`

**Auth**: Consumer Key + Consumer Secret as query params: `consumer_key=ck_xxx&consumer_secret=cs_xxx`

**Query Parameters**: `status=processing,completed,refunded,on-hold` (comma-separated), `after={ISO}T00:00:00`, `before={ISO}T23:59:59`, `per_page=100` (max), `page=N`, `orderby=date`, `order=desc`

**Pagination**: Page-based via `X-WP-TotalPages` response header. Loop until `page >= totalPages`.

**Order Object Fields**:
- `id` (number), `number` (string) — Identifiers
- `status` — `processing`, `completed`, `refunded`, `cancelled`, `on-hold`, `pending`, `failed`
- `currency`, `date_created` (ISO 8601)
- `total` (string) — Final total including tax/shipping
- `discount_total` (string) — Total discount amount
- `shipping_total` (string) — Shipping cost
- `total_tax` (string) — Tax amount
- `customer_id` (number) — 0 for guests
- `billing` — `{ email, first_name, last_name, country? }`
- `line_items[]` — `{ id, product_id, name, quantity, price (number!), subtotal (string), total (string), sku }`
- `coupon_lines[]` — `{ id, code, discount (string), discount_tax (string) }`
- `refunds[]` — `{ id, total (string — NEGATIVE!), reason }`
- `payment_method` — Internal key (e.g., `bacs`, `cod`, `stripe`)
- `payment_method_title` — Display name (e.g., "Direct Bank Transfer", "Stripe")
- `meta_data[]` — `{ key, value }` — Contains UTM attribution data

## Order Status Filtering

| Status | Include in Revenue? | Notes |
|---|---|---|
| `processing` | Yes | Payment received, awaiting fulfillment |
| `completed` | Yes | Fulfilled and done |
| `on-hold` | Yes | Awaiting payment confirmation |
| `refunded` | No | Count as refund |
| `cancelled` | No | Count as cancelled |
| `failed` | No | Count as cancelled |
| `pending` | No | Awaiting payment |

## UTM Attribution via meta_data

UTM data lives in the `meta_data[]` array. Three key sources:

| Key | Source |
|---|---|
| `_wc_order_attribution_utm_source` | WooCommerce 8.5+ native attribution |
| `_wc_order_attribution_utm_medium` | WooCommerce 8.5+ native attribution |
| `_wc_order_attribution_source_type` | WooCommerce 8.5+ native (`organic`, `referral`, `direct`, `typein`) |
| `_utm_source` / `_utm_medium` | Third-party tracking plugins |
| `utm_source` / `utm_medium` | Some plugins use keys without underscore prefix |

## Important Notes

- **HTTPS required**: WooCommerce REST API with query param auth only works on HTTPS stores.
- **`price` is a number** (not string) in `line_items` — unlike Shopify/TiendaNube.
- **`refunds[].total` is NEGATIVE** — always use `Math.abs()` when summing refund amounts.
- **`per_page` max is 100** (vs Shopify's 250).
- **Guest orders**: `customer_id === 0` for guest checkouts.
- **All monetary string fields** (`total`, `discount_total`, `shipping_total`, `total_tax`) need `parseFloat()`.
