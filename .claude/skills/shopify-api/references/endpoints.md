# Shopify Endpoints Reference

Base URL: `https://{storeDomain}/admin/api/2024-01`

## Orders

### `GET /orders.json`

**Query Parameters**: `status=any`, `created_at_min={ISO}`, `created_at_max={ISO}`, `limit=250`

**Order Object Fields**:
- `id`, `name` — Identifiers
- `financial_status` — `paid`, `partially_paid`, `partially_refunded`, `refunded`, `pending`, `voided`
- `fulfillment_status` — `fulfilled`, `partial`, `null` (unfulfilled)
- `total_price`, `subtotal_price`, `total_line_items_price` — Revenue (strings)
- `total_discounts`, `total_tax` — Deductions (strings)
- `total_shipping_price_set.shop_money.amount` — Shipping cost (string)
- `currency`, `created_at`, `cancelled_at`, `cancel_reason`
- `source_name` — Origin channel (`web`, `pos`, `shopify_draft_order`)
- `referring_site`, `landing_site` — UTM attribution sources
- `discount_codes[]` — `{ code, amount, type }`
- `line_items[]` — `{ id, product_id, title, name, price, quantity, total_discount, sku, variant_title }`
- `billing_address` — `{ country, country_code, province, city }`
- `customer` — `{ id, email, orders_count, total_spent, created_at }`
- `refunds[]` — `{ id, created_at, refund_line_items[{ quantity, subtotal }] }`
- `fulfillments[]` — `{ id, status, created_at }`

## Abandoned Checkouts

### `GET /checkouts.json`

**Query Parameters**: `created_at_min={ISO}`, `created_at_max={ISO}`, `limit=250`

**Checkout Fields**: `id`, `token`, `email`, `created_at`, `completed_at` (null = abandoned), `total_price`, `line_items[]`

Filter client-side: only those with `completed_at === null`.

## Financial Status Filtering

| Status | Include in Revenue? |
|---|---|
| `paid` | Yes |
| `partially_paid` | Yes |
| `partially_refunded` | Yes |
| `refunded` | No (count as refund) |
| `pending` | No |
| `voided` | No |