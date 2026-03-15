# Gotchas, Common Mistakes & Patterns

## Critical Gotchas (Will Cause Bugs)

### 1. Google Ads `cost_micros` — ALWAYS divide by 1,000,000
```typescript
const spend = (row.metrics?.cost_micros || 0) / 1_000_000;
const cpm = (row.metrics?.average_cpm || 0) / 1_000_000;
```
Forgetting this = all spend values 1M times too high.

### 2. GA4 date format — `YYYYMMDD` not `YYYY-MM-DD`
```typescript
// GA4 returns "20250301", we need "2025-03-01"
const date = `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`;
```

### 3. GA4 & Klaviyo rates as decimals
- GA4: `bounceRate`, `engagementRate` come as 0.0-1.0 → multiply by 100
- Klaviyo: `open_rate`, `click_rate` come as 0.0-1.0 → multiply by 100
- Perfit: Rates are already percentages (0-100)

### 4. Tienda Nube uses `Authentication` header, NOT `Authorization`
```typescript
headers: { 'Authentication': `bearer ${token}` }  // Correct
headers: { 'Authorization': `Bearer ${token}` }    // WRONG - will 401
```

### 5. WooCommerce refund totals are NEGATIVE
```typescript
const refundAmount = Math.abs(Number(refund.total || 0));  // Must Math.abs()
```

### 6. Meta `act_` prefix normalization
```typescript
const cleanId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
```
Some clients store with prefix, some without. Always normalize.

### 7. Firestore `ignoreUndefinedProperties: true`
Set in `firebase-admin.ts`. Without this, writing objects with `undefined` fields throws errors. This means you DON'T need to strip undefined values before writing — Firestore skips them.

### 8. Firestore batch limit: 500 operations
Code chunks at 400 for safety:
```typescript
for (let i = 0; i < items.length; i += 400) {
  const batch = db.batch();
  for (const item of items.slice(i, i + 400)) {
    batch.set(ref, data);
  }
  await batch.commit();
}
```

### 9. `buildChannelSnapshotId()` — Always use the helper
```typescript
import { buildChannelSnapshotId } from "@/types/channel-snapshots";
const docId = buildChannelSnapshotId(clientId, "META", "2025-03-01");
// → "clientId__META__2025-03-01"
```
Never construct the ID manually — the format must be exact.

### 10. `ChannelType` vs `ChannelId`
- `ChannelType` (from `channel-brain-interface.ts`): `'META' | 'GOOGLE' | 'GA4' | 'ECOMMERCE' | 'EMAIL' | 'LEADS'` — used in Firestore
- `ChannelId` (from `ai-analyst/types.ts`): `'meta_ads' | 'google_ads' | 'ga4' | ...` — used in AI Analyst UI
- `CHANNEL_TO_FIRESTORE` maps between them

## Service Patterns

### All Services are Static Classes
```typescript
export class ShopifyService {
  static async syncToChannelSnapshots(...): Promise<{ daysWritten: number }> { }
  private static async fetchOrders(...): Promise<ShopifyOrder[]> { }
}
```
No instantiation needed. Import and call static methods directly.

### syncToChannelSnapshots() Return Type
All channel services return `{ daysWritten: number }`. The backfill service uses this.

### Dynamic Imports in Backfill
`channel-backfill-service.ts` uses dynamic imports to avoid loading all services at init:
```typescript
const { GoogleAdsService } = await import("@/lib/google-ads-service");
```

## UI Patterns

### Period Filters
Channel pages use MTD / last month / 2 months ago selectors. Logic:
- MTD: 1st of current month → yesterday
- Last month: 1st of last month → last day of last month
- 2 months ago: 1st of 2 months ago → last day of 2 months ago

### Conditional Rendering by Platform
Ecommerce and Email pages detect platform from `rawData.source`:
```typescript
const isShopify = rawData?.source === 'shopify';
const isTiendaNube = rawData?.source === 'tiendanube';
// Show different sections based on platform
```

### "Analizar con IA" Button
Every channel page has this button in the header:
```typescript
import { useAnalyst } from "@/contexts/AnalystContext";
const { openAnalyst } = useAnalyst();
// onClick:
openAnalyst('meta_ads');
```

