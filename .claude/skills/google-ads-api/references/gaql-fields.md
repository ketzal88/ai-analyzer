# GAQL Fields Reference

Complete reference of Google Ads API fields used in this project.

## Campaign Fields

| GAQL Field | Type | Description |
|---|---|---|
| `campaign.id` | `int64` | Unique campaign identifier. Cast to string for storage. |
| `campaign.name` | `string` | Campaign display name. |
| `campaign.status` | `enum` | `ENABLED`, `PAUSED`, or `REMOVED`. Always filter `!= 'REMOVED'`. |

## Core Metrics

| GAQL Field | Type | Gotchas |
|---|---|---|
| `metrics.cost_micros` | `int64` | **Divide by 1,000,000** to get currency value. |
| `metrics.impressions` | `int64` | Can be 0 for new campaigns. |
| `metrics.clicks` | `int64` | Includes filtered invalid clicks. |
| `metrics.conversions` | `double` | May be fractional (data-driven attribution). |
| `metrics.conversions_value` | `double` | Total value in account currency. |

## Extended Conversion Metrics

| GAQL Field | Type | Gotchas |
|---|---|---|
| `metrics.all_conversions` | `double` | Includes cross-device and view-through. Always >= `metrics.conversions`. |
| `metrics.all_conversions_value` | `double` | Value of all conversions. |
| `metrics.view_through_conversions` | `int64` | Only for Display/Video campaigns. |

## Search Impression Share Metrics

| GAQL Field | Type | Gotchas |
|---|---|---|
| `metrics.search_impression_share` | `double` | 0.0-1.0 ratio. Only Search campaigns. **Aggregate using weighted average by impressions.** |
| `metrics.search_budget_lost_impression_share` | `double` | Fraction lost due to budget. |
| `metrics.search_rank_lost_impression_share` | `double` | Fraction lost due to low ad rank. |

## Computed Metrics

| GAQL Field | Type | Gotchas |
|---|---|---|
| `metrics.conversions_from_interactions_rate` | `double` | Ratio (0.0-1.0), not percentage. Multiply by 100 for display. |
| `metrics.average_cpm` | `double` | **Also in micros!** Divide by 1,000,000. Easy to miss. |

## Video Metrics

| GAQL Field | Type | Gotchas |
|---|---|---|
| `metrics.video_views` | `int64` | Paid video views (30s or full). Only Video campaigns. |
| `metrics.video_view_rate` | `double` | Ratio (0.0-1.0). |
| `metrics.video_quartile_p25_rate` | `double` | Ratio of impressions where video played to 25%. |
| `metrics.video_quartile_p50_rate` | `double` | 50% quartile. |
| `metrics.video_quartile_p75_rate` | `double` | 75% quartile. |
| `metrics.video_quartile_p100_rate` | `double` | 100% completion. |

## Segments

| GAQL Field | Type | Gotchas |
|---|---|---|
| `segments.date` | `string` | `YYYY-MM-DD`. Adding creates one row per date per campaign. **Required for daily breakdowns.** |

## Common Gotchas Summary

1. **cost_micros and average_cpm are both in micros** — always divide by `1_000_000`.
2. **Impression share fields** return 0 for non-Search campaigns — use weighted average.
3. **Video metrics** return 0 for non-video campaigns.
4. **Conversion values can be fractional** due to data-driven attribution.
5. **Segments multiply rows** — each segment creates a Cartesian product.
6. **Enum values are UPPERCASE strings** in WHERE clauses: `'ENABLED'`, not `'enabled'`.
7. **No NULL handling** — missing values return 0 or empty string.
8. **Date format** is `YYYY-MM-DD` with single quotes in GAQL.