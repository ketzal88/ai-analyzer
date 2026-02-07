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

### ✨ AI Insights (Audits & Variations)
- **Audits**: Standardized JSON reports with `diagnosis`, `risks`, `actions`, and `score`.
- **Variations**: Generates copy/concept variations based on performance goals.
- **Robustness**: Integrated mappers handle inconsistent AI outputs and force JSON structure.

---

## 🎨 4. Design System (Stitch)
- **Tokens**: Centralized in `src/lib/design-tokens.ts`.
- **Colors**: `stellar` (bg), `special` (card), `classic` (blue accent), `synced` (green status).
- **Typography**: Inter (UI), JetBrains Mono (Data).

---

## 📜 5. Historical Milestones (Condensed)
The project evolved through a series of "Misiones":
- **Misión 4-10**: Core UI implementation, account selector, and Firebase integration.
- **Misión 11-13**: Initial AI report experiments and error handling.
- **AG-41**: Implementation of the Meta Creative Library Sync.
- **AG-42**: Development of the KPI Snapshot & Intelligent Scoring engine.
- **AG-44**: Launch of the Creative Intelligence UI (Grid/Filter/Clustering labels).
- **Feb 2026 Refinement**: Standardized AI output schemas and robust JSON parsing to handle inconsistent Gemini responses.

---

## 📖 6. Usage & Maintenance
- **Manual Sync**: `POST /api/cron/sync-creatives?clientId=...` (Requires `CRON_SECRET`).
- **Cleaning Cache**: Delete documents from `creative_ai_reports` or `creative_kpi_snapshots` to force regeneration.
- **Testing**: Use `npm run build` to verify types and structure before deployment.
