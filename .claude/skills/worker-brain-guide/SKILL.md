---
name: worker-brain-guide
description: Comprehensive operational knowledge of the Worker Brain app — architecture, data flows, cron jobs, channel integrations, AI Analyst, Firestore collections, common patterns, and gotchas. Auto-activates on any task involving this codebase to eliminate ramp-up time and prevent basic mistakes.
---

# Worker Brain — Complete Operational Guide

This skill contains everything needed to work effectively on this codebase from the first message. It eliminates investigation time and prevents avoidable mistakes.

## App Identity

**Worker Brain** is a multi-channel marketing intelligence platform built with Next.js 14 (App Router). It syncs data from Meta Ads, Google Ads, GA4, Ecommerce (Shopify/TiendaNube/WooCommerce), Email (Klaviyo/Perfit), and Leads (GoHighLevel CRM) into a unified Firestore layer, then provides AI-powered analysis via Claude.

## Tech Stack Quick Reference

| Layer | Technology |
|---|---|
| Framework | Next.js 14, App Router, TypeScript |
| Styling | Tailwind CSS (Stitch Design System tokens in `src/lib/design-tokens.ts`) |
| Database | Firebase Firestore (Admin SDK server-side, client SDK client-side) |
| Auth | Firebase Auth (Google Provider) + HttpOnly session cookies via `middleware.ts` |
| AI (reports) | Google Generative AI (Gemini 2.0 Flash) |
| AI (analyst) | Anthropic Claude Sonnet 4.5 via `@anthropic-ai/sdk` |
| Deployment | Vercel |
| Fonts | Inter (UI), JetBrains Mono (data) |

## The Golden Rule: channel_snapshots

**ALL channel data flows into a single Firestore collection: `channel_snapshots`.**

- **Document ID**: `{clientId}__{CHANNEL}__{YYYY-MM-DD}` (built by `buildChannelSnapshotId()` from `src/types/channel-snapshots.ts`)
- **Channels**: `META`, `GOOGLE`, `GA4`, `ECOMMERCE`, `EMAIL`, `LEADS`
- **Interface**: `ChannelDailySnapshot` with `clientId`, `channel`, `date`, `metrics: UnifiedChannelMetrics`, `rawData?`, `syncedAt`
- **ChannelType** defined in `src/lib/channel-brain-interface.ts`

Every service's `syncToChannelSnapshots()` method writes here. The UI reads from here. The AI Analyst builds context from here.

## Client Configuration

The `Client` interface (`src/types/index.ts`) is the central config object stored in the `clients` Firestore collection.

**Critical fields for channel routing:**
```
integraciones: {
  meta: boolean,              // Meta Ads
  google: boolean,            // Google Ads
  ga4: boolean,               // GA4
  ecommerce: 'shopify' | 'tiendanube' | 'woocommerce' | null,
  email: 'klaviyo' | 'perfit' | null,
  leads: 'ghl' | null,       // GoHighLevel CRM
}
```

**Platform-specific credential fields:**
- Meta: `metaAdAccountId`
- Google: `googleAdsId`
- GA4: `ga4PropertyId`
- Shopify: `shopifyStoreDomain`, `shopifyAccessToken`
- TiendaNube: `tiendanubeStoreId`, `tiendanubeAccessToken`
- WooCommerce: `woocommerceStoreDomain`, `woocommerceConsumerKey`, `woocommerceConsumerSecret`
- Klaviyo: `klaviyoApiKey` (pk_...), `klaviyoPublicKey`
- Perfit: `perfitApiKey`
- GHL: `ghlLocationId`, `ghlWebhookSecret`, `leadsConfig`

**Business profile fields** (affect alert sensitivity): `growthMode`, `funnelPriority`, `targets`, `constraints.fatigueTolerance`, `constraints.scalingSpeed`, `constraints.acceptableVolatilityPct`

## Cron Jobs — Execution Order

All crons run as API routes in `src/app/api/cron/`. Auth via `Authorization: Bearer <CRON_SECRET>` header (GET) or `x-cron-secret` header (POST).

### Phase 1: Channel Syncs (09:00 UTC — yesterday's data)

