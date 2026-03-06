# Master Reference: Meta Ads Diagnostic Tool

This document is the **Single Source of Truth** for the Meta Ads Diagnostic Tool. It consolidates all previous mission reports and technical documentation.

---

## 1. Project Overview & Tech Stack

A high-performance Next.js application designed to analyze Meta Ads creatives using intelligent scoring and AI-driven insights (Gemini/GEM paradigms).

### Technical Foundation
- **Framework**: Next.js 14 (App Router), TypeScript
- **Styling**: Tailwind CSS (Stitch Design System implementation)
- **Database/Auth**: Firebase (Firestore, Auth, Admin SDK)
- **AI Engine**: Google Generative AI (Gemini 2.0 Flash) + Anthropic Claude (AI Analyst)
- **Deployment**: Vercel

---

## 2. Infrastructure & Setup

### Environment Variables (.env.local)
```env
# Firebase Public
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
...
# Firebase Admin (Server-side)
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
# AI & Meta
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.0-flash
META_ACCESS_TOKEN=...
CRON_SECRET=...
# Shopify OAuth (Partners App)
SHOPIFY_CLIENT_ID=...
SHOPIFY_CLIENT_SECRET=...
# Tienda Nube OAuth (Marketplace App)
TIENDANUBE_APP_ID=...
TIENDANUBE_CLIENT_SECRET=...
# Slack
SLACK_BOT_TOKEN=...
# AI Analyst (Claude)
ANTHROPIC_API_KEY=...
```

### Firestore Infrastructure
- **Initialization**: Configured with `ignoreUndefinedProperties: true` for stability.
- **Indexes**: Managed via `firestore.indexes.json`. Critical for range-based KPI queries and creative filtering.
- **Deploying Indexes**: `firebase deploy --only firestore:indexes`.

### Key Firestore Collections
| Collection | Purpose |
|---|---|
| `clients` | Client configs, Meta account IDs, Slack channels, business profile |
| `meta_creatives` | Synced ads from Meta (ID: `clientId__adId`) |
| `creative_kpi_snapshots` | 6h cached performance views |
| `prompt_templates` | AI prompt versions with critical instructions & output schemas |
| `engine_configs` | Per-client decision thresholds (fatigue, structure, alerts, video, format, intent, learning) |
| `system_events` | Observability event log |
| `cron_executions` | Cron job execution history |
| `entity_rolling_metrics` | Rolling aggregation metrics (3d/7d/14d/30d windows + video metrics) |
| `daily_entity_snapshots` | Daily snapshot data |
| `client_snapshots` | Pre-computed client snapshots with alerts (ID: `clientId`) |
| `creative_dna` | AI-analyzed creative attributes (ID: `clientId__adId`) |
| `creative_diversity_scores` | Per-client creative diversity scores (ID: `clientId`) |
| `channel_snapshots` | Unified daily metrics per channel (ID: `clientId__CHANNEL__YYYY-MM-DD`) |
| `tiendanube_auth_tokens` | Temporary OAuth tokens for unlinked TiendaNube stores |
| `brain_prompts` | AI Analyst system prompts per channel (ID: `channelId`) |
| `ai_analyst_rate_limits` | Per-user rate limit counters for AI Analyst (ID: `uid`) |

---

## 3. Core Modules

### Authentication & Sessions
- **System**: Firebase Auth with Google Provider.
- **Security**: Uses HttpOnly cookies ("session") managed via `middleware.ts` for route protection (`/creative`, `/select-account`).
- **Hook**: `useAuth()` provides `user`, `loading`, `signInWithGoogle()`, and `signOut()`.

### Creative Library (AG-41)
- **Sync**: Daily cron job (`/api/cron/sync-creatives`) fetches ads from Meta.
- **Normalization**: Automatic detection of formats (IMAGE, VIDEO, CAROUSEL, CATALOG).
- **Deduplication**: Fingerprint-based (SHA256) to avoid redundant storage and processing.
- **Storage**: `meta_creatives` collection using ID format `${clientId}__${adId}`.

### KPI Engine & Scoring (AG-42)
- **Snapshots**: Cached 6-hour performance views in `creative_kpi_snapshots`.
- **Intelligent Scoring**: Weighted formula (Spend, Impressions, Fatigue, Opportunity, Newness).
- **Clustering**: Groups similar creatives by fingerprint to reduce AI analysis tokens by ~70-80%.
- **Frontend Caching**: Global `ClientContext` caches performance snapshots in memory.
- **Historical Analysis**: Versioned snapshots (`clientId_YYYY-MM-DD`) with 7/14/30-day comparisons.

