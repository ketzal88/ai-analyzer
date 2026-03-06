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