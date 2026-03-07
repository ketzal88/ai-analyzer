# Cron Jobs & Data Sync — Detailed Reference

## How Cron Auth Works

Two auth patterns coexist:
1. **GET + Bearer**: `Authorization: Bearer <CRON_SECRET>` — used by data-sync, daily-digest, weekly-alerts, account-health, creative-dna, semaforo, fill-gaps
2. **POST + header**: `x-cron-secret` header — used by sync-creatives, classify-entities
3. **GET + query param or header**: Some newer crons check both

Vercel only has ONE cron in `vercel.json`: `/api/cron/data-sync` at 10:00 UTC. The channel syncs (sync-meta, sync-google, etc.) are triggered separately (external scheduler or manual).

## Channel Sync Details

### sync-meta (`/api/cron/sync-meta`)
- Iterates ALL active clients with `integraciones.meta && metaAdAccountId`
- Uses Meta Graph API directly (no service class for account-level sync)
- Fetches yesterday's metrics: spend, impressions, clicks, reach, frequency, actions, action_values, video metrics
- Writes to `channel_snapshots` with `channel: 'META'`
- Handles `act_` prefix normalization
- Fills zero-spend days with `rawData: { filled: true, reason: 'no_spend' }`

### sync-google (`/api/cron/sync-google`)
- Iterates clients with `integraciones.google && googleAdsId`
- Calls `GoogleAdsService.syncToChannelSnapshots(clientId, customerId, startDate, endDate)`
- GAQL query fetches: cost_micros (÷1M!), impressions, clicks, conversions, conversions_value, video quartiles, search impression share
- Also fetches search terms via `fetchSearchTerms()` — top 50 by spend, try/catch for non-search campaigns
- Writes to `channel_snapshots` with `channel: 'GOOGLE'`

### sync-ga4 (`/api/cron/sync-ga4`)
- Iterates clients with `integraciones.ga4 && ga4PropertyId`
- Calls `GA4Service.syncToChannelSnapshots(clientId, propertyId, startDate, endDate)`
- Uses `googleapis` REST package (NOT gRPC)
- Date format gotcha: GA4 returns `YYYYMMDD`, must convert to `YYYY-MM-DD`
- Decimals gotcha: bounceRate/engagementRate come as 0-1, multiply by 100
- Writes to `channel_snapshots` with `channel: 'GA4'`

### sync-ecommerce (`/api/cron/sync-ecommerce`)
- Iterates clients, dispatches based on `integraciones.ecommerce`:
  - `'shopify'` → `ShopifyService.syncToChannelSnapshots(clientId, domain, token, start, end)`
  - `'tiendanube'` → `TiendaNubeService.syncToChannelSnapshots(clientId, storeId, token, start, end)`
  - `'woocommerce'` → `WooCommerceService.syncToChannelSnapshots(clientId, domain, key, secret, start, end)`
- All write to `channel_snapshots` with `channel: 'ECOMMERCE'`
- Platform detectable via `rawData.source`: `'shopify'` | `'tiendanube'` | `'woocommerce'`

### sync-email (`/api/cron/sync-email`)
- Dispatches based on `integraciones.email`:
  - `'klaviyo'` → `KlaviyoService.syncToChannelSnapshots(clientId, apiKey, start, end)`
  - `'perfit'` → `PerfitService.syncToChannelSnapshots(clientId, apiKey, start, end)`
- All write to `channel_snapshots` with `channel: 'EMAIL'`
- Platform detectable via `rawData.source`: `'klaviyo'` | `'perfit'`

### sync-leads (`/api/cron/sync-leads`)
- Calls `LeadsService.syncToChannelSnapshots(clientId, start, end)`
- Aggregates individual `leads` collection records into daily channel_snapshots
- Writes to `channel_snapshots` with `channel: 'LEADS'`
- Computes funnel metrics: totalLeads, qualifiedLeads, attendedCalls, newClients, etc.

## Processing Crons

### data-sync (`/api/cron/data-sync`) — The Big One
This is the ONLY cron in vercel.json. It orchestrates:
1. Meta rolling metrics computation (`PerformanceService`)
2. Client snapshot computation (`ClientSnapshotService.computeAndStore()`)
3. Alert evaluation (`AlertEngine.evaluate()` — called inline by ClientSnapshotService)
4. Slack daily digest
5. Backfill batch (fills gaps for recent clients)

### classify-entities (`/api/cron/classify-entities`)
- Runs the GEM classification engine on Meta entities
- 6 categories: DOMINANT_SCALABLE, WINNER_SATURATING, HIDDEN_BOFU, INEFFICIENT_TOFU, ZOMBIE, NEW_INSUFFICIENT_DATA
- Depends on rolling metrics being fresh (runs AFTER data-sync)

### creative-dna (`/api/cron/creative-dna`)
- Gemini Vision analyzes creative images/videos
- Extracts: visualStyle, hookType, dominantColor, hasText, hasFace, hasProduct, settingType, emotionalTone
- Copy analysis (deterministic NLP): messageType, hasNumbers, hasEmoji, wordCount, ctaType
- Writes to `creative_dna` collection
- Also updates `creative_diversity_scores` per client

### daily-digest (`/api/cron/daily-digest`)
- Sends Slack messages to each client's `slackPublicChannel`
- Content: MTD snapshot + CRITICAL alerts + SCALING_OPPORTUNITY alerts
- Only `slack_immediate` channel alerts

### weekly-alerts (`/api/cron/weekly-alerts`) — Monday only
- WoW KPI comparison
- `slack_weekly` channel alerts (WARNING severity)

## Manual Triggering

Via admin UI at `/admin/cron` or direct API:
```
GET /api/cron/{job-name}?secret={CRON_SECRET}
// or
GET /api/cron/{job-name} -H "Authorization: Bearer {CRON_SECRET}"
```

Also: `POST /api/admin/trigger-cron` with body `{ "job": "sync-meta", "clientId": "optional" }`.

## Simulation Scripts

```bash
# Full Monday simulation
npx tsx --require ./scripts/load-env.cjs scripts/simulate-monday-cron.ts

# Skip data-sync (use existing data)
npx tsx --require ./scripts/load-env.cjs scripts/simulate-monday-remaining.ts
```

## Backfill Scripts (one-time historical data)

```bash
# Email backfill (3 months)
npx tsx --require ./scripts/load-env.cjs scripts/sync-klaviyo-backfill.ts
npx tsx --require ./scripts/load-env.cjs scripts/sync-perfit-backfill.ts
```
