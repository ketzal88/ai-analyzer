# Master Reference: Meta Ads Diagnostic Tool

This document is the **Single Source of Truth** for the Meta Ads Diagnostic Tool. It consolidates all previous mission reports and technical documentation.

---

## 1. Project Overview & Tech Stack

A high-performance Next.js application designed to analyze Meta Ads creatives using intelligent scoring and AI-driven insights (Gemini/GEM paradigms).

### Technical Foundation
- **Framework**: Next.js 14 (App Router), TypeScript
- **Styling**: Tailwind CSS (Stitch Design System implementation)
- **Database/Auth**: Firebase (Firestore, Auth, Admin SDK)
- **AI Engine**: Google Generative AI (Gemini 2.0 Flash)
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
# Slack
SLACK_BOT_TOKEN=...
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
Centralized hub for ALL AI logic. 4 tabs:

1. **Generadores IA**: 5 prompt types (Report, Creative Audit, Creative Variations, Recommendations, Concept Briefs). Each has editable System Prompt, Critical Instructions (previously hardcoded, now DB-overridable), User Template, and Output Schema.
2. **Motor de Decisiones**: Per-client EngineConfig editor.
3. **Clasificador Creativo**: Read-only view of 6 creative categories (see Creative Intelligence above).
4. **Consola de Pruebas**: Unified test console for any prompt type + client.

- **Utility**: `src/lib/prompt-utils.ts` — `buildSystemPrompt()`, `getDefaultCriticalInstructions()`, `getDefaultOutputSchema()`, `PROMPT_KEYS`.
- **Pattern**: `systemPrompt = baseSystem + (dbCriticalInstructions || defaultForKey)`. Backward-compatible: if no `criticalInstructions` in DB, uses the original hardcoded defaults.
- **Prompt Keys**: `report`, `creative-audit`, `creative-variations`, `recommendations_v1`, `concept_briefs_v1`.

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
| 07 | Cerebro de Worker | `/admin/cerebro` | Admin |
| 08 | Administracion | `/admin/clients` | Admin |
| 09 | Alertas | `/admin/alerts` | Admin |
| 10 | Cron Manual | `/admin/cron` | Admin |
| 11 | Sistema | `/admin/system` | Admin |

---

## 6. Cron Jobs & Automation

| Cron | Route | Schedule | Purpose |
|------|-------|----------|---------|
| Creative Sync | `/api/cron/sync-creatives` | Daily | Fetch ads from Meta API |
| Data Sync | `/api/cron/data-sync` | Daily | Aggregate rolling metrics, snapshots & alerts |
| Classify Entities | `/api/cron/classify-entities` | Daily (after data-sync) | GEM classification engine |
| Creative DNA | `/api/cron/creative-dna` | Daily (after sync-creatives) | Gemini Vision creative analysis |
| Daily Digest | `/api/cron/daily-digest` | Daily 9 AM | Slack MTD report + CRITICAL/scaling alerts |
| Weekly Alerts | `/api/cron/weekly-alerts` | Weekly (Monday) | Slack WoW summary + WARNING alerts |
| Account Health | `/api/cron/account-health` | Every 2h | Meta account status & spend cap checks |

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