| Cron | Route | Service | What It Does |
|---|---|---|---|
| Meta Sync | `/api/cron/sync-meta` | Direct Meta Graph API | Fetches yesterday's account-level Meta metrics |
| Google Sync | `/api/cron/sync-google` | `GoogleAdsService` | GAQL queries for campaign metrics + search terms |
| GA4 Sync | `/api/cron/sync-ga4` | `GA4Service` | GA4 Data API for web analytics |
| Ecommerce Sync | `/api/cron/sync-ecommerce` | `ShopifyService` / `TiendaNubeService` / `WooCommerceService` | Fetches yesterday's orders |
| Email Sync | `/api/cron/sync-email` | `KlaviyoService` / `PerfitService` | Campaign + flow/automation metrics |
| Leads Sync | `/api/cron/sync-leads` | `LeadsService` | Aggregates lead records from `leads` collection |

### Phase 2: Processing (10:00 UTC — after syncs complete)

| Cron | Route | What It Does |
|---|---|---|
| Data Sync | `/api/cron/data-sync` | Meta rolling metrics, client snapshots, alerts, Slack digest, backfill |
| Creative Sync | `/api/cron/sync-creatives` | Fetch ad metadata from Meta |
| Classify Entities | `/api/cron/classify-entities` | GEM classification (6 categories) |
| Creative DNA | `/api/cron/creative-dna` | Gemini Vision analysis of creatives |
| Daily Digest | `/api/cron/daily-digest` | Slack MTD + CRITICAL alerts |
| Semaforo | `/api/cron/semaforo` | Quarterly pacing engine |
| Fill Gaps | `/api/cron/fill-gaps` | Fills missing days with zero-spend snapshots |

### Periodic

| Cron | Schedule | What It Does |
|---|---|---|
| Weekly Alerts | `/api/cron/weekly-alerts` (Monday) | Slack WoW summary + WARNING alerts |
| Account Health | `/api/cron/account-health` (every 2h) | Meta account status & spend cap checks |

## Channel Backfill System

`src/lib/channel-backfill-service.ts` — Auto-fires on:
- `POST /api/clients` — new client creation (backfills ALL configured channels)
- `PATCH /api/clients/:id` — detects newly enabled channels (backfills only those)

**Range**: Current "cuatrimestre" start to yesterday. Logic: `Math.floor(month / 4) * 4` → Q1=Jan, Q2=May, Q3=Sep.

Each channel dispatches to its service's `syncToChannelSnapshots(clientId, ...credentials, startDate, endDate)`.

## AI Analyst System

Interactive chat panel powered by Claude. Key files in `src/lib/ai-analyst/`:

| File | Purpose |
|---|---|
| `types.ts` | `ChannelId`, `AnalystContext`, `CHANNEL_TO_FIRESTORE`, `SUGGESTED_QUESTIONS` |
| `context-builder.ts` | Builds `AnalystContext` from Firestore (client config + channel_snapshots + entity data) |
| `xml-formatter.ts` | Converts context → XML for Claude's system prompt |
| `prompts.ts` | Channel-specific system prompts with 5-min cache. Reads `brain_prompts/{channelId}`, falls back to defaults |

**ChannelIds**: `meta_ads`, `google_ads`, `ga4`, `ecommerce`, `email`, `leads`, `cross_channel`, `creative_briefs`

**Mapping to Firestore**: `CHANNEL_TO_FIRESTORE` maps analyst channel IDs → ChannelType (e.g., `meta_ads` → `'META'`, `cross_channel` → `null`)

**API**: `POST /api/ai-analyst/chat` — SSE streaming, 30 req/hr rate limit per user (tracked in `ai_analyst_rate_limits/{uid}`)

**Prompt stacking**: 4 layers (base role → domain expertise → business context → live data). Prompts in `brain_prompts/{channelId}` override built-in defaults. Editable via Cerebro Tab 5.

**Token budget**: ~30k max. Limits: 15 campaigns, 10 creatives, 10 products, 10 email campaigns, 10 automations. Nulls omitted, floats rounded to 2 decimals.

## Cerebro de Worker (`/admin/cerebro`)

