# Advanced Meta Insights Reporting

Detailed techniques for robust reporting and high-volume data extraction.

## Action Breakdowns
When requesting `actions` or `action_values`, results are returned as a list of objects:
```json
{
  "action_type": "purchase",
  "value": "12"
}
```
To calculate total conversions, filter by the relevant `action_type` (e.g., `purchase`, `lead`, `add_to_cart`) based on the business objective.

## Attribution Windows
Meta's default attribution window has changed over time. For consistent reporting, specify `action_attribution_windows` explicitly if needed:
- `1d_click`
- `7d_click`
- `1d_view`
- `28d_click` (Legacy/Specific cases)

## Async Reporting (`async=true`)
For large datasets or breakdwons that time out on synchronous requests:
1. Initialize: `POST /{object_id}/insights?async=true&fields=...`
2. Poll: `GET /{report_run_id}`
3. Retrieve: Once `async_status` is `Job Completed`, fetch results from the provided URL.

## Breakdowns
Use `breakdowns` to slice data by dimensions:
- **Demographics**: `age`, `gender`.
- **Geography**: `country`, `region`.
- **Placement**: `publisher_platform`, `platform_position`, `device_platform`.
- **Time**: `time_increment=1` (Daily), `7` (Weekly), or `all_days`.

> **Warning**: Breakdowns multiply the number of rows significantly and can lead to rate limit saturation if not managed carefully.

## Field Expansions
Retrieve parent/child data in a single call to minimize roundtrips:
`GET /act_{ID}/ads?fields=name,insights{impressions,spend},campaign{name},adset{name}`
This returns the ad name, its insights, and the names of its parent campaign and adset.
