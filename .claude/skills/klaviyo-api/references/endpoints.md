# Klaviyo Endpoints Reference

Base URL: `https://a.klaviyo.com/api`

## Common Headers (All Requests)

```
Authorization: Klaviyo-API-Key {PRIVATE_API_KEY}
Content-Type: application/json
Accept: application/json
revision: 2025-04-15
```

The `revision` header is **mandatory** — requests fail without it.

## Metrics

### `GET /metrics`

Returns all tracked metrics for the account. Used to discover the "Placed Order" metric ID needed for conversion reporting.

**Response** (JSON:API format):
```json
{
  "data": [
    {
      "id": "metric_id_here",
      "attributes": {
        "name": "Placed Order",
        "integration": { "name": "Shopify" }
      }
    }
  ]
}
```

**Discovery priority**: Prefer "Placed Order" from Shopify integration, then any metric matching "placed order" (case-insensitive).

## Campaigns

### `GET /campaigns`

**Query Parameters**: `filter=equals(messages.channel,'email')`, `sort=-scheduled_at`

**Pagination**: JSON:API cursor-based via `links.next` URL.

**Response**:
```json
{
  "data": [
    {
      "id": "campaign_id",
      "attributes": {
        "name": "Campaign Name",
        "status": "Sent",
        "send_time": "2025-01-15T10:00:00+00:00"
      }
    }
  ],
  "links": { "next": "https://..." }
}
```

**Rate limit**: 10/s burst, 150/min steady.

## Campaign Values Report

### `POST /campaign-values-reports/`

**Rate limit**: 1/s burst, 2/min steady, **225/day** — use sparingly!

**Request body**:
```json
{
  "data": {
    "type": "campaign-values-report",
    "attributes": {
      "timeframe": {
        "start": "2025-01-01T00:00:00+00:00",
        "end": "2025-01-31T23:59:59+00:00"
      },
      "conversion_metric_id": "METRIC_ID_HERE",
      "group_by": ["campaign_id", "campaign_message_id"],
      "statistics": [
        "recipients", "delivered", "opens", "open_rate",
        "clicks", "click_rate", "bounced", "bounce_rate",
        "unsubscribes", "unsubscribe_rate",
        "conversion_value", "conversions", "revenue_per_recipient"
      ]
    }
  }
}
```

**Response**:
```json
{
  "data": {
    "attributes": {
      "results": [
        {
          "groupings": {
            "campaign_id": "xxx",
            "campaign_name": "My Campaign",
            "send_time": "2025-01-15T10:00:00+00:00"
          },
          "statistics": {
            "recipients": 5000,
            "delivered": 4800,
            "opens": 1200,
            "open_rate": 0.25,
            "clicks": 300,
            "click_rate": 0.0625,
            "bounced": 200,
            "bounce_rate": 0.04,
            "unsubscribes": 15,
            "conversion_value": 2500.00,
            "conversions": 45
          }
        }
      ]
    }
  }
}
```

## Flows

### `GET /flows`

**Pagination**: JSON:API cursor-based via `links.next`.

**Response**:
```json
{
  "data": [
    {
      "id": "flow_id",
      "attributes": {
        "name": "Welcome Series",
        "status": "live",
        "trigger_type": "list"
      }
    }
  ]
}
```

## Flow Values Report

### `POST /flow-values-reports/`

**Rate limit**: Same as campaign values — 2/min, 225/day.

**Request body**:
```json
{
  "data": {
    "type": "flow-values-report",
    "attributes": {
      "timeframe": {
        "start": "2025-01-01T00:00:00+00:00",
        "end": "2025-01-31T23:59:59+00:00"
      },
      "conversion_metric_id": "METRIC_ID_HERE",
      "group_by": ["flow_id", "flow_message_id"],
      "statistics": [
        "recipients", "delivered", "opens", "clicks",
        "click_rate", "bounced", "conversion_value", "conversions"
      ]
    }
  }
}
```

## Important Notes

- **JSON:API format**: All responses wrap data in `{ data: [...] }` with `attributes` nesting.
- **Rates are decimals** (0-1): `open_rate: 0.25` means 25%. Multiply by 100 for display.
- **Reporting API is separate** from CRUD APIs — different rate limits.
- **31-second pause** required between consecutive reporting API calls (2/min limit).
- **225/day hard cap** on reporting calls — be strategic about what you query.
- **Timeframe format**: ISO 8601 with timezone offset (`+00:00`), not just `T00:00:00`.