### Objective-Aware Pipeline
- **Source of Truth**: `src/lib/objective-utils.ts` — Single centralized module for campaign objective → metric mapping.
- **Supported Objectives**: `sales`, `leads`, `messaging`, `scheduling`, `traffic`, `awareness`, `app_installs`, `video_views`.
- **Key Functions**:
  - `resolveObjective(metaObjective, entityName, clientOverride)` — Maps Meta API objective strings to internal types.
  - `getPrimaryMetric(objective)` — Returns the correct rolling field, daily field, and labels per objective.
  - `getPrimaryMetricValue(rolling, objective)` — Extracts the correct metric value from rolling data.
  - `isCpaRelevant(objective)` / `isRoasRelevant(objective)` — Determines if CPA/ROAS alerts apply.
  - `businessTypeToObjective(businessType)` — Fallback mapping from client business type.
- **Integration**: Used by AlertEngine, DecisionEngine, ClientSnapshotService, PerformanceService, CreativeClassifier, and SlackService. Eliminates 6+ duplicate objective implementations.

### Engine Configuration & Tuning
- **Service**: `EngineConfigService` manages per-client analysis thresholds.
- **Config Sections**: `fatigue`, `structure`, `alerts`, `findings`, `learning`, `intent`, `video`, `format`.
- **Persistence**: Stored in `engine_configs` collection, linked by `clientId`.
- **UI**: Integrated in "Cerebro de Worker" (`/admin/cerebro`) Tab 2.
- **Defaults**: `getDefaultEngineConfig(clientId)` in `src/types/engine-config.ts`.

### Alert Engine & Notification Routing
- **Architecture**: `AlertEngine.evaluate()` is a **pure computation function** (no DB access). Takes `AlertEvaluationInput` and returns `Alert[]`. Used by both `AlertEngine.run()` (standalone with DB) and `ClientSnapshotService.computeAndStore()` (inline snapshot computation).
- **16 Alert Types**:

| Alert Type | Severity | Channel | Trigger |
|---|---|---|---|
| `SCALING_OPPORTUNITY` | INFO | `slack_immediate` | CPA below target + stable velocity + low frequency |
| `LEARNING_RESET_RISK` | WARNING | `slack_weekly` | Budget change >30% + recent edit (adset level) |
| `CPA_SPIKE` | CRITICAL | `slack_immediate` | CPA delta > cpaSpikeThreshold |
| `BUDGET_BLEED` | CRITICAL | `slack_immediate` | 0 conversions + spend > 2x targetCPA |
| `CPA_VOLATILITY` | WARNING | `slack_weekly` | Budget change > volatilityThreshold |
| `ROTATE_CONCEPT` | CRITICAL | `slack_immediate` | Classification fatigue: REAL / CONCEPT_DECAY / AUDIENCE_SATURATION |
| `CONSOLIDATE` | WARNING | `slack_weekly` | Classification structure: FRAGMENTED / OVERCONCENTRATED |
| `KILL_RETRY` | WARNING | `slack_weekly` | Classification decision: KILL_RETRY |
| `INTRODUCE_BOFU_VARIANTS` | INFO | `panel_only` | Classification decision: INTRODUCE_BOFU_VARIANTS |
| `HOOK_KILL` | CRITICAL | `slack_immediate` | Video hook rate < 20% + spend > $50 |
| `BODY_WEAK` | WARNING | `slack_weekly` | Video hook > 25% but hold < 30% |
| `CTA_WEAK` | WARNING | `slack_weekly` | Video hook+hold OK but CTR < 0.8% |
| `VIDEO_DROPOFF` | INFO | `panel_only` | Video drop-off detected at p50/p75/p100 |
| `IMAGE_INVISIBLE` | WARNING | `slack_weekly` | Image CTR < 0.5% + impressions > 2000 |
| `IMAGE_NO_CONVERT` | WARNING | `slack_weekly` | Image CTR > 1.5% but CPA > 2x target |
| `CREATIVE_MIX_IMBALANCE` | WARNING | `slack_weekly` | Low format diversity or >80% spend in one format |

- **Channel Routing** (`getAlertChannel()`):
  - `slack_immediate`: CRITICAL alerts + SCALING_OPPORTUNITY → sent in daily digest
  - `slack_weekly`: WARNING alerts → sent in weekly digest
  - `panel_only`: INFO alerts → visible only in dashboard
- **Deduplication**: Ad-level alerts take priority over adset-level (same type, same adset → keep ad).
- **Configurable**: All thresholds in `EngineConfig`, alert types toggled via `enabledAlerts` array.
- **Templates**: Customizable per alert type in `config.alertTemplates` with `{variable}` interpolation.

### Slack Service
- **Daily Digest** (`/api/cron/daily-digest`): MTD snapshot + only `slack_immediate` alerts (CRITICAL + SCALING_OPPORTUNITY).
- **Weekly Digest** (`/api/cron/weekly-alerts`): WoW KPI summary + `slack_weekly` alerts (WARNING).
- **Critical Alerts**: Individual messages for each CRITICAL alert.
- **Error Channel**: Structured error reports via `SlackService.sendError()`.

