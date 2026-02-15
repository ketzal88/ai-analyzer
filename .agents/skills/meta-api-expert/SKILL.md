---
name: meta-api-expert
description: Specialized knowledge for Meta Ads (Marketing) API. Use when working with Meta/Facebook Ads API integrations, fetching insights, managing campaigns, adsets, ads, or creatives, and handling API field validation and rate limits.
---

# Meta Ads API Expert

This skill provides comprehensive knowledge for interacting with the **Meta Marketing API** (v18.0+), focusing on structure, resource management, and high-performance insights reporting.

## Core Concepts

- **Graph API Structure**: Everything is a node (Ad Account, Campaign, Ad Set, Ad) connected by edges.
- **Insights API**: A specialized edge for performance data.
- **Metadata Discovery**: Metadata is dynamic. Always verify available fields before requesting large sets.

## Strategic Workflow Recommendations

1. **Dynamic Field Discovery**: Never hardcode field lists for long-term use. 
   - Call `GET /act_{ID}/insights?metadata=1` once per API version.
   - Cache results and validate requests against this metadata.
2. **Error-Driven Auto-Depuration**: If a request fails with `(#100) ... is not valid`, dynamically remove the offending field and retry.
3. **Block-Based Requests**: Divide metrics into blocks (Base, Video, Engagement, Conversion) to simplify debugging and optimization.
4. **Action Mapping**: `actions` and `action_values` return arrays. Map these `action_type` values to a core internal dictionary (e.g., `conversions_core`).

## Hierarchy & Operations

### 1. Campaigns (`/campaigns`)
- **Key Fields**: `id`, `name`, `status`, `effective_status`, `objective`, `buying_type`, `daily_budget`.
- **Creation**: `POST /act_{ID}/campaigns` requiring `name`, `objective`, `buying_type`.

### 2. Ad Sets (`/adsets`)
- **Key Fields**: `id`, `name`, `billing_event`, `optimization_goal`, `targeting`, `bid_strategy`.
- **Relationship**: Always linked to a `campaign_id`.

### 3. Ads & Creatives (`/ads`, `/adcreatives`)
- **Key Fields**: `creative`, `tracking_specs`, `image_url`, `video_id`, `body`.
- **Workflow**: Create `AdCreative` first, then create `Ad` referencing the `creative_id`.

## Performance Metrics (Insights)

Meta supports over 70 standard metrics. To keep requests efficient and stable, use the categorized reference.

- **Standard Metrics**: See [references/fields.md](references/fields.md) for the stable list of ~70 metrics.
- **Advanced Insights**: See [references/insights-advanced.md](references/insights-advanced.md) for attribution windows, async reporting, and action breakdowns.
- **Implementation Patterns**: See [references/implementation-patterns.md](references/implementation-patterns.md) for field validation and discovery code samples.

## Rate Limits & Best Practices

- **Account Score**: Reads = 1pt, Writes = 3pts.
- **Budget Changes**: Max 4 changes per hour per Ad Set.
- **Exponential Backoff**: Mandatory for error code 613 (Rate Limit).
- **Batching**: Use batch requests or async jobs for large data exports.
