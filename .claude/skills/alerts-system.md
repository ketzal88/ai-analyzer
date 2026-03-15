---
description: "Complete knowledge of the alerts, notifications, and Slack messaging system. Use when working on alert delivery, Slack digests, cron scheduling, account health, or any notification pipeline."
---

# Alerts & Notifications System — Skill Reference

## Architecture Overview

The system has 3 layers:
1. **Data Collection** — Channel syncs write to `channel_snapshots` (09:00 UTC)
2. **Alert Computation** — AlertEngine evaluates Meta data → produces Alert[] (Meta-only)
3. **Notification Delivery** — SlackService sends messages to per-client Slack channels

## Cron Scheduling

### Vercel (free tier = 1 cron only)
- `data-sync` at 10:00 UTC — Meta rolling metrics, client snapshots, alerts. NO inline Slack delivery (removed).

### GitHub Actions (`.github/workflows/crons.yml`)
| Schedule | Job | Triggers |
|----------|-----|----------|
| `0 9 * * *` | sync-channels | sync-meta, sync-google, sync-ecommerce, sync-email, sync-ga4 |
| `30 9 * * *` | fill-gaps | fill-gaps (detects + fills missing snapshots) |
| `0 */6 * * *` | account-health | account-health check |
| `10 10 * * *` | semaforo | quarterly pacing computation |
| `15 10 * * *` | daily-briefing | multi-channel Slack digest |
| `30 10 * * 1` | weekly-alerts | Monday WoW summary + WARNING alerts |

All jobs support `workflow_dispatch` for manual triggering.

### NOT SCHEDULED (may add later):
- `creative-dna` — AI creative analysis
- `classify-entities` — GEM classification
- `sync-creatives` — Meta creative asset sync

## Master Switch

**File:** `src/lib/system-settings-service.ts`
**Collection:** `system_config` doc `main`

```typescript
interface SystemSettings {
    alertsEnabled: boolean;       // Global ON/OFF for most Slack messages
    enabledAlertTypes: string[];  // Per-type toggles
    updatedAt: string;
}
```

When `alertsEnabled = false`, most Slack messages are silenced EXCEPT:
- **Error channel** (`sendError()`) — always sends
- **Daily briefing** (`sendMultiChannelDigest()`) — uses `bypassMasterSwitch: true`
- **Account health alerts** (`sendAccountHealthAlert()`) — uses `bypassMasterSwitch: true`

### `bypassMasterSwitch` Option
`postMessage()` accepts `opts?: { bypassMasterSwitch?: boolean }`. When `true`, skips the `alertsEnabled` check. Used for critical delivery paths that must always work.

## Slack Delivery

**File:** `src/lib/slack-service.ts`

### Channel Resolution
- Each client has `slackInternalChannel` (team alerts) and `slackPublicChannel` (client-facing)
- Uses `SLACK_BOT_TOKEN` env var with Slack `chat.postMessage` API
- Fallback: `SLACK_WEBHOOK_URL` (not configured in prod)
- Error channel: `SLACK_ERROR_CHANNEL_ID` env var

### Message Types
| Method | Purpose | Trigger | Bypass Master Switch |
|--------|---------|---------|---------------------|
| `sendMultiChannelDigest()` | Unified MTD report (all channels) | daily-briefing cron | YES |
| `sendDailySnapshot()` | Legacy MTD report (Meta-only) | NOT USED (kept for reference) | No |
| `sendCriticalAlert()` | Individual CRITICAL alert | data-sync / daily-digest | No |
| `sendDigest()` | Grouped alert recommendations | data-sync / daily-digest | No |
| `sendWeeklySummary()` | WoW comparison (7d vs 7d) | weekly-alerts cron | No |
| `sendAccountHealthAlert()` | Meta account status/balance | account-health cron | YES |
| `sendSemaforoDigest()` | Quarterly pacing traffic light | semaforo cron | No |
| `sendError()` | Error logging to error channel | Any error via reportError() | YES (hardcoded) |

### `sendMultiChannelDigest()` — Multi-Channel Daily Briefing

**The primary daily Slack message.** Reads aggregated data from `channel_snapshots` (not `client_snapshots`).

**Message format:**
```
📊 WORKER BRAIN — Resumen Diario
{clientName} · 1 mar - 8 mar 2026

━━━ PAID MEDIA ━━━

🟦 Meta:
💰 $X invertido
👁️ X impresiones · X clicks · CTR X%
🛒 X compras
📈 ROAS Xx · CPA $X

🟩 Google:
💰 $X invertido
👁️ X impresiones · X clicks · CTR X%
🎯 X conversiones
📈 ROAS Xx · CPA $X

💸 Total Ads: $X invertido

━━━ EMAIL ━━━

📤 Enviados: X
👀 Opens: X%
🖱️ Clicks: X% · CTOR: X%
💰 Revenue: $X

━━━ ECOMMERCE ━━━

💰 Ventas: $X
📦 X ordenes · 🧾 Ticket: $X
👥 X clientes (X nuevos · X recurrentes)
↩️ Reembolsos: X ($X)

━━━ RESUMEN ━━━

💵 Revenue real (ecommerce): $X
💸 Inversión total (ads): $X
📊 Blended ROAS: Xx
```