### Video Metrics & Diagnostics
- **Computed in**: `PerformanceService.updateRollingMetrics()` and `computeRollingForEntity()`.
- **Rolling Metrics**:
  - `hook_rate_7d`: 3-second views / impressions (%)
  - `hold_rate_7d`: ThruPlays (p75) / 3-second views (%)
  - `hold_rate_delta_pct`: Hold rate change vs previous period
  - `completion_rate_7d`: p100 completions / video plays (%)
  - `drop_off_point`: Stage with biggest audience loss (`p25` | `p50` | `p75` | `p100`)
  - `frequency_velocity_3d`: Daily frequency change rate `(freq_3d - freq_prev_3d) / 3`
- **Helpers**: `calcDropOffPoint()`, `calcFrequencyVelocity()` in `performance-service.ts`.

### Creative DNA — AI-Powered Creative Analysis
- **Service**: `src/lib/creative-dna-service.ts` — Analyzes creative visual and copy attributes.
- **Types**: `src/types/creative-dna.ts`
- **Cron**: `/api/cron/creative-dna` (daily, after sync-creatives)
- **Analysis Pipeline**:
  - **Vision** (Gemini): `visualStyle`, `hookType`, `dominantColor`, `hasText`, `hasFace`, `hasProduct`, `settingType`, `emotionalTone`
  - **Copy** (deterministic NLP): `messageType`, `hasNumbers`, `hasEmoji`, `wordCount`, `ctaType`
  - **Entity Group**: Estimated grouping by `visualStyle_hookType_settingType`
- **Format Types**: `VIDEO`, `IMAGE`, `CAROUSEL`, `CATALOG`
- **Diversity Score**: `uniqueEntityGroups / totalActiveAds` — stored in `creative_diversity_scores` per client.
- **Storage**: `creative_dna` collection (ID: `clientId__adId`)

### Creative Intelligence (Classifier & Patterns)
- **Service**: `src/lib/creative-classifier.ts` — Classifies creatives into 6 categories:
  - `DOMINANT_SCALABLE`: High spend + efficient CPA. Scale aggressively.
  - `WINNER_SATURATING`: Was efficient but showing fatigue (high frequency/rising CPA).
  - `HIDDEN_BOFU`: Low spend but excellent conversion metrics. Increase budget.
  - `INEFFICIENT_TOFU`: High spend + poor efficiency. Cut or restructure.
  - `ZOMBIE`: Minimal spend, minimal results. Pause or refresh.
  - `NEW_INSUFFICIENT_DATA`: Too new to classify (<4 days or <2000 impressions).
- **DNA Enrichment**: When `dnaMap` is provided, each classified result includes `dnaInsight` — a human-readable trait string (e.g., "ugc + curiosity hook + face + offer copy + video").
- **Pattern Detection**: `src/lib/creative-pattern-service.ts` — Detects winning patterns across creatives (format, messaging, audience correlations).

### Cerebro de Worker (AI Brain) — `/admin/cerebro`
Centralized hub for ALL AI logic. 5 tabs:

1. **Generadores IA**: 5 prompt types (Report, Creative Audit, Creative Variations, Recommendations, Concept Briefs). Each has editable System Prompt, Critical Instructions (previously hardcoded, now DB-overridable), User Template, and Output Schema.
2. **Motor de Decisiones**: Per-client EngineConfig editor.
3. **Clasificador Creativo**: Read-only view of 6 creative categories (see Creative Intelligence above).
4. **Consola de Pruebas**: Unified test console for any prompt type + client.
5. **AI Analyst**: Per-channel system prompt editor for the conversational AI Analyst. Reads/writes `brain_prompts/{channelId}` in Firestore. Shows default prompt from code, allows custom override, and reverts to default on reset. Custom prompts marked with amber dot. 5-minute server cache on prompt reads.

- **Utility**: `src/lib/prompt-utils.ts` — `buildSystemPrompt()`, `getDefaultCriticalInstructions()`, `getDefaultOutputSchema()`, `PROMPT_KEYS`.
- **Pattern**: `systemPrompt = baseSystem + (dbCriticalInstructions || defaultForKey)`. Backward-compatible: if no `criticalInstructions` in DB, uses the original hardcoded defaults.
- **Prompt Keys**: `report`, `creative-audit`, `creative-variations`, `recommendations_v1`, `concept_briefs_v1`.
- **AI Analyst APIs**: `GET/POST/DELETE /api/admin/brain-prompts` (CRUD for custom prompts), `GET /api/admin/brain-prompts/defaults` (built-in defaults from code).

### Ecommerce Integration (Shopify + Tienda Nube + WooCommerce)
Multi-platform ecommerce data sync. All platforms write to the same `channel_snapshots` collection with `channel: 'ECOMMERCE'`.