5 tabs for all AI logic:
1. **Generadores IA** — 5 prompt types (report, creative-audit, creative-variations, recommendations, concept-briefs)
2. **Motor de Decisiones** — Per-client EngineConfig editor
3. **Clasificador Creativo** — 6-category classifier view
4. **Consola de Pruebas** — Test console for any prompt + client
5. **AI Analyst** — Per-channel system prompt editor

Brain prompt CRUD: `GET/POST/DELETE /api/admin/brain-prompts`, defaults: `GET /api/admin/brain-prompts/defaults`

## Firestore Collections Quick Reference

| Collection | Doc ID Format | Purpose |
|---|---|---|
| `clients` | auto | Client configs |
| `channel_snapshots` | `{clientId}__{CHANNEL}__{YYYY-MM-DD}` | Unified daily metrics |
| `meta_creatives` | `{clientId}__{adId}` | Synced ad metadata |
| `creative_kpi_snapshots` | various | 6h cached performance |
| `creative_dna` | `{clientId}__{adId}` | AI-analyzed creative attributes |
| `creative_diversity_scores` | `{clientId}` | Diversity scores |
| `entity_rolling_metrics` | various | 3d/7d/14d/30d rolling windows |
| `daily_entity_snapshots` | various | Daily entity data |
| `client_snapshots` | `{clientId}` | Pre-computed client snapshots + alerts |
| `engine_configs` | linked by clientId | Per-client decision thresholds |
| `brain_prompts` | `{channelId}` | AI Analyst system prompts |
| `ai_analyst_rate_limits` | `{uid}` | Per-user rate counters |
| `prompt_templates` | various | Gemini prompt versions |
| `system_events` | auto | Observability log |
| `cron_executions` | auto | Cron history |
| `leads` | `{clientId}__{ghlContactId}` or auto | Individual lead records |
| `teams` | auto | Team groupings |
| `tiendanube_auth_tokens` | auto | Temp OAuth tokens for unlinked stores |

## Common Patterns & Conventions

### Service Pattern
All channel services are static classes (no instantiation):
```typescript
export class ShopifyService {
  static async syncToChannelSnapshots(clientId, domain, token, start, end): Promise<{ daysWritten: number }>
}
```

### Firestore Batch Writes
Firestore batches max 500 ops. Code chunks at 400 to be safe:
```typescript
for (let i = 0; i < items.length; i += 400) {
  const batch = db.batch();
  // ... add ops
  await batch.commit();
}
```

### Firebase Admin Init
`src/lib/firebase-admin.ts` — Singleton with `ignoreUndefinedProperties: true`. Never import client SDK in server code.

### Date Handling
- All dates as `YYYY-MM-DD` strings (not Date objects)
- "Yesterday" = `new Date(); d.setDate(d.getDate() - 1); d.toISOString().split('T')[0]`
- Google Ads `cost_micros` → divide by 1,000,000
- GA4 dates come as `YYYYMMDD` → must convert to `YYYY-MM-DD`
- Klaviyo rates as decimals (0.25 = 25%) → multiply by 100

### Error Handling in Cron
Every cron logs via `EventService` to `system_events` and `cron_executions`. Pattern:
```typescript
await EventService.log('cron.start', { job: 'sync-meta' });
try { ... await EventService.log('cron.success', { job, metadata }); }
catch (e) { await EventService.log('cron.error', { job, error: e.message }); }
```

### Authentication Flow
1. Client-side: Firebase Auth Google sign-in → get ID token
2. `POST /api/auth/session` → server verifies token → creates HttpOnly cookie
3. `middleware.ts` checks cookie on protected routes (`/creative`, `/select-account`, `/admin/*`)
4. `useAuth()` hook provides `user`, `loading`, `signInWithGoogle()`, `signOut()`

## References

- **Architecture & File Map**: See [references/architecture.md](references/architecture.md)
- **Cron & Data Flow Details**: See [references/cron-and-sync.md](references/cron-and-sync.md)
- **AI Analyst Deep Dive**: See [references/ai-analyst.md](references/ai-analyst.md)
- **Gotchas & Common Mistakes**: See [references/common-patterns.md](references/common-patterns.md)
