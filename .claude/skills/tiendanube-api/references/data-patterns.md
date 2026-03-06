# Tienda Nube Data Patterns

## Revenue Calculations

- **total**: Final price including shipping, discounts (string → parseFloat)
- **subtotal**: Pre-shipping/discount amount (used as grossRevenue)
- **discount**: Total discount applied
- **shipping_cost_customer**: Shipping charged to customer

## Separate Fetch Strategy

Two parallel API calls required:
1. `payment_status=paid` — Main revenue orders
2. `payment_status=refunded` — Refund count only

## Attribution by Storefront

Unlike Shopify (UTM-based), Tienda Nube uses `storefront` field:
- Attribution breakdown = `byStorefront` record
- No UTM parsing available (API doesn't expose `landing_site`)

## Customer Cohort Analysis

Track by `customer.id` within the same day:
- **First-time**: Customer appears once in the day
- **Returning**: Customer appears multiple times
- Note: This is intra-day only (no historical order count like Shopify)

## Product Aggregation

- Top 10 by revenue from `products[]` array
- Revenue per product: `parseFloat(price) * quantity`

## Fulfillment Tracking

| Status | Meaning |
|---|---|
| `fulfilled` / `delivered` | Completed |
| `unpacked` / `unfulfilled` | Not yet shipped |

`fulfillmentRate = (fulfilled + delivered) / totalOrders * 100`

## Payment Status Breakdown

Categorize orders: `paid`/`authorized` → paid, `pending`/`voided` → pending, `refunded` → refunded.