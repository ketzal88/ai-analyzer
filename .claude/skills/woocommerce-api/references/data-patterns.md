# WooCommerce Data Patterns

## Revenue Calculations

- **grossRevenue**: Sum of `line_items[].subtotal` across paid orders (pre-discount line item totals)
- **netRevenue / revenue**: Sum of `order.total` across paid orders (final amount including tax/shipping)
- **totalDiscounts**: Sum of `order.discount_total`
- **discountRate**: `(totalDiscounts / grossRevenue) * 100`
- **totalTax**: Sum of `order.total_tax`
- **totalShipping**: Sum of `order.shipping_total`

## Status-Based Filtering

```
paidOrders = orders.filter(o => ["processing", "completed", "on-hold"].includes(o.status))
refundedOrders = orders.filter(o => o.status === "refunded")
cancelledOrders = orders.filter(o => o.status === "cancelled" || o.status === "failed")
fulfilledOrders = paidOrders.filter(o => o.status === "completed")
```

## Refund Handling — NEGATIVE Totals

WooCommerce `refunds[].total` values are **negative strings** (e.g., `"-25.00"`).

```typescript
totalRefundAmount += Math.abs(parseFloat(refund.total || "0"));
```

Always use `Math.abs()` when aggregating refund amounts.

## UTM Attribution from meta_data

Unlike Shopify (which uses `landing_site` URL), WooCommerce stores UTM data in `meta_data[]`:

```typescript
const utmSource = order.meta_data.find(m =>
    m.key === "_wc_order_attribution_utm_source" ||
    m.key === "_utm_source" ||
    m.key === "utm_source"
)?.value?.toLowerCase();
```

### Classification Logic

| Classification | Trigger |
|---|---|
| `meta_ads` | UTM source contains facebook/fb/instagram/ig |
| `google_ads` | UTM source contains google + medium is cpc |
| `email` | UTM source contains klaviyo or medium is email |
| `paid_other` | Medium is cpc or paid |
| `google_organic` | WC native `source_type === "organic"` |
| `referral` | WC native `source_type === "referral"` |
| `direct` | WC native `source_type === "direct"` or `"typein"`, or no UTM data |

## Payment Method Breakdown

Unique to WooCommerce — uses `payment_method_title` (display name) for grouping:

```typescript
const method = order.payment_method_title || order.payment_method || "unknown";
paymentMap[method] = { orders: count, revenue: total };
```

## Discount Codes from coupon_lines

Unlike Shopify's `discount_codes[]`, WooCommerce uses `coupon_lines[]`:

```typescript
for (const coupon of order.coupon_lines) {
    const code = coupon.code.toUpperCase();
    const discount = parseFloat(coupon.discount || "0");
}
```

Top 5 by usage count.

## Product Aggregation

- Top 10 by revenue from `line_items[]`
- Revenue per product: `parseFloat(li.total)` (already includes quantity × price − discounts)
- `li.subtotal` = pre-discount, `li.total` = post-discount

## Country Breakdown

From `billing.country` (ISO 2-letter code). Top 10 by revenue.

## Customer Tracking

- `customer_id > 0` = registered customer
- `customer_id === 0` = guest checkout
- Track unique customers via `Set<number>` on `customer_id`
- No `orders_count` field like Shopify — WooCommerce doesn't expose historical order count per customer in the order object

## Pagination Pattern

```typescript
const totalPages = parseInt(headers.get("X-WP-TotalPages") || "1", 10);
if (page >= totalPages) hasMore = false;
```

Safety cap: 10,000 orders max per sync.