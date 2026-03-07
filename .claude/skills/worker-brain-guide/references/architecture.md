# Architecture & File Map

## Directory Structure

```
src/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes (all server-side)
│   │   ├── ai-analyst/chat/      # Claude SSE streaming endpoint
│   │   ├── admin/                # Admin APIs (brain-prompts, backfill, system-events, etc.)
│   │   ├── auth/session/         # Session cookie management
│   │   ├── channel-snapshots/    # Read channel_snapshots for UI
│   │   ├── clients/              # CRUD for clients + engine-config sub-route
│   │   ├── cron/                 # All cron jobs (sync-meta, sync-google, etc.)
│   │   ├── creative/             # Creative library, analysis, variations
│   │   ├── integrations/         # OAuth flows (shopify/auth, shopify/callback, ga4/list-properties)
│   │   ├── leads/                # Lead CRUD + funnel-calculator
│   │   ├── public/[token]/       # Public dashboard access (no auth)
│   │   ├── tiendanube/auth/      # TiendaNube OAuth (separate from integrations/)
│   │   ├── webhooks/ghl/         # GoHighLevel webhook receiver
│   │   └── ...                   # analyze, dashboard, findings, performance, report, etc.
│   ├── (auth)/                   # Auth-required pages group
│   │   ├── dashboard/            # Command Center
│   │   ├── ads-manager/          # Ads Manager
│   │   ├── decision-board/       # Decision Board
│   │   ├── creative/             # Creative Intel
│   │   ├── concepts/             # Concept Briefs
│   │   ├── ecommerce/            # Ecommerce channel page
│   │   ├── email/                # Email Marketing channel page
│   │   ├── google-ads/           # Google Ads channel page
│   │   ├── ga4/                  # GA4 channel page
│   │   ├── leads/                # Leads/CRM channel page
│   │   ├── academy/alerts/       # AI Handbook
│   │   └── admin/                # Admin section (cerebro, clients, alerts, cron, system, etc.)
│   └── layout.tsx                # Root layout (AnalystProvider wraps app here)
│
├── components/
│   ├── ai-analyst/               # Chat panel components (AnalystPanel, MessageList, Input, SuggestedQuestions)
│   ├── pages/                    # Full page components per channel
│   │   ├── MetaAdsChannel.tsx
│   │   ├── GoogleAdsChannel.tsx
│   │   ├── GA4Channel.tsx
│   │   ├── EcommerceChannel.tsx
│   │   ├── EmailChannel.tsx
│   │   ├── LeadsChannel.tsx
│   │   └── ...
│   └── ui/                       # Shared UI components
│
├── contexts/
│   ├── AnalystContext.tsx         # openAnalyst(channelId), closeAnalyst() — wraps app
│   ├── ClientContext.tsx          # Selected client, caches performance snapshots
│   └── ...
│
├── hooks/
│   ├── useAuth.ts                # Firebase Auth hook
│   ├── useAnalystChat.ts         # SSE reader, message management, abort on close
│   └── ...
│
├── lib/
│   ├── firebase-admin.ts         # Server-side Firebase init (singleton, ignoreUndefinedProperties)
│   ├── firebase.ts               # Client-side Firebase init
│   ├── ai-analyst/               # AI Analyst module (types, context-builder, xml-formatter, prompts)
│   ├── alert-engine.ts           # AlertEngine.evaluate() — pure computation, no DB
│   ├── brain-prompt-service.ts   # BrainPromptService — Firestore brain_prompts with 5-min cache
│   ├── channel-backfill-service.ts  # Auto-backfill on client create/update
│   ├── channel-brain-interface.ts   # ChannelType, ChannelBrain abstract class
│   ├── client-snapshot-service.ts   # Pre-compute client snapshots + inline alerts
│   ├── creative-classifier.ts    # 6-category creative classification
│   ├── creative-dna-service.ts   # Gemini Vision creative analysis
│   ├── creative-pattern-service.ts  # Winning pattern detection
│   ├── design-tokens.ts          # Stitch design system tokens
│   ├── event-service.ts          # Observability logging to system_events
│   ├── ga4-service.ts            # GA4 Data API integration
│   ├── google-ads-service.ts     # Google Ads GAQL queries
│   ├── klaviyo-service.ts        # Klaviyo API (strict rate limits)
│   ├── leads-service.ts          # Leads aggregation from leads collection
│   ├── objective-utils.ts        # Single source of truth for objective → metric mapping
│   ├── perfit-service.ts         # Perfit email marketing API
│   ├── performance-service.ts    # Rolling metrics computation
│   ├── prompt-utils.ts           # buildSystemPrompt(), getDefaultCriticalInstructions()
│   ├── shopify-service.ts        # Shopify REST Admin API
│   ├── slack-service.ts          # Daily/weekly digest, critical alerts
│   ├── tiendanube-service.ts     # Tienda Nube REST API
│   └── woocommerce-service.ts    # WooCommerce REST API
│
├── types/
│   ├── index.ts                  # Core types (Client, Alert, etc.) — re-exports all
│   ├── channel-snapshots.ts      # ChannelDailySnapshot, UnifiedChannelMetrics, buildChannelSnapshotId
│   ├── engine-config.ts          # EngineConfig with all threshold sections
│   ├── creative-dna.ts           # Creative DNA types
│   ├── leads.ts                  # Lead, GHLWebhookPayload, LeadsConfig, funnel types
│   └── ...
│
├── middleware.ts                  # Route protection via session cookie verification
└── ...
```

