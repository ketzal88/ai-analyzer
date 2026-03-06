# Google Ads API Implementation Patterns

## Setting Up the Client

```typescript
import { GoogleAdsApi } from "google-ads-api";

const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
});

// Strip dashes from customer ID
const normalizeCustomerId = (id: string) => id.replace(/-/g, "");

const customer = client.Customer({
    customer_id: normalizeCustomerId(customerId),
    refresh_token: REFRESH_TOKEN!,
    login_customer_id: loginId, // MCC ID, optional, also no dashes
});
```

## Running GAQL Queries

```typescript
const results = await customer.query(`
    SELECT campaign.id, campaign.name, metrics.cost_micros, segments.date
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.status != 'REMOVED'
    ORDER BY segments.date DESC
`);

// Access fields via nested objects
for (const row of results) {
    const spend = (row.metrics?.cost_micros || 0) / 1_000_000;
    const cpm = (row.metrics?.average_cpm || 0) / 1_000_000; // Also micros!
}
```

Pagination is automatic — `customer.query()` returns all results.

## Error Handling

```typescript
try {
    const results = await customer.query(gaqlQuery);
} catch (err: any) {
    const detail = err?.errors?.[0]?.message || err?.message || String(err);
    throw new Error(`Google Ads GAQL query failed: ${detail}`);
}
```

| Error | Cause | Fix |
|---|---|---|
| `CUSTOMER_NOT_FOUND` | Wrong ID or missing `login_customer_id` | Check dashes and MCC config |
| `AUTHORIZATION_ERROR` | Invalid/expired refresh token | Re-authenticate |
| `QUERY_ERROR` | Invalid GAQL or field name | Validate fields |
| `RESOURCE_EXHAUSTED` | Rate limit | Back off and retry |

## Weighted Averages for Impression Share

```typescript
const weightedIS = totalImpressions > 0
    ? campaigns.reduce((s, c) => s + c.searchImpressionShare * c.impressions, 0) / totalImpressions
    : 0;
```

## Weighted Averages for Video Quartiles

Same pattern as impression share, but weighted by `videoViews`:

```typescript
let wVideoP25 = 0, wVideoP50 = 0, wVideoP75 = 0, wVideoP100 = 0;
let totalVideoViews = 0;

for (const campaign of campaigns) {
    const views = campaign.videoViews || 0;
    wVideoP25 += (campaign.videoP25Rate || 0) * views;
    wVideoP50 += (campaign.videoP50Rate || 0) * views;
    wVideoP75 += (campaign.videoP75Rate || 0) * views;
    wVideoP100 += (campaign.videoP100Rate || 0) * views;
    totalVideoViews += views;
}

const avgP25 = totalVideoViews > 0 ? wVideoP25 / totalVideoViews : 0;
// ... same for P50, P75, P100
```

## Fetching Search Terms

Separate GAQL query on `search_term_view`. Run in parallel with campaign metrics:

```typescript
const [campaignResults, searchTerms] = await Promise.all([
    fetchCampaignMetrics(customerId, startDate, endDate),
    fetchSearchTerms(customerId, startDate, endDate),
]);
```

**Important**: `search_term_view` only works for Search/Shopping campaigns. Always wrap in try/catch:

```typescript
static async fetchSearchTerms(customerId: string, startDate: string, endDate: string, limit = 50) {
    const customer = this.getCustomer(customerId);
    try {
        const results = await customer.query(`
            SELECT search_term_view.search_term, metrics.impressions, metrics.clicks,
                   metrics.conversions, metrics.conversions_value, metrics.cost_micros
            FROM search_term_view
            WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
            ORDER BY metrics.cost_micros DESC LIMIT ${limit}
        `);
        return results.map(r => ({
            searchTerm: r.search_term_view?.search_term || '',
            impressions: Number(r.metrics?.impressions || 0),
            clicks: Number(r.metrics?.clicks || 0),
            conversions: Number(r.metrics?.conversions || 0),
            conversionsValue: Number(r.metrics?.conversions_value || 0),
            spend: (Number(r.metrics?.cost_micros) || 0) / 1_000_000,
        }));
    } catch (err: any) {
        console.warn(`Search terms query failed: ${err?.errors?.[0]?.message || err?.message}`);
        return []; // Graceful fallback
    }
}
```

Stored in `rawData.searchTerms` on the channel snapshot.

## Writing to Firestore

```typescript
const batch = db.batch();
for (const agg of dailyAggregates) {
    const docId = buildChannelSnapshotId(clientId, 'GOOGLE', agg.date);
    batch.set(db.collection('channel_snapshots').doc(docId), snapshot, { merge: true });
}
await batch.commit(); // Max 500 operations per batch
```

## Standard GAQL Query (Our Full Query)

```sql
SELECT
    campaign.id, campaign.name, campaign.status,
    metrics.cost_micros, metrics.impressions, metrics.clicks,
    metrics.conversions, metrics.conversions_value,
    metrics.all_conversions, metrics.all_conversions_value,
    metrics.view_through_conversions,
    metrics.search_impression_share,
    metrics.search_budget_lost_impression_share,
    metrics.search_rank_lost_impression_share,
    metrics.conversions_from_interactions_rate,
    metrics.average_cpm,
    metrics.video_views, metrics.video_view_rate,
    metrics.video_quartile_p25_rate, metrics.video_quartile_p50_rate,
    metrics.video_quartile_p75_rate, metrics.video_quartile_p100_rate,
    segments.date
FROM campaign
WHERE segments.date BETWEEN '2025-01-01' AND '2025-01-31'
  AND campaign.status != 'REMOVED'
ORDER BY segments.date DESC
```

## Search Terms GAQL Query

```sql
SELECT search_term_view.search_term, metrics.impressions, metrics.clicks,
       metrics.conversions, metrics.conversions_value, metrics.cost_micros
FROM search_term_view
WHERE segments.date BETWEEN '2025-01-01' AND '2025-01-31'
ORDER BY metrics.cost_micros DESC
LIMIT 50
```