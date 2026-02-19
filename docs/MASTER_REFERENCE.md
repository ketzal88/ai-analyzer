# 🧠 Master Reference: Meta Ads Diagnostic Tool

This document is the **Single Source of Truth** for the Meta Ads Diagnostic Tool. It consolidates all previous mission reports and technical documentation.

---

## 🚀 1. Project Overview & Tech Stack

A high-performance Next.js application designed to analyze Meta Ads creatives using intelligent scoring and AI-driven insights (Gemini/GEM paradigms).

### Technical Foundation
- **Framework**: Next.js 14 (App Router), TypeScript
- **Styling**: Tailwind CSS (Stitch Design System implementation)
- **Database/Auth**: Firebase (Firestore, Auth, Admin SDK)
- **AI Engine**: Google Generative AI (Gemini 2.0 Flash)
- **Deployment**: Vercel

---

## 🛠️ 2. Infrastructure & Setup

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
```

### Firestore Infrastructure
- **Initialization**: Configured with `ignoreUndefinedProperties: true` for stability.
- **Indexes**: Managed via `firestore.indexes.json`. Critical for range-based KPI queries and creative filtering.
- **Deploying Indexes**: `firebase deploy --only firestore:indexes`.

---

## 🏗️ 3. Core Modules

### 🔐 Authentication & Sessions
- **System**: Firebase Auth with Google Provider.
- **Security**: Uses HttpOnly cookies ("session") managed via `middleware.ts` for route protection (`/creative`, `/select-account`).
- **Hook**: `useAuth()` provides `user`, `loading`, `signInWithGoogle()`, and `signOut()`.

### 📚 Creative Library (AG-41)
- **Sync**: Daily cron job (`/api/cron/sync-creatives`) fetches ads from Meta.
- **Normalization**: Automatic detection of formats (IMAGE, VIDEO, CAROUSEL, CATALOG).
- **Deduplication**: Fingerprint-based (SHA256) to avoid redundant storage and processing.
- **Storage**: `meta_creatives` collection using ID format `${clientId}__${adId}`.

### 🎯 KPI Engine & Scoring (AG-42)
- **Snapshots**: Cached 6-hour performance views in `creative_kpi_snapshots`.
- **Intelligent Scoring**: Weighted formula (Spend, Impressions, Fatigue, Opportunity, Newness).
- **Clustering**: Groups similar creatives by fingerprint to reduce AI analysis tokens by ~70-80%.
- **Frontend Caching**: Global `ClientContext` provides instantaneous navigation between pages by caching performance snapshots in memory.
- **Historical Analysis**: The backend now stores versioned snapshots (`clientId_YYYY-MM-DD`). These documents capture a fixed "photo" of the performance, including 7, 14, and 30-day comparisons, allowing historical reviews without re-calculation.

### 🧠 Engine Configuration & Tuning (Feb 2026)
- **Service**: `EngineConfigService` manages per-client analysis thresholds.
- **Configurability**: Fatigue thresholds (Frequency, CPA Multiplier), Structure rules, Scaling speed, and Intent scoring parameters.
- **Persistence**: Stored in `engine_configs` collection, linked by `clientId`.
- **UI**: Integrated in Client Management for real-time algorithm tuning.

### 🔔 Alert Engine & Slack Service
- **AlertEngine**: Evaluates 10+ signals (Scaling, Bleeding, Fatigue, etc.) every hour.
- **SlackService**: Routes notifications to specific public/internal channels per client.
- **Templates**: Fully customizable title and message bodies per alert type, supporting dynamic variables like `{entityName}` and `{targetCpa}`.
- **Daily Digest**: A formatted "Month-to-Date" (Acumulado Mes) report sent every morning via Slack.

---

## 🎨 4. Design System (Stitch)
- **Tokens**: Centralized in `src/lib/design-tokens.ts`.
- **Colors**: `stellar` (bg), `special` (card), `classic` (blue accent), `synced` (green status).
- **Typography**: Inter (UI), JetBrains Mono (Data).
- **AI Handbook**: In-app academy (`/academy/alerts`) explaining alert logic with visual Slack mockups.

---

## 📜 5. Historical Milestones (Condensed)
- **AG-41/42/44**: Creative Library, KPI Scoring, and Intelligence UI.
- **EngineConfig Migration**: Refactored static thresholds into a per-client configurable system to support different business models (E-commerce vs Lead Gen).
- **Slack V1**: Added individual alert routing and month-to-date daily reporting.

---

## 📖 6. Usage & Maintenance
- **Cron Jobs**:
  - Creative Sync: `/api/cron/sync-creatives`
  - Data Sync (Aggregations): `/api/cron/data-sync`
  - Daily Digest (Alerts + Snapshots): `/api/cron/daily-digest` (Runs daily @ 9 AM)
- **Manual Sync**: Trigger via `POST` with `clientId` and `Authorization: Bearer <CRON_SECRET>`.
- **Cleaning Cache**: Delete documents from `entity_rolling_metrics` or `daily_entity_snapshots` to force data refresh. For frontend cache, simply refresh the browser.
- **Testing**: Use `npm run build` or `scripts/simulate-monday-remaining.ts` for local dry-runs.