## API Routes — Complete List

### Cron (15 routes)
- `sync-meta`, `sync-google`, `sync-ga4`, `sync-ecommerce`, `sync-email`, `sync-leads`
- `data-sync`, `sync-creatives`, `classify-entities`, `creative-dna`, `daily-digest`
- `weekly-alerts`, `account-health`, `semaforo`, `fill-gaps`

### Admin (13 routes)
- `brain-prompts` (GET/POST/DELETE), `brain-prompts/defaults` (GET)
- `system-events`, `cron-history`, `account-health`, `prompts`
- `backfill`, `trigger-cron`, `public-tokens`, `rename-clients`
- `seed-brain-prompts`, `system-settings`, `winning-ads`

### Client & Data
- `clients` (GET/POST), `clients/[id]` (GET/PATCH/DELETE), `clients/[id]/engine-config`
- `clients/by-slug/[slug]`, `clients/import`
- `channel-snapshots` (GET), `dashboard`, `analyze`, `performance`, `findings`
- `report`, `recommendations/generate`, `recommendations/detail`
- `semaforo`, `objectives`, `objectives/[id]`, `objectives/suggest`
- `teams` (GET/POST), `teams/[id]` (PATCH/DELETE)

### Creative
- `creative/library`, `creative/active`, `creative/detail`, `creative/analyze`, `creative/variations`
- `concepts` (GET/POST), `concepts/[conceptId]` (PATCH/DELETE)

### Integrations
- `integrations/shopify/auth`, `integrations/shopify/callback`
- `integrations/ga4/list-properties`
- `tiendanube/auth`, `tiendanube/auth/success`

### AI & Export
- `ai-analyst/chat` (POST — SSE streaming)
- `export/markdown`, `slack-export/generate`, `slack-export/send`
- `meta/media-mix`

### Leads
- `leads` (GET/POST), `leads/[id]` (PATCH/DELETE)
- `leads/funnel-calculator`
- `webhooks/ghl` (POST — GHL webhook receiver)

### Public
- `public/[token]`, `public/[token]/channel-snapshots`

### Auth & Health
- `auth/session` (POST/DELETE)
- `health`

## Navigation Pages

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
| 10 | GA4 | `/ga4` | Canales |
| 11 | Leads | `/leads` | Canales |
| 12 | Cerebro de Worker | `/admin/cerebro` | Admin |
| 13 | Administracion | `/admin/clients` | Admin |
| 14 | Alertas | `/admin/alerts` | Admin |
| 15 | Cron Manual | `/admin/cron` | Admin |
| 16 | Sistema | `/admin/system` | Admin |
| 17 | Objetivos | `/admin/objectives` | Admin |
| 18 | Equipos | `/admin/teams` | Admin |
