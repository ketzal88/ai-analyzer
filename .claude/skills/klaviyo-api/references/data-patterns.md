# Klaviyo Data Patterns

## Rate Percentage Conversion

Klaviyo returns rates as **decimals (0-1)**, not percentages:

```typescript
openRate: (stats.open_rate || 0) * 100,    // 0.25 → 25%
clickRate: (stats.click_rate || 0) * 100,   // 0.0625 → 6.25%
bounceRate: (stats.bounce_rate || 0) * 100, // 0.04 → 4%
```

Always multiply by 100 when storing in `UnifiedChannelMetrics`.

## Conversion Metric Discovery

Before querying reports, you must find the "Placed Order" metric ID:

1. Call `GET /metrics` — returns all account metrics
2. Prefer: `name === "Placed Order"` AND `integration.name === "Shopify"`
3. Fallback: any metric with name containing "placed order" (case-insensitive)
4. Cache result per API key (metric ID never changes)

This ID is passed as `conversion_metric_id` to reporting endpoints.

## Period-Based vs Daily Snapshots

Klaviyo's Reporting API returns **aggregated totals for the entire period**, not per-day breakdowns. This means:

- We write **one snapshot** per sync period (keyed by `endDate`)
- The snapshot contains period-wide totals + per-campaign breakdown in `rawData`
- Dashboard reads the period snapshot and displays totals
- Different from Perfit which has per-campaign `launchDate` for daily grouping

## Campaign + Flow Enrichment Pattern

Reporting API returns `campaign_id` but unreliable names. The enrichment pattern:

1. Fetch campaign/flow **lists** first (not rate-limited) — builds name maps
2. Fetch **reporting** data (rate-limited) — gets stats
3. Enrich reporting results with names from step 1

```typescript
const [allCampaigns, allFlows] = await Promise.all([
    fetchCampaigns(apiKey),   // Not rate-limited
    fetchFlows(apiKey),       // Not rate-limited
]);
// Then sequentially (rate-limited):
const campaignReport = await queryCampaignValues(...);
await sleep(31_000); // 31s to respect 2/min
const flowReport = await queryFlowValues(...);
```

## Computed Metrics

```
delivered = recipients - bounces
openRate = (opens / delivered) * 100
clickRate = (clicks / delivered) * 100
clickToOpenRate = (clicks / opens) * 100
revenuePerRecipient = totalRevenue / totalRecipients
emailRevenue = campaignRevenue + flowRevenue
conversions = campaignConversions + flowConversions
```

## Flow Stats vs Campaign Stats

| Aspect | Campaigns | Flows |
|---|---|---|
| Statistics available | Full (opens, clicks, bounces, unsubs, revenue) | Partial (opens, clicks, revenue — no unsubs) |
| Grouping | `campaign_id`, `campaign_message_id` | `flow_id`, `flow_message_id` |
| Time range | Period totals | Period totals |
| Used for | Main engagement metrics | Revenue attribution to automations |

## rawData Structure

```typescript
rawData: {
    campaigns: KlaviyoCampaignStats[],  // Per-campaign breakdown
    flows: KlaviyoFlowStats[],          // Per-flow breakdown
    flowTotals: {
        totalRecipients: number,
        totalRevenue: number,
        totalConversions: number,
    },
    periodStart: string,  // Date range metadata
    periodEnd: string,
    source: 'klaviyo',
}
```

## Sync Strategy

Due to the 225/day reporting cap:
- Daily cron syncs **yesterday only** (2 reporting calls: campaigns + flows)
- Backfill syncs use wider date ranges to minimize API calls
- Each sync = exactly 2 reporting API calls + unlimited list API calls