## Testing Patterns

### Alert Engine Tests
```bash
npx tsx --require ./scripts/load-env.cjs scripts/test-alert-engine.ts
```
Uses `AlertEngine.evaluate()` (pure function, no DB) with mock data.

### TypeScript Check
```bash
npx tsc --noEmit
```
Known pre-existing errors (8): cerebro SetStateAction types, findings DateRangeOption, creative-classifier days_active, recommendation-service duplicates. Don't fix these unless specifically asked.

### Deploying Firestore Indexes
```bash
firebase deploy --only firestore:indexes
```
Index definitions in `firestore.indexes.json`.

## Environment Variables

All in `.env.local`. Critical ones:
- `META_ACCESS_TOKEN` — System user token for Meta Graph API
- `GOOGLE_ADS_*` — Developer token, OAuth credentials, MCC login ID
- `CRON_SECRET` — Auth for cron endpoints
- `ANTHROPIC_API_KEY` — For AI Analyst (Claude)
- `GEMINI_API_KEY` — For Creative DNA, reports
- `SLACK_BOT_TOKEN` — For digest/alert messages
- Platform tokens stored per-client in Firestore (Shopify, TiendaNube, Klaviyo, Perfit, WooCommerce)

## Adding a New Channel — Checklist

1. **Types**: Add to `ChannelType` in `channel-brain-interface.ts`
2. **Metrics**: Add fields to `UnifiedChannelMetrics` in `channel-snapshots.ts`
3. **Service**: Create `src/lib/{channel}-service.ts` with static `syncToChannelSnapshots()`
4. **Cron**: Create `src/app/api/cron/sync-{channel}/route.ts`
5. **Backfill**: Add case to `channel-backfill-service.ts` (`BackfillChannel` type + switch cases)
6. **Client config**: Add credential fields to `Client` interface + `integraciones` object
7. **Client form**: Add fields to admin client form UI
8. **UI page**: Create `src/components/pages/{Channel}Channel.tsx`
9. **Route**: Create page in `src/app/(auth)/{channel}/page.tsx`
10. **Nav**: Add to sidebar navigation
11. **AI Analyst**: Add to types.ts, context-builder, xml-formatter, prompts.ts
12. **Suggested questions**: Add to `SUGGESTED_QUESTIONS` in `ai-analyst/types.ts`

## Alert System Quick Reference

### AlertEngine.evaluate() — Pure Function
```typescript
const alerts: Alert[] = AlertEngine.evaluate(input: AlertEvaluationInput);
// No DB access — takes all data as parameters, returns alerts
```

### Alert Routing
- `slack_immediate`: CRITICAL + SCALING_OPPORTUNITY → daily digest
- `slack_weekly`: WARNING → weekly Monday digest
- `panel_only`: INFO → dashboard only

### 16 Alert Types
CRITICAL: CPA_SPIKE, BUDGET_BLEED, ROTATE_CONCEPT, HOOK_KILL
WARNING: LEARNING_RESET_RISK, CPA_VOLATILITY, CONSOLIDATE, KILL_RETRY, BODY_WEAK, CTA_WEAK, IMAGE_INVISIBLE, IMAGE_NO_CONVERT, CREATIVE_MIX_IMBALANCE
INFO: SCALING_OPPORTUNITY, INTRODUCE_BOFU_VARIANTS, VIDEO_DROPOFF

## Leads Channel Specifics

### Data Flow
```
GHL Webhook → POST /api/webhooks/ghl → creates/updates lead in `leads` collection
                                      → matched to client via ghlLocationId
sync-leads cron → aggregates leads → writes to channel_snapshots (LEADS)
```

### Lead Lifecycle
`pending` → `calificado`/`no_calificado`/`spam` → `nuevo_cliente`/`seguimiento`/`no_asistio`

### Two Modes
- `full_funnel`: Calendar bookings, closer assignment, attendance tracking
- `whatsapp_simple`: Simpler lead capture without booking flow

### LeadsConfig (per client)
```typescript
leadsConfig: {
  closers: ['Maria', 'Sebastian'],
  calendarTypes: ['Llamada De Descubrimiento'],
  mode: 'full_funnel'
}
```