**Shopify** — OAuth Partners App:
- **App**: "Worker Brain" in Shopify Partners (Custom Distribution).
- **OAuth Flow**: `/api/integrations/shopify/auth` (Step 1: redirect to Shopify) → `/api/integrations/shopify/callback` (Step 2: HMAC verify, code→token exchange, save to Firestore).
- **Scopes**: `read_orders`, `read_products`, `read_analytics`, `read_customers`, `read_checkouts`.
- **Service**: `src/lib/shopify-service.ts` — REST Admin API v2024-01, cursor-based pagination (Link header), rate limit handling.
- **Client Fields**: `shopifyStoreDomain`, `shopifyAccessToken`, `integraciones.ecommerce: 'shopify'`.
- **Expanded Metrics**: Financial (grossRevenue, netRevenue, totalDiscounts, discountRate, totalTax, totalShipping), Customer (newCustomers, returningCustomers, repeatPurchaseRate), Operations (fulfilledOrders, cancelledOrders, fulfillmentRate, itemsPerOrder), Abandoned Carts (abandonedCheckouts, abandonedCheckoutValue, cartAbandonmentRate).
- **Customer LTV**: Computes `avgLtv` per cohort (firstTime, returning, VIP) from `customer.total_spent`. Uses `Map<customerId, totalSpent>` per cohort to deduplicate across orders.
- **Attribution**: UTM parsing from `landing_site` + `referring_site` → classifies into meta_ads, google_ads, email, direct, google_organic, etc.
- **Raw Data**: Top products, discount codes, attribution breakdown, customer segmentation.

**Tienda Nube** — OAuth Marketplace App:
- **OAuth Flow**: `/api/tiendanube/auth` (receives `?code=XXX` from marketplace install) → exchanges for token via `POST https://www.tiendanube.com/apps/authorize/token`.
- **Auto-linking**: Searches existing clients by `tiendanubeStoreId`. If not found, stores token in `tiendanube_auth_tokens` for manual linking.
- **Service**: `src/lib/tiendanube-service.ts` — REST API `https://api.tiendanube.com/v1/{storeId}`, page-based pagination.
- **Client Fields**: `tiendanubeStoreId`, `tiendanubeAccessToken`, `integraciones.ecommerce: 'tiendanube'`.
- **Metrics**: orders, revenue, avgOrderValue, refunds, grossRevenue, totalDiscounts, totalShipping, fulfilledOrders, cancelledOrders, itemsPerOrder.
- **Raw Data**: Breakdown by storefront (store, meli, api, form, pos), top products, unique customers.
- **UI Storefront Section**: "Performance por Canal de Venta" — horizontal bars with revenue, orders, AOV per storefront. Labels: store→"Tienda Online", meli→"Mercado Libre", api→"API", form→"Formulario", pos→"Punto de Venta". Replaces generic attribution for Tienda Nube.

**WooCommerce** — API Key Auth (no OAuth):
- **Auth**: Consumer Key + Consumer Secret via query params (Basic Auth). Generated in WooCommerce → Settings → Advanced → REST API.
- **Service**: `src/lib/woocommerce-service.ts` — REST API v3 `https://{storeDomain}/wp-json/wc/v3`, page-based pagination (`X-WP-TotalPages` header).
- **Client Fields**: `woocommerceStoreDomain`, `woocommerceConsumerKey`, `woocommerceConsumerSecret`, `integraciones.ecommerce: 'woocommerce'`.
- **Metrics**: Financial (grossRevenue, netRevenue, totalDiscounts, discountRate, totalTax, totalShipping), Operations (fulfilledOrders, cancelledOrders, fulfillmentRate, itemsPerOrder).
- **Attribution**: UTM extraction from `meta_data` (supports `_wc_order_attribution_utm_source` from WC 8.5+ native attribution + `_utm_source` from tracking plugins) → classifies into meta_ads, google_ads, email, direct, etc.
- **Raw Data**: Top products, discount codes (from `coupon_lines`), payment method breakdown, unique customers.
- **Requires**: HTTPS on the store (WooCommerce REST API requirement for query param auth).

**Cron**: `/api/cron/sync-ecommerce` — Daily. Iterates all active clients, dispatches to ShopifyService, TiendaNubeService, or WooCommerceService based on `integraciones.ecommerce`.
**UI**: `src/components/pages/EcommerceChannel.tsx` — Auto-detects platform from `rawData.source` ('shopify' | 'tiendanube' | 'woocommerce'). Period filters (MTD / last month / 2 months ago). 4 KPI rows, attribution bars, top products table, discount codes. Shopify cohort cards display LTV. Tienda Nube shows storefront performance section.

### Email Marketing Integration (Klaviyo + Perfit)
Multi-platform email marketing data sync. Both platforms write to `channel_snapshots` with `channel: 'EMAIL'`.

