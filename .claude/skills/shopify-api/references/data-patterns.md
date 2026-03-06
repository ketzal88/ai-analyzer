# Shopify Data Patterns

## UTM Attribution

Parse UTM from `landing_site` URL params, classify `referring_site` as fallback:

| Classification | Trigger |
|---|---|
| `meta_ads` | UTM source contains facebook/fb/instagram/ig |
| `google_ads` | UTM source contains google + medium is cpc |
| `email` | UTM source contains klaviyo or medium is email |
| `paid_other` | Medium is cpc or paid |
| `direct` | No referrer |
| `meta_organic` | Referrer is facebook.com/instagram.com |
| `google_organic` | Referrer is google.com |
| `referral` | Any other referrer |

## Revenue Calculations

- **grossRevenue**: Sum of `total_line_items_price` (before discounts/shipping/tax)
- **netRevenue**: Sum of `total_price` (what customer paid)
- **totalDiscounts**: Sum of `total_discounts`
- **discountRate**: `(totalDiscounts / grossRevenue) * 100`

## Customer Segmentation

| Cohort | Criteria (by `customer.orders_count`) |
|---|---|
| First-time | `orders_count <= 1` |
| Returning | `orders_count 2-5` |
| VIP | `orders_count >= 6` |

## Abandoned Cart Rate

```
cartAbandonmentRate = abandonedCount / (abandonedCount + completedOrders) * 100
```

## Product & Discount Aggregation

- Top 10 products by revenue from `line_items`
- Top 5 discount codes by usage count from `discount_codes`
- Country breakdown from `billing_address.country_code`
- Fulfillment rate: `fulfilledOrders / totalOrders * 100`