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
| `engine_configs` | Per-client decision thresholds |
| `system_events` | Observability event log |
| `cron_executions` | Cron job execution history |
| `entity_rolling_metrics` | Rolling aggregation metrics |
| `daily_entity_snapshots` | Daily snapshot data |

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

### Engine Configuration & Tuning
- **Service**: `EngineConfigService` manages per-client analysis thresholds.
- **Configurability**: Fatigue thresholds (Frequency, CPA Multiplier), Structure rules, Scaling speed, and Intent scoring parameters.
- **Persistence**: Stored in `engine_configs` collection, linked by `clientId`.
- **UI**: Integrated in "Cerebro de Worker" (`/admin/cerebro`) Tab 2.

### Alert Engine & Slack Service
- **AlertEngine**: Evaluates 10+ signals (Scaling, Bleeding, Fatigue, etc.) every hour.
- **SlackService**: Routes notifications to specific public/internal channels per client.
- **Templates**: Fully customizable title and message bodies per alert type, supporting dynamic variables like `{entityName}` and `{targetCpa}`.
- **Daily Digest**: A formatted "Month-to-Date" (Acumulado Mes) report sent every morning via Slack.

### Cerebro de Worker (AI Brain) — `/admin/cerebro`
Centralized hub for ALL AI logic. 4 tabs:

1. **Generadores IA**: 5 prompt types (Report, Creative Audit, Creative Variations, Recommendations, Concept Briefs). Each has editable System Prompt, Critical Instructions (previously hardcoded, now DB-overridable), User Template, and Output Schema.
2. **Motor de Decisiones**: Per-client EngineConfig editor.
3. **Clasificador Creativo**: Read-only view of 6 creative categories.
4. **Consola de Pruebas**: Unified test console for any prompt type + client.

- **Utility**: `src/lib/prompt-utils.ts` — `buildSystemPrompt()`, `getDefaultCriticalInstructions()`, `getDefaultOutputSchema()`, `PROMPT_KEYS`.
- **Pattern**: `systemPrompt = baseSystem + (dbCriticalInstructions || defaultForKey)`. Backward-compatible.
- **Prompt Keys**: `report`, `creative-audit`, `creative-variations`, `recommendations_v1`, `concept_briefs_v1`.

### Creative Intelligence (Classifier & Patterns)
- **Service**: `src/lib/creative-classifier.ts` — Classifies creatives into 6 categories:
  - `DOMINANT_SCALABLE`: High spend + efficient CPA. Scale aggressively.
  - `WINNER_SATURATING`: Was efficient but showing fatigue.
  - `HIDDEN_BOFU`: Low spend but excellent conversion metrics. Increase budget.
  - `INEFFICIENT_TOFU`: High spend + poor efficiency. Cut or restructure.
  - `ZOMBIE`: Minimal spend, minimal results. Pause or refresh.
  - `NEW_INSUFFICIENT_DATA`: Too new to classify (<48h or <2000 impressions).
- **Pattern Detection**: `src/lib/creative-pattern-service.ts` — Detects winning patterns across creatives.

### Account Health Monitoring
- **Service**: `src/lib/account-health-service.ts` — Monitors Meta account status via API.
- **Checks**: `account_status` (active/disabled/unsettled), `spend_cap` proximity, `amount_spent` tracking.
- **State Transitions**: Detects when account status changes and logs events.
- **Cron**: `/api/cron/account-health` runs every 2 hours.
- **UI**: Visible in `/admin/system` under Account Health tab.

### Business Profile (Client Extension)
Extended `ClientConfig` with business-aware fields:
- `growthMode`: `conservative` | `balanced` | `aggressive`
- `fatigueTolerance`: `low` | `medium` | `high`
- `scalingSpeed`: `slow` | `moderate` | `fast`
- `acceptableVolatilityPct`: Numeric tolerance for metric fluctuations
- `funnelPriority`: `tofu` | `mofu` | `bofu`
- `ltv`: Lifetime value for ROAS calculations
- Editable via Client Form in `/admin/clients`.

### Observability & System Events
- **EventService**: `src/lib/event-service.ts` — Centralized event logging to `system_events` collection.
- **Event Types**: `cron.start`, `cron.success`, `cron.error`, `alert.sent`, `account.status_change`, etc.
- **Cron History**: Every cron execution logged to `cron_executions` with duration, status, metadata.
- **Health Check**: `/api/health` endpoint returns system status + Firestore connectivity.
- **Admin UI**: `/admin/system` with 3 tabs: System Events, Cron History, Account Health.

### Backfill & Historical Data
- **Problem**: Syncing 30 days of data for multiple clients (e.g., 29 clients * 500 ads) exceeds Firebase Free Tier write quotas (20k/day) and Vercel execution timeouts.
- **Solution**: The system uses a **Historical Backfill Queue** (`backfill_queue`).
- **Process**: Tasks are enqueued for missing days. The main cron processes a small batch (3-5 tasks) at the end of every run to progressively build the 30-day history without crashing the system.
- **Trigger**: New clients or missing history can be seeded using the backfill utility.

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
| Super Cron (Consolidated) | `/api/cron/data-sync` | Daily | Sync `today` + Compute Snapshots + Classify + **Slack Reports (KPIs & Digest)** + Backfill Batch |
| Creative Sync | `/api/cron/sync-creatives` | Daily | Fetch ad metadata & creative assets from Meta |
| Account Health | `/api/cron/account-health` | Every 6h | Meta account status & spend cap checks |

- **Consolidation**: Since Vercel Free allows only **one cron slot**, the Data Sync route was expanded to handle the full pipeline (Sync → Analysis → Slack Reporting).
- **Manual Trigger**: `/api/admin/trigger-cron` mimics the Super Cron logic for manual on-demand audits.
- **Quota Management**: Daily syncs are restricted to `today`'s data to respect the 20,000 Firebase write limit (unless on Blaze plan).

---

## 7. Historical Milestones (Condensed)
- **AG-41/42/44**: Creative Library, KPI Scoring, and Intelligence UI.
- **EngineConfig Migration**: Refactored static thresholds into a per-client configurable system.
- **Slack V1**: Individual alert routing and month-to-date daily reporting.
- **Observability (Phase 1)**: EventService, cron logging, health check, admin system page.
- **Account Health (Phase 2)**: Meta API status monitoring, spend cap alerts.
- **Business Profile (Phase 3)**: growthMode, fatigueTolerance, scalingSpeed, LTV, funnel priority.
- **Creative Intelligence (Phase 4)**: 6-category classifier, pattern detection service.
- **Cerebro de Worker**: Centralized AI logic hub — extracted hardcoded critical instructions into editable DB fields.