**Klaviyo** — API Key Auth:
- **Auth**: Direct API key (`Klaviyo-API-Key {pk_...}`), no OAuth. Manual entry in ClientForm.
- **Service**: `src/lib/klaviyo-service.ts` — Reporting API v2025-04-15. Base URL: `https://a.klaviyo.com/api`.
- **Client Fields**: `klaviyoApiKey` (pk_...), `klaviyoPublicKey` (6 chars), `integraciones.email: 'klaviyo'`.
- **Data Sources**: Campaigns (`/campaigns` + `/campaign-values-reports/`) and Flows (`/flows` + `/flow-values-reports/`).
- **Conversion Tracking**: Auto-discovers "Placed Order" metric ID via `/metrics` endpoint.
- **Rate Limits**: Reporting API: 2/min steady, 1/s burst, 225/day. Service enforces 31s pause between reporting calls.
- **Metrics**: sent, delivered, opens, openRate, emailClicks, clickRate, bounces, unsubscribes, emailRevenue, conversions.

**Perfit** — API Key Auth:
- **Auth**: Bearer token (`{accountId}-{secret}`), no OAuth. Account ID extracted from key prefix.
- **Service**: `src/lib/perfit-service.ts` — REST API v2. Base URL: `https://api.myperfit.com/v2`.
- **Client Fields**: `perfitApiKey`, `integraciones.email: 'perfit'`.
- **Data Sources**: Campaigns (`/{accountId}/campaigns`, filtered by `state=SENT`) and Automations (`/{accountId}/automations`, lifetime aggregates).
- **Metrics**: sent, delivered, opens, openRate, emailClicks, clickRate, bounces, emailRevenue, conversions.
- **Raw Data**: Per-campaign breakdown, automation summaries, account info (plan, contacts, cost).

**Cron**: `/api/cron/sync-email` — Daily, last 30 days. Dispatches to KlaviyoService or PerfitService based on `integraciones.email`.
**UI**: `src/components/pages/EmailChannel.tsx` — Auto-detects platform from `rawData.source`. Period filters. KPI cards, campaign table, automation cards. Klaviyo flows show 5-column grid (enviados, open rate, click rate, ventas, revenue). Perfit campaigns show thumbnail images and tag badges.
**Backfill Scripts**: `scripts/sync-klaviyo-backfill.ts`, `scripts/sync-perfit-backfill.ts` — Sync 3-month history.

### Google Ads Integration
Channel data sync from Google Ads API via `google-ads-api` npm package. Writes to `channel_snapshots` with `channel: 'GOOGLE'`.

- **Service**: `src/lib/google-ads-service.ts` — GAQL queries via MCC (login_customer_id). Supports Search, Shopping, Display, Video, PMax campaigns.
- **Client Fields**: `googleAdsCustomerId`, `integraciones.google_ads: true`.
- **Metrics**: spend, impressions, clicks, ctr, cpc, conversions, conversionsValue, costPerConversion, roas, videoViews, videoPlays, videoP25, videoP50, videoP75, videoP100.
- **Video Metrics Aggregation**: Weighted average of video quartile rates (P25/P50/P75/P100) by videoViews per campaign in `aggregateByDay()`.
- **Search Terms**: `fetchSearchTerms()` queries `search_term_view` (GAQL) — top 50 by spend. Try/catch for campaigns that don't support it (Display/Video/PMax). Stored in `rawData.searchTerms`.
- **Raw Data**: Per-campaign breakdown, search terms, video metrics.
- **Cron**: `/api/cron/sync-google` — Daily, fetches yesterday's metrics.
- **UI**: `src/components/pages/GoogleAdsChannel.tsx` — Campaign table, KPI cards. Video Completion Funnel (stepped bars with P25→P50→P75→P100 drop-off). Top Search Terms table (term, impressions, clicks, CTR, conversions, spend, CPA).

### Account Health Monitoring
- **Service**: `src/lib/account-health-service.ts` — Monitors Meta account status via API.
- **Checks**: `account_status` (active/disabled/unsettled), `spend_cap` proximity, `amount_spent` tracking.
- **State Transitions**: Detects when account status changes and logs events.
- **Cron**: `/api/cron/account-health` runs every 2 hours.
- **UI**: Visible in `/admin/system` under Account Health tab.

### Business Profile (Client Extension)
Extended `ClientConfig` with business-aware fields:
- `growthMode`: `conservative` | `balanced` | `aggressive` — affects alert sensitivity.
- `fatigueTolerance`: `low` | `medium` | `high` — adjusts frequency thresholds.
- `scalingSpeed`: `slow` | `moderate` | `fast` — controls budget change alerts.
- `acceptableVolatilityPct`: Numeric tolerance for metric fluctuations.
- `funnelPriority`: `tofu` | `mofu` | `bofu` — prioritizes analysis by funnel stage.
- `ltv`: Lifetime value for ROAS calculations.
- Editable via Client Form in `/admin/clients`.

### Observability & System Events
- **EventService**: `src/lib/event-service.ts` — Centralized event logging to `system_events` collection.
- **Event Types**: `cron.start`, `cron.success`, `cron.error`, `alert.sent`, `account.status_change`, `sync.complete`, etc.
- **Cron History**: Every cron execution logged to `cron_executions` with duration, status, metadata.
- **Health Check**: `/api/health` endpoint returns system status + Firestore connectivity.
- **Error Reporter**: `src/lib/error-reporter.ts` — Structured error capture with context.
- **Admin UI**: `/admin/system` with 3 tabs: System Events, Cron History, Account Health.