**Conditional rendering rules:**
- Only shows sections for channels that have data
- Customers line: hidden when `totalCustomers == 0`
- Refunds line: hidden when `totalRefundAmount == 0` (even if refund count > 0)
- Email revenue: hidden when `emailRevenue == 0`
- RESUMEN section: only shown when ecommerce + at least one ad platform exists
- If no ecommerce but ads exist: shows platform-attributed revenue with warning note

**Revenue dedup rule:** Ecommerce revenue is source of truth. Ad platform revenues (Meta/Google) are attribution-based and overlap — NEVER summed into total. Blended ROAS = `ecommerce_revenue / (meta_spend + google_spend)`.

**Section order:** Paid Media → Email → Ecommerce → Resumen

**Parameters:**
```typescript
static async sendMultiChannelDigest(
    clientId: string,
    clientName: string,
    dateRange: { start: string; end: string }, // YYYY-MM-DD
    channelData: {
        meta?: { spend, impressions, clicks, ctr, conversions, revenue, roas, cpa };
        google?: { spend, impressions, clicks, ctr, conversions, revenue, roas, cpa };
        ecommerce?: { revenue, orders, avgOrderValue, refunds?, totalRefundAmount?, newCustomers?, returningCustomers?, source? };
        email?: { sent, opens, openRate, emailClicks, clickRate, clickToOpenRate, emailRevenue, source? };
    },
    currency?: string
)
```

## Daily Briefing Cron

**File:** `src/app/api/cron/daily-briefing/route.ts`
**Schedule:** 10:15 UTC daily (after data-sync at 10:00 and channel syncs at 09:00)

### Flow:
1. Query all active clients (or single client with `?clientId=XXX`)
2. For each client with `slackInternalChannel`:
   a. Read `channel_snapshots` from 1st of month to yesterday
   b. Aggregate metrics per channel via `aggregateChannelData()`
   c. Call `SlackService.sendMultiChannelDigest()`
3. Log execution to `cron_executions` via EventService

### `aggregateChannelData()` — Aggregation Logic
Sums daily snapshots into per-channel totals. Computes derived metrics:
- **Meta/Google:** CTR = clicks/impressions*100, ROAS = revenue/spend, CPA = spend/conversions
- **Ecommerce:** avgOrderValue = revenue/orders
- **Email:** openRate = opens/sent*100, clickRate = emailClicks/sent*100, clickToOpenRate = emailClicks/opens*100

### Testing single client:
```
GET /api/cron/daily-briefing?clientId=1tGyuVqoeMceQIxy6PiI
Authorization: Bearer {CRON_SECRET}
```

## Alert Engine

**File:** `src/lib/alert-engine.ts`

### `evaluate()` — Pure Function (no DB access)
Takes `AlertEvaluationInput` → returns `Alert[]`.

### 16 Alert Types
| Type | Severity | Slack Channel | Trigger |
|------|----------|---------------|---------|
| SCALING_OPPORTUNITY | INFO | slack_immediate | CPA below target + stable |
| CPA_SPIKE | CRITICAL | slack_immediate | CPA delta > threshold |
| BUDGET_BLEED | CRITICAL | slack_immediate | $0 conversions + high spend |
| ROTATE_CONCEPT | CRITICAL | slack_immediate | Fatigue detected |
| HOOK_KILL | CRITICAL | slack_immediate | Video hook <20% + spend >$50 |
| LEARNING_RESET_RISK | WARNING | slack_weekly | Budget change >30% |
| CPA_VOLATILITY | WARNING | slack_weekly | Budget change >50% |
| CONSOLIDATE | WARNING | slack_weekly | Fragmented/overconcentrated |
| KILL_RETRY | WARNING | slack_weekly | No traction after spend |
| BODY_WEAK | WARNING | slack_weekly | Good hook, bad hold |
| CTA_WEAK | WARNING | slack_weekly | Good hook+hold, bad CTR |
| IMAGE_INVISIBLE | WARNING | slack_weekly | Low CTR on images |
| IMAGE_NO_CONVERT | WARNING | slack_weekly | Good CTR, bad CPA |
| CREATIVE_MIX_IMBALANCE | WARNING | slack_weekly | Low format diversity |
| INTRODUCE_BOFU_VARIANTS | INFO | panel_only | BOFU opportunity |
| VIDEO_DROPOFF | INFO | panel_only | Drop-off at p50/p75/p100 |

### Alert Routing (`getAlertChannel()`)
- `slack_immediate` → CRITICAL + SCALING_OPPORTUNITY → sent in daily digest
- `slack_weekly` → WARNING → sent in weekly digest
- `panel_only` → INFO → dashboard only, no Slack

## Account Health

**File:** `src/lib/account-health-service.ts`
**Cron:** `/api/cron/account-health` (GitHub Actions every 6h)

