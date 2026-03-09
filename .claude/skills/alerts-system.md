---
description: "Complete knowledge of the alerts, notifications, and Slack messaging system. Use when working on alert delivery, Slack digests, cron scheduling, account health, or any notification pipeline."
---

# Alerts & Notifications System — Skill Reference

## Architecture Overview

The system has 3 layers:
1. **Data Collection** — Channel syncs write to `channel_snapshots` (working)
2. **Alert Computation** — AlertEngine evaluates Meta data → produces Alert[] (Meta-only)
3. **Notification Delivery** — SlackService sends messages to per-client Slack channels

## Cron Scheduling

### Vercel (free tier = 1 cron only)
- `data-sync` at 10:00 UTC — The ONLY Vercel cron. Runs Meta sync + snapshot computation + inline Slack delivery.

### GitHub Actions (`.github/workflows/crons.yml`)
| Schedule | Job | Triggers |
|----------|-----|----------|
| `0 9 * * *` | sync-channels | sync-meta, sync-google, sync-ecommerce, sync-email, sync-ga4 |
| `30 9 * * *` | fill-gaps | fill-gaps (detects + fills missing snapshots) |
| `0 */6 * * *` | account-health | account-health check |

### NOT SCHEDULED (need to add to GitHub Actions):
- `daily-digest` — More complete than data-sync inline delivery (includes Semaforo)
- `weekly-alerts` — WoW summary + WARNING alerts (should run Mondays)
- `semaforo` — Quarterly objective pacing (needs quarterly_objectives in Firestore)
- `creative-dna` — AI creative analysis
- `classify-entities` — GEM classification
- `sync-creatives` — Meta creative asset sync

## Master Switch

**File:** `src/lib/system-settings-service.ts`
**Collection:** `system_config` doc `main`

```typescript
interface SystemSettings {
    alertsEnabled: boolean;       // Global ON/OFF for all Slack messages
    enabledAlertTypes: string[];  // Per-type toggles
    updatedAt: string;
}
```

When `alertsEnabled = false`, ALL Slack messages are silenced EXCEPT error channel.
Default is `true` but the Firestore doc may have been set to `false` manually.

## Slack Delivery

**File:** `src/lib/slack-service.ts` (879 lines)

### Channel Resolution
- Each client has `slackInternalChannel` (team alerts) and `slackPublicChannel` (client-facing)
- Uses `SLACK_BOT_TOKEN` env var with Slack `chat.postMessage` API
- Fallback: `SLACK_WEBHOOK_URL` (not configured in prod)
- Error channel: `SLACK_ERROR_CHANNEL_ID` env var

### Message Types
| Method | Purpose | Trigger |
|--------|---------|---------|
| `sendDailySnapshot()` | MTD KPI report (Meta-only currently) | data-sync cron inline |
| `sendCriticalAlert()` | Individual CRITICAL alert | data-sync / daily-digest |
| `sendDigest()` | Grouped alert recommendations | data-sync / daily-digest |
| `sendWeeklySummary()` | WoW comparison (7d vs 7d) | weekly-alerts cron |
| `sendAccountHealthAlert()` | Meta account status/balance | account-health cron |
| `sendSemaforoDigest()` | Quarterly pacing traffic light | daily-digest cron |
| `sendError()` | Error logging | Any error via reportError() |

### `sendDailySnapshot()` — Current Format (Meta-only)
Reads from `client_snapshots.accountSummary` which comes from `daily_entity_snapshots` (Meta only).
Shows: Spend, Clicks, CPC, CTR, Impressions, Conversions (purchases/leads/whatsapp based on objective), ROAS.
Does NOT include: Ecommerce real revenue, Email revenue, Google Ads data.

### `buildSnapshotFromClientSnapshot()` — KPI Builder
Reads `accountSummary.mtd` (MTD aggregation) if available, falls back to `rolling` (7d).
MTD fields: spend, clicks, impressions, purchases, revenue, addToCart, checkout, leads, whatsapp.

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

Sends alerts on STATE TRANSITIONS only (not every check):
- `ACCOUNT_DISABLED` → critical
- `ACCOUNT_REACTIVATED` → info
- `SPEND_CAP_WARNING/CRITICAL/IMMINENT` → warning/critical
- `ACCOUNT_NO_BALANCE` → critical

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
    3. SlackService.sendDailySnapshot() → Slack (Meta KPIs only)
    4. SlackService.sendDigest() → Slack (Meta alerts only)

NOT RUNNING (needs GitHub Actions):
  daily-digest → More complete: snapshot + alerts + semaforo
  weekly-alerts → Monday WoW summary
  semaforo → Quarterly pacing
  account-health → Already in GH Actions every 6h
```

## Channel Snapshots Schema

**Collection:** `channel_snapshots`
**Doc ID:** `{clientId}__{CHANNEL}__{YYYY-MM-DD}`
**Channels:** META, GOOGLE, ECOMMERCE, EMAIL, GA4

Key metrics per channel:
- **META/GOOGLE:** spend, revenue, conversions, roas, cpa, impressions, clicks, ctr
- **ECOMMERCE:** orders, revenue, avgOrderValue, grossRevenue, netRevenue, refunds
- **EMAIL:** sent, opens, openRate, emailClicks, clickRate, emailRevenue
- **GA4:** sessions, totalUsers, bounceRate, ecommercePurchases, purchaseRevenue

## Known Issues

1. **Daily digest is Meta-only** — `sendDailySnapshot()` reads from `client_snapshots.accountSummary` which only has Meta data. Does NOT read `channel_snapshots` for other channels.
2. **Duplicate delivery** — `data-sync` sends Slack inline AND `daily-digest` is a separate cron (currently not scheduled). Need to pick one.
3. **Account health not reaching Slack** — Likely because `alertsEnabled = false` in `system_config.main`. The `sendAccountHealthAlert` respects the master switch.
4. **MetaBrain fallback bug** — When `USE_METABRAIN_ALERTS=true` and MetaBrain errors, catch returns `[]` instead of falling back to AlertEngine.
5. **`data-sync` uses "today"** — Incomplete data for current day. Should use "yesterday" for closed data.

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/slack-service.ts` | All Slack message formatting + delivery |
| `src/lib/alert-engine.ts` | 16 alert types, pure evaluate() function |
| `src/lib/client-snapshot-service.ts` | Orchestrates Meta data → snapshots + alerts |
| `src/lib/account-health-service.ts` | Meta account status + balance monitoring |
| `src/lib/system-settings-service.ts` | Global master switch (alertsEnabled) |
| `src/lib/semaforo-engine.ts` | Quarterly objective pacing |
| `src/app/api/cron/data-sync/route.ts` | Main cron (Vercel) |
| `src/app/api/cron/daily-digest/route.ts` | Dedicated digest cron (not scheduled) |
| `src/app/api/cron/weekly-alerts/route.ts` | Weekly cron (not scheduled) |
| `src/app/api/cron/account-health/route.ts` | Account health cron (GH Actions) |
| `src/app/api/cron/semaforo/route.ts` | Semaforo cron (not scheduled) |
| `.github/workflows/crons.yml` | GitHub Actions schedules |
| `src/types/channel-snapshots.ts` | UnifiedChannelMetrics interface |
| `src/types/semaforo.ts` | Semaforo types |
| `src/lib/channel-brain-interface.ts` | ChannelBrain abstract (future) |
