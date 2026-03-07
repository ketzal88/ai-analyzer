# GA4 Metrics Reference

Complete reference of GA4 API dimensions and metrics used in this project.

## Core Web Analytics Metrics

| API Name | Return Type | Conversion Needed | Description |
|---|---|---|---|
| `sessions` | integer string | `parseInt()` | Total sessions in period |
| `totalUsers` | integer string | `parseInt()` | Unique users (deduplicated) |
| `newUsers` | integer string | `parseInt()` | First-time visitors |
| `screenPageViews` | integer string | `parseInt()` | Total pageviews. **Not** `pageviews` — GA4 renamed it. |
| `bounceRate` | decimal string | `parseFloat() * 100` | **0.0-1.0 range**. Multiply by 100 for percentage display. |
| `averageSessionDuration` | decimal string | `parseFloat()` | In seconds. Display as `${Math.round(value)}s`. |
| `engagedSessions` | integer string | `parseInt()` | Sessions with >10s engagement, ≥2 pageviews, or conversion |
| `engagementRate` | decimal string | `parseFloat() * 100` | **0.0-1.0 range**. Inverse of bounce rate. |
| `sessionsPerUser` | decimal string | `parseFloat()` | Average sessions per unique user |
| `screenPageViewsPerSession` | decimal string | `parseFloat()` | Pages per session average |

## Ecommerce Funnel Metrics

| API Name | Return Type | Description |
|---|---|---|
| `itemsViewed` | integer string | Product detail view events (`view_item`) |
| `itemsAddedToCart` | integer string | Add to cart events (`add_to_cart`) |
| `itemsCheckedOut` | integer string | Checkout initiated events (`begin_checkout`) |
| `ecommercePurchases` | integer string | Completed purchase events (`purchase`) |
| `purchaseRevenue` | decimal string | Total purchase revenue in account currency |
| `conversions` | integer string | Total conversion events (all types) |

### Ecommerce Funnel Notes

- Funnel metrics require the site to send **standard GA4 ecommerce events**.
- If not configured, all funnel metrics return `"0"`.
- Our service wraps `fetchEcommerceFunnel()` in `try/catch` — graceful fallback to empty array.
- Ecommerce conversion rate is computed client-side: `(purchases / sessions) * 100`.

## Traffic Source Dimensions

| Dimension | Values | Description |
|---|---|---|
| `sessionSource` | `"google"`, `"facebook"`, `"(direct)"`, etc. | Where the session originated |
| `sessionMedium` | `"cpc"`, `"organic"`, `"referral"`, `"email"`, `"(none)"` | Traffic medium |

### Common Source/Medium Combinations

| Source / Medium | Meaning |
|---|---|
| `google / cpc` | Google Ads paid traffic |
| `google / organic` | Google organic search |
| `facebook / cpc` | Meta Ads paid traffic |
| `(direct) / (none)` | Direct traffic (no referrer) |
| `instagram / referral` | Instagram link clicks |
| `email / email` | Email marketing campaigns |

## Device Dimensions

| Dimension | Values |
|---|---|
| `deviceCategory` | `"desktop"`, `"mobile"`, `"tablet"` |

## Landing Page Dimension

| Dimension | Values |
|---|---|
| `landingPage` | Page path (e.g., `"/"`, `"/products/item-1"`) |

## Date Dimension

| Dimension | Format | Conversion |
|---|---|---|
| `date` | `YYYYMMDD` | Convert to `YYYY-MM-DD`: `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}` |

## Response Format

All values come as **strings** inside `dimensionValues` and `metricValues` arrays:

```typescript
const row = res.data.rows[0];
// row.dimensionValues = [{ value: "20250301" }]
// row.metricValues = [{ value: "1523" }, { value: "0.432" }]
```

**Positional access** — order matches the order in the request:

```typescript
const res = await api.properties.runReport({
    requestBody: {
        dimensions: [{ name: "date" }],       // → dimensionValues[0]
        metrics: [
            { name: "sessions" },              // → metricValues[0]
            { name: "bounceRate" },            // → metricValues[1]
        ],
    },
});
```

## Query Limits

| Limit | Value |
|---|---|
| Max metrics per query | 10 |
| Max dimensions per query | 9 |
| Max `limit` (rows) | 100,000 |
| Max date range | 730 days |
| Max concurrent requests | 10 per property |
| Daily token quota | 200,000 per property |

## Common Gotchas Summary

1. **`bounceRate` and `engagementRate` are decimals (0-1)** — always multiply by 100 for display.
2. **`screenPageViews` not `pageviews`** — GA4 renamed this metric.
3. **`limit` parameter must be a string** in googleapis REST API (`"20"` not `20`).
4. **Response is `res.data.rows`** — not destructured from array.
5. **Date format `YYYYMMDD`** — convert to `YYYY-MM-DD` before storing.
6. **Ecommerce metrics return 0** if site hasn't configured GA4 ecommerce events.
7. **All values are strings** — parse with `parseInt()` or `parseFloat()`.
8. **Metrics and dimensions are positional** — order in response matches order in request.
9. **Empty properties return `rows: undefined`** — always use `res.data.rows || []`.
10. **Property ID format** — API expects `"properties/123456789"`, store as `"123456789"`.