### AI Analyst — Conversational Chat Panel
Multi-turn conversational AI panel that analyzes channel data in real-time using Claude. Replaces one-shot Gemini reports with interactive, context-aware conversations.

**Architecture:**
- **AI Provider**: Anthropic Claude (Sonnet 4.5) via `@anthropic-ai/sdk`.
- **Context Format**: Structured XML (`<business_data>` tags). Claude interprets XML tags better than JSON (~30% improved comprehension).
- **Prompt Caching**: System prompt (channel prompt + data XML) cached for 5 minutes via `cache_control: { type: 'ephemeral' }`. ~90% cost reduction on follow-up messages within same conversation.
- **Streaming**: Server-Sent Events (SSE) via `ReadableStream`. Real-time token-by-token display.
- **Rate Limiting**: 30 requests/hour per user, tracked in `ai_analyst_rate_limits/{uid}`.

**Key Files:**

| File | Purpose |
|------|---------|
| `src/lib/ai-analyst/types.ts` | ChannelId, AnalystContext interfaces, CHANNEL_TO_FIRESTORE mapping, SUGGESTED_QUESTIONS |
| `src/lib/ai-analyst/context-builder.ts` | Builds AnalystContext from Firestore data (client config, channel_snapshots, entity data, creative DNA) |
| `src/lib/ai-analyst/xml-formatter.ts` | Converts AnalystContext → semantic XML for Claude's system prompt |
| `src/lib/ai-analyst/prompts.ts` | Channel-specific system prompts with 5-min memory cache. Reads from `brain_prompts/{channelId}` in Firestore, falls back to built-in defaults |
| `src/app/api/ai-analyst/chat/route.ts` | POST API route — auth, rate limit, context build, Anthropic SSE streaming |
| `src/hooks/useAnalystChat.ts` | Client-side hook — manages messages, SSE reader, abort on panel close |
| `src/contexts/AnalystContext.tsx` | React context — `openAnalyst(channelId, initialPrompt?)`, `closeAnalyst()` |
| `src/components/ai-analyst/AnalystPanel.tsx` | 420px fixed right panel with header, messages, input |
| `src/components/ai-analyst/MessageList.tsx` | Chat bubbles with markdown rendering + streaming indicator |
| `src/components/ai-analyst/AnalystInput.tsx` | Auto-resize textarea, Enter=send, Shift+Enter=newline |
| `src/components/ai-analyst/SuggestedQuestions.tsx` | 3 clickable question chips per channel (visible when no messages) |

**Channels Supported:** `meta_ads`, `google_ads`, `ecommerce`, `email`, `cross_channel`.

**Context Builder Data Sources per Channel:**

| Channel | Summary From | Details From |
|---------|-------------|-------------|
| `meta_ads` | `channel_snapshots` (META) | `daily_entity_snapshots` (campaigns) + `entity_rolling_metrics` (top ads) + `creative_dna` |
| `google_ads` | `channel_snapshots` (GOOGLE) | `rawData.campaigns` from snapshots |
| `ecommerce` | `channel_snapshots` (ECOMMERCE) | `rawData.topProducts` + `rawData.attributionBreakdown` |
| `email` | `channel_snapshots` (EMAIL) | `rawData.campaigns` + `rawData.automations/flows` |
| `cross_channel` | All 4 channels combined | Attribution gap (Meta reported vs ecommerce real), spend distribution |

**Token Budget:** ~30k max context. Limits: 15 campaigns, 10 creatives, 10 products, 10 email campaigns, 10 automations. Nulls omitted, floats rounded to 2 decimals.

**Prompts — Prompt Stacking Architecture:**

The AI Analyst uses a "prompt stacking" approach where deep domain expertise is baked into each channel's system prompt. This eliminates the need for tool use in most diagnostic scenarios.

| Layer | Source | Content |
|-------|--------|---------|
| 1. Base Role | `prompts.ts` defaults / `brain_prompts/{channelId}` | Analyst persona, diagnostic rules, benchmarks |
| 2. Domain Expertise | `prompts.ts` defaults | Industry benchmarks, optimization playbooks, platform gotchas |
| 3. Business Context | `context-builder.ts` → XML | Client config, targets, growth mode, funnel priority |
| 4. Live Data | `context-builder.ts` → XML | Metrics, campaigns, creatives, products, attribution |

Each channel prompt includes:
- **Benchmarks table**: Concrete numbers for good/bad/excellent per metric
- **Diagnostic frameworks**: Decision trees (e.g., "if X metric bad + Y metric good → problem is Z")
- **Optimization playbooks**: Actionable recommendations per scenario
- **Platform-specific knowledge**: Gotchas for Shopify/TN/WC (ecommerce), Klaviyo/Perfit (email), Search/PMax/Display (Google)

Prompts stored in `brain_prompts/{channelId}` Firestore collection override the built-in defaults. Editable via Firestore without code deploys.

**Future: Tool Use (Option B):** Plan documented in `docs/plan_ai_analyst_tool_use.md`. Would add Anthropic tool_use for real-time drill-down queries beyond the static context. Low priority — prompt stacking covers ~90% of use cases.

**Integration:** "Analizar con IA" button in header of MetaAdsChannel, GoogleAdsChannel, EcommerceChannel, EmailChannel. Opens panel with `openAnalyst('channel_id')`. `AnalystProvider` wraps app in `layout.tsx`.

---

## 4. Design System (Stitch)
- **Tokens**: Centralized in `src/lib/design-tokens.ts`.
- **Colors**: `stellar` (bg), `special` (card), `classic` (blue accent), `synced` (green status).
- **Typography**: Inter (UI), JetBrains Mono (Data).
- **AI Handbook**: In-app academy (`/academy/alerts`) explaining alert logic with visual Slack mockups.

---

## 5. Navigation & Admin Pages

| # | Page | Route | Section |
|---|------|-------|---------|
| 01 | Command Center | `/dashboard` | Operativo |
| 02 | Ads Manager | `/ads-manager` | Operativo |
| 03 | Decision Board | `/decision-board` | Operativo |
| 04 | Creative Intel | `/creative` | Inteligencia |
| 05 | Conceptos | `/concepts` | Inteligencia |
| 06 | AI Handbook | `/academy/alerts` | Inteligencia |
| 07 | Ecommerce | `/ecommerce` | Canales |
| 08 | Email Marketing | `/email` | Canales |
| 09 | Google Ads | `/google-ads` | Canales |
| 10 | Cerebro de Worker | `/admin/cerebro` | Admin |
| 11 | Administracion | `/admin/clients` | Admin |
| 12 | Alertas | `/admin/alerts` | Admin |
| 13 | Cron Manual | `/admin/cron` | Admin |
| 14 | Sistema | `/admin/system` | Admin |

---

## 6. Cron Jobs & Automation

### Daily Channel Sync (09:00 UTC — yesterday's closed data)
| Cron | Route | Purpose |
|------|-------|---------|
| Meta Sync | `/api/cron/sync-meta` | Fetch yesterday's Meta Ads metrics → `channel_snapshots` |
| Google Sync | `/api/cron/sync-google` | Fetch yesterday's Google Ads metrics → `channel_snapshots` |
| Ecommerce Sync | `/api/cron/sync-ecommerce` | Fetch yesterday's orders from Shopify/TiendaNube/WooCommerce → `channel_snapshots` |
| Email Sync | `/api/cron/sync-email` | Fetch yesterday's campaigns from Klaviyo/Perfit → `channel_snapshots` |

### Daily Processing (10:00 UTC — after channel syncs complete)
| Cron | Route | Purpose |
|------|-------|---------|
| Data Sync | `/api/cron/data-sync` | Meta rolling metrics, client snapshots, alerts, Slack digest, backfill batch |
| Creative Sync | `/api/cron/sync-creatives` | Fetch ad metadata & creative assets from Meta |
| Classify Entities | `/api/cron/classify-entities` | GEM classification engine (after data-sync) |
| Creative DNA | `/api/cron/creative-dna` | Gemini Vision creative analysis (after sync-creatives) |
| Daily Digest | `/api/cron/daily-digest` | Slack MTD report + CRITICAL/scaling alerts |

### Periodic
| Cron | Route | Schedule | Purpose |
|------|-------|----------|---------|
| Weekly Alerts | `/api/cron/weekly-alerts` | Monday | Slack WoW summary + WARNING alerts |
| Account Health | `/api/cron/account-health` | Every 2h | Meta account status & spend cap checks |

### Channel Backfill on New Client / Channel Enable
- **Service**: `src/lib/channel-backfill-service.ts` — Backfills `channel_snapshots` from current quarter start to yesterday.
- **Triggers**: Automatically fires (non-blocking) on:
  - `POST /api/clients` — New client creation → backfills all configured channels.
  - `PATCH /api/clients/:id` — Detects newly enabled channels → backfills only those.
- **Quarter Logic**: Q1=Jan 1, Q2=Apr 1, Q3=Jul 1, Q4=Oct 1.

### Notes
- **Manual Trigger**: `GET` with `Authorization: Bearer <CRON_SECRET>` (data-sync, daily-digest, weekly-alerts, account-health, creative-dna) or `POST` with `x-cron-secret` header (sync-creatives, classify-entities).
- **Cleaning Cache**: Delete documents from `entity_rolling_metrics` or `daily_entity_snapshots` to force data refresh.
- **Full Simulation**: `scripts/simulate-monday-cron.ts` runs: data-sync → classify-entities → daily-digest → weekly-alerts.
- **Partial Simulation**: `scripts/simulate-monday-remaining.ts` skips data-sync (uses existing data).