Checks Meta API for:
1. `account_status` (ACTIVE/DISABLED/UNSETTLED/etc.)
2. `spend_cap` proximity (warning at 70%, critical at 85%, imminent at 95%)
3. `balance` (alerts when ≤ 0 or negative/debt)

Sends alerts on STATE TRANSITIONS only (not every check). Uses `bypassMasterSwitch: true` so alerts always reach Slack regardless of master switch.

Previous state stored in `account_health/{clientId}` collection.

## Data Flow

```
GitHub Actions (09:00 UTC):
  sync-meta → channel_snapshots (META)
  sync-google → channel_snapshots (GOOGLE)
  sync-ecommerce → channel_snapshots (ECOMMERCE)
  sync-email → channel_snapshots (EMAIL)
  sync-ga4 → channel_snapshots (GA4)

GitHub Actions (09:30 UTC):
  fill-gaps → detects + fills missing days

Vercel Cron (10:00 UTC):
  data-sync:
    1. PerformanceService.syncAllLevels("today") → daily_entity_snapshots (Meta only)
    2. ClientSnapshotService.computeAndStore() → client_snapshots + alerts
    3. BackfillService.processBatch(3) → backfill queue
    (NO inline Slack delivery — removed)

GitHub Actions (10:10 UTC):
  semaforo → quarterly pacing computation

GitHub Actions (10:15 UTC):
  daily-briefing:
    1. Query channel_snapshots (1st of month → yesterday)
    2. Aggregate per channel
    3. SlackService.sendMultiChannelDigest() → Slack (all channels)

GitHub Actions (10:30 UTC, Mondays only):
  weekly-alerts → WoW summary + WARNING alerts
```

## Channel Snapshots Schema

**Collection:** `channel_snapshots`
**Doc ID:** `{clientId}__{CHANNEL}__{YYYY-MM-DD}`
**Channels:** META, GOOGLE, ECOMMERCE, EMAIL, GA4, LEADS

Key metrics per channel:
- **META/GOOGLE:** spend, revenue, conversions, roas, cpa, impressions, clicks, ctr
- **ECOMMERCE:** orders, revenue, avgOrderValue, grossRevenue, netRevenue, refunds, totalRefundAmount, newCustomers, returningCustomers
- **EMAIL:** sent, opens, openRate, emailClicks, clickRate, clickToOpenRate, emailRevenue, bounces, unsubscribes
- **GA4:** sessions, totalUsers, bounceRate, ecommercePurchases, purchaseRevenue

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/slack-service.ts` | All Slack message formatting + delivery |
| `src/app/api/cron/daily-briefing/route.ts` | Multi-channel daily digest cron |
| `src/lib/alert-engine.ts` | 16 alert types, pure evaluate() function |
| `src/lib/client-snapshot-service.ts` | Orchestrates Meta data → snapshots + alerts |
| `src/lib/account-health-service.ts` | Meta account status + balance monitoring |
| `src/lib/system-settings-service.ts` | Global master switch (alertsEnabled) |
| `src/lib/semaforo-engine.ts` | Quarterly objective pacing |
| `src/app/api/cron/data-sync/route.ts` | Main cron (Vercel) — no Slack delivery |
| `src/app/api/cron/daily-digest/route.ts` | Legacy digest cron (superseded by daily-briefing) |
| `src/app/api/cron/weekly-alerts/route.ts` | Weekly cron (Mondays) |
| `src/app/api/cron/account-health/route.ts` | Account health cron (every 6h) |
| `src/app/api/cron/semaforo/route.ts` | Semaforo cron (daily) |
| `.github/workflows/crons.yml` | GitHub Actions schedules |
| `src/types/channel-snapshots.ts` | UnifiedChannelMetrics interface |
| `src/types/system-events.ts` | CronExecution types (includes "daily-briefing") |

## Resolved Issues

1. ~~Daily digest is Meta-only~~ → **FIXED**: `sendMultiChannelDigest()` reads from `channel_snapshots` for all channels
2. ~~Duplicate delivery~~ → **FIXED**: Removed inline Slack from `data-sync`. Only `daily-briefing` cron sends Slack
3. ~~Account health not reaching Slack~~ → **FIXED**: `sendAccountHealthAlert()` uses `bypassMasterSwitch: true`
4. ~~Missing crons in GitHub Actions~~ → **FIXED**: Added daily-briefing, semaforo, weekly-alerts

## Remaining Known Issues

1. **MetaBrain fallback bug** — When `USE_METABRAIN_ALERTS=true` and MetaBrain errors, catch returns `[]` instead of falling back to AlertEngine
2. **`data-sync` uses "today"** — Incomplete data for current day. Should use "yesterday" for closed data
3. **Legacy `daily-digest` route** — Still exists at `/api/cron/daily-digest/route.ts` but is superseded by `daily-briefing`. Could be removed
4. **alertsEnabled = false** — Master switch is still off in Firestore. Non-bypass messages (alerts, weekly digest) won't send until turned on