---

## 7. Testing

### Alert Engine Unit Tests
- **Script**: `scripts/test-alert-engine.ts`
- **Run**: `npx tsx --require ./scripts/load-env.cjs scripts/test-alert-engine.ts`
- **Requires**: `.env.local` with Firebase credentials (Firebase initializes but `evaluate()` is pure computation — no DB calls).
- **Coverage**: 20 tests covering all 16 alert types + routing validation + negative tests (video alerts don't fire on images) + deduplication (ad > adset priority) + severity verification.
- **Helper**: `scripts/load-env.cjs` — Pre-loads `.env.local` before ES module imports.

### TypeScript Verification
- **Command**: `npx tsc --noEmit`
- **Known Pre-existing Errors** (8): cerebro page SetStateAction types (2), findings page DateRangeOption + severity index (2), report page DateRangeOption (1), creative-classifier days_active (1), recommendation-service duplicate properties (2).

---

## 8. Key Architecture Decisions

### AlertEngine.evaluate() — Pure Computation Pattern
The `evaluate()` method on `AlertEngine` takes all data as parameters (`AlertEvaluationInput`) and returns `Alert[]` with zero DB access. This allows:
- `AlertEngine.run()` to fetch data from Firestore then delegate to `evaluate()`.
- `ClientSnapshotService.computeAndStore()` to call `evaluate()` inline with already-fetched data.
- Unit tests to call `evaluate()` directly with mock data (no Firebase needed at runtime).

### Notification Policy
- **Daily (slack_immediate)**: Only CRITICAL alerts and SCALING_OPPORTUNITY — high urgency or clearly positive signals.
- **Weekly (slack_weekly)**: WARNING alerts — improvement opportunities, format suggestions, early fatigue signals.
- **Panel only (panel_only)**: INFO alerts — available in dashboard for detailed consultation.

### Objective-Aware Architecture
All engines (alerts, classification, performance, reporting) resolve the campaign objective through `objective-utils.ts` instead of hardcoding metric checks. This means:
- WhatsApp campaigns measure by conversations, not purchases.
- Lead gen campaigns measure by leads, not ROAS.
- Traffic campaigns don't generate false CPA alerts.
- Each objective has appropriate frequency thresholds (awareness tolerates higher frequency than sales).

---

## 9. Historical Milestones (Condensed)
- **AG-41/42/44**: Creative Library, KPI Scoring, and Intelligence UI.
- **EngineConfig Migration**: Refactored static thresholds into a per-client configurable system.
- **Slack V1**: Individual alert routing and month-to-date daily reporting.
- **Observability (Phase 1)**: EventService, cron logging, health check, admin system page.
- **Account Health (Phase 2)**: Meta API status monitoring, spend cap alerts.
- **Business Profile (Phase 3)**: growthMode, fatigueTolerance, scalingSpeed, LTV, funnel priority.
- **Creative Intelligence (Phase 4)**: 6-category classifier, pattern detection service.
- **Cerebro de Worker**: Centralized AI logic hub — extracted hardcoded critical instructions into editable DB fields.
- **Engine Evolution (5 Phases)**:
  - Phase 1: Objective-Aware Pipeline — `objective-utils.ts` as single source of truth for objective → metric mapping.
  - Phase 2: Video Metrics — hook_rate, hold_rate, completion_rate, drop_off_point, frequency_velocity computed in rolling metrics. 4 video alerts (HOOK_KILL, BODY_WEAK, CTA_WEAK, VIDEO_DROPOFF).
  - Phase 3: Creative DNA — Gemini Vision analysis of ad creatives. `creative-dna-service.ts`, diversity scoring, `/api/cron/creative-dna`.
  - Phase 4: Format Diagnostics — IMAGE_INVISIBLE, IMAGE_NO_CONVERT alerts. CREATIVE_MIX_IMBALANCE aggregate alert. Classifier enriched with DNA insights.
  - Phase 5: Consolidation — `AlertEngine.evaluate()` extracted as pure function. ~340 lines of duplicate alert logic removed from `ClientSnapshotService`. `AlertChannel` routing. Weekly digest cron. All thresholds in EngineConfig.
- **Multi-Channel Expansion**: Shopify OAuth Partners App + Tienda Nube marketplace OAuth + WooCommerce REST API + Klaviyo API + Perfit API. Unified `channel_snapshots` collection. Expanded ecommerce metrics (financial, customer segmentation, abandoned carts, UTM attribution, top products, discount codes). Multi-platform dashboards with period filters (`EcommerceChannel.tsx`, `EmailChannel.tsx`).
- **Channel KPI Enhancements**: 6 improvements leveraging unused API fields — Google Ads search terms (GAQL `search_term_view`) + video completion funnel (P25/P50/P75/P100), Shopify customer LTV (`total_spent` per cohort), Tienda Nube storefront performance breakdown, Klaviyo expanded flow stats (open rate, click rate), Perfit campaign thumbnails & tags in UI.
