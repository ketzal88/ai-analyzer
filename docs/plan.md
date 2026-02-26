Worker Brain V2 — Phase 1 Implementation Plan
Context
Why This Change Is Needed
The current system is a Meta-only diagnostic tool that analyzes Facebook/Instagram ad performance through a sophisticated multi-engine architecture (DecisionEngine, AlertEngine, CreativeClassifier). While powerful, it's architecturally locked to a single channel.

The Problem:

Clients run ads on multiple platforms (Meta + Google + TikTok)
Sales happen through ecommerce platforms (Shopify, TiendaNube)
User behavior is tracked in GA4
But the system only sees Meta data — creating blind spots in attribution, ROAS calculation, and strategic decision-making
The Vision:
Transform into a multi-channel Master Brain that:

Analyzes each channel through specialized "Channel Brains" (Meta, Google, GA4, Ecommerce)
Correlates signals across channels via a "Master Brain"
Calculates true Blended ROAS using real ecommerce data
Detects cross-channel issues (attribution discrepancies, landing page problems, channel cannibalization)
This Implementation (Phase 1):
Establish the architectural foundation without breaking anything. The system will work exactly as before, but on a new structure that enables multi-channel expansion in future phases.

Master Plan Document
All technical specifications, interfaces, prompts, and phasing details are documented in:

worker_brain_v2_master_plan_1.md
This plan focuses on Phase 1: Refactoring Base (Section 11 of master plan).

Success Criteria
Primary Goal: System works exactly as before, but on new architecture.

Deliverables:

✅ Meta data flows through new dashbo_snapshots/{clientId}/{date}/meta structure
✅ Existing DecisionEngine/AlertEngine/CreativeClassifier wrapped in MetaBrain class
✅ Prompts stored in Firestore (brain_prompts/meta) and editable via Cerebro
✅ Client config extended with integraciones, targets, timezone (optional fields)
✅ Zero breaking changes — all UI pages work identically
✅ Slack digests sent with same format and timing
Validation:

Run data-sync cron → verify dashbo_snapshots created
Compare output → client_snapshots doc identical to previous day
Edit alert rule in Cerebro → next digest reflects change (no code deploy)
Change client timezone → date ranges shift correctly
Architecture Changes
Current Flow (Meta-only)

Meta API → PerformanceService.syncAllLevels()
  → daily_entity_snapshots (flat collection)
  → ClientSnapshotService.computeAndStore()
    → DecisionEngine (5-layer classification)
    → AlertEngine (10+ alert types)
    → CreativeClassifier (6 categories)
  → client_snapshots + client_snapshots_ads
  → SlackService → Slack Digest
New Flow (Phase 1 — ChannelBrain Pattern)

Meta API → PerformanceService.syncAllLevels()
  → dashbo_snapshots/{clientId}/{date}/meta (nested structure)
  → ClientSnapshotService.computeAndStore()
    → MetaBrain.analyze() (wrapper)
      → DecisionEngine (unchanged)
      → AlertEngine (unchanged)
      → CreativeClassifier (unchanged)
    → Returns ChannelSignals (standardized output)
  → client_snapshots + client_snapshots_ads (same structure)
  → SlackService → Slack Digest
Key Insight: MetaBrain is a thin wrapper around existing engines. No logic rewrite. Just changes WHERE we read data from and HOW we structure output.

Critical Files & Changes
1. New Core Infrastructure
src/lib/channel-brain-interface.ts (NEW)
Purpose: Define standardized interfaces for all Channel Brains

Key Exports:


export type ChannelType = 'META' | 'GOOGLE' | 'GA4' | 'ECOMMERCE';

export interface ChannelSignals {
  canal: ChannelType;
  clientId: string;
  dateRange: { start: string; end: string };
  kpis: { costo?, ingresos?, roas?, cpa?, conversiones?, clicks?, impresiones?, ctr? };
  alerts: ChannelAlert[];
  signals: Record<string, number | string | boolean | null>;  // For Master Brain
  dataQuality: { fieldsWithNull: string[]; confidence: 'HIGH' | 'MEDIUM' | 'LOW' };
}

export interface ChannelAlert {
  type: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  message: string;
  recommendation: string;
  data: Record<string, unknown>;
}

export abstract class ChannelBrain {
  abstract analyze(
    clientId: string,
    dateRange: { start: string; end: string },
    clientConfig: ClientConfigV2
  ): Promise<ChannelSignals>;
}
src/lib/date-utils.ts (NEW)
Purpose: Standardized date handling for all channels

Key Functions:


// Returns { today, yesterday, last7days, last30days, mtd }
export function buildDateRanges(now?: Date): DateRanges

// Parse Dashbo date format: "20260224" → Date
export function parseDashboDate(raw: string): Date

// Build ranges for client timezone (critical for international clients)
export function buildDateRangesForTimezone(tz: string): DateRanges
Why:

Replaces scattered date logic throughout codebase
Prepares for Dashbo integration (uses "YYYYMMDD" format)
Enables timezone-aware snapshots
src/lib/meta-brain.ts (NEW)
Purpose: Wrap existing Meta engines in ChannelBrain interface

Architecture:


export class MetaBrain extends ChannelBrain {
  async analyze(clientId, dateRange, clientConfig): Promise<ChannelSignals> {
    // 1. Read from dashbo_snapshots/{clientId}/{date}/meta
    const rawData = await this.readMetaSnapshot(clientId, dateRange);

    // 2. Compute rolling metrics (existing PerformanceService logic)
    const rolling = this.computeRolling(rawData);

    // 3. Run existing engines (ZERO CHANGES to logic)
    const classifications = DecisionEngine.run(rolling, clientConfig);
    const alerts = AlertEngine.run(rolling, classifications, clientConfig);

    // 4. Map to ChannelSignals format
    return {
      canal: 'META',
      kpis: this.extractKPIs(rolling),
      alerts: this.mapAlerts(alerts),
      signals: this.extractSignals(rolling, classifications),
      dataQuality: { fieldsWithNull: [], confidence: 'HIGH' }
    };
  }
}
Critical: This is a delegation wrapper, not a rewrite. All business logic stays in DecisionEngine/AlertEngine/CreativeClassifier.

2. Modified Core Services
src/lib/client-snapshot-service.ts (MODIFY)
File: client-snapshot-service.ts

Current Logic (line 26-98):


static async computeAndStore(clientId: string, targetDate?: string) {
  // Read from daily_entity_snapshots
  const snapshotDocs = await db.collection("daily_entity_snapshots")
    .where("clientId", "==", clientId).get();

  // Compute rolling metrics
  const rolling = PerformanceService.computeRollingForEntity(...);

  // Run engines directly
  const classifications = DecisionEngine.run(...);
  const alerts = AlertEngine.run(...);

  // Write to client_snapshots
  await this.writeSnapshots(clientId, snapshot, adsSnapshot);
}
New Logic:


static async computeAndStore(clientId: string, targetDate?: string) {
  const client = await this.getClient(clientId);
  const dateRanges = buildDateRangesForTimezone(client.timezone || 'UTC');

  // Run MetaBrain if enabled (Phase 1: always true)
  const channelResults: ChannelSignals[] = [];

  if (client.integraciones?.meta !== false) {  // Default true
    const metaBrain = new MetaBrain();
    const metaSignals = await metaBrain.analyze(clientId, dateRanges.yesterday, client);
    channelResults.push(metaSignals);
  }

  // Future: Add GoogleBrain, GA4Brain, EcommerceBrain

  // Merge alerts from all channels
  const allAlerts = channelResults.flatMap(ch => ch.alerts);

  // Build unified snapshot (same structure as before)
  const snapshot = this.buildSnapshot(channelResults, allAlerts);

  // Write to Firestore (unchanged)
  await this.writeSnapshots(clientId, snapshot);
}
Changes:

Check client.integraciones to determine which brains to run (Phase 1: only Meta)
Call MetaBrain.analyze() instead of direct engine calls
Output structure remains identical to current system (backward compatible)
src/lib/performance-service.ts (MODIFY)
File: performance-service.ts

Current Logic (line 59):


static async syncAllLevels(clientId, metaAdAccountId, range = "last_7d") {
  // Fetch from Meta API
  const data = await this.fetchWithRetry(url);

  // Write to daily_entity_snapshots
  await db.collection("daily_entity_snapshots").doc(docId).set(snapshot);
}
New Logic (Dual-Write):


static async syncAllLevels(clientId, metaAdAccountId, range = "last_7d") {
  // Fetch from Meta API (unchanged)
  const data = await this.fetchWithRetry(url);

  // Write to BOTH structures during transition
  if (process.env.ENABLE_DUAL_WRITE === 'true') {
    await db.collection("daily_entity_snapshots").doc(docId).set(snapshot);
  }

  // NEW: Write to dashbo_snapshots structure
  await db.doc(`dashbo_snapshots/${clientId}/${dateStr}/meta`).set({
    account: accountSnapshots,
    campaign: campaignSnapshots,
    adset: adsetSnapshots,
    ad: adSnapshots,
    updatedAt: new Date().toISOString()
  });
}
Migration Strategy:

Week 1-2: Dual-write enabled (ENABLE_DUAL_WRITE=true) — writes to both old and new
Week 3: MetaBrain reads from new structure with fallback to old
Week 4: Validate for 7 days, then disable dual-write
Week 5+: Clean up old daily_entity_snapshots collection
3. Extended Configuration
src/types/index.ts (MODIFY)
File: index.ts

Add to Client interface:


export interface Client {
  // ... existing fields (id, slug, name, metaAdAccountId, etc.)

  // NEW: Multi-channel integrations
  integraciones?: {
    meta: boolean;         // Phase 1: Meta enabled
    google: boolean;       // Phase 4: Google Ads
    ga4: boolean;          // Phase 3: Google Analytics 4
    ecommerce: 'tiendanube' | 'shopify' | null;  // Phase 2
    email: 'klaviyo' | 'perfit' | null;          // Phase 6
  };

  // NEW: Channel-specific targets
  targets?: {
    cpa_meta?: number;
    cpa_google?: number;
    roas_meta?: number;
    roas_google?: number;
    blended_roas_target?: number;        // Phase 4
    tasa_rebote_baseline?: number;       // Phase 3
    tasa_checkout_baseline?: number;     // Phase 3
  };

  // NEW: Cross-channel alert thresholds
  crossChannelThresholds?: {
    attribution_discrepancy_pct: number;  // default: 40
    organic_drop_pct: number;             // default: 25
    bounce_spike_pct: number;             // default: 20
  };

  // NEW: Timezone for date construction
  timezone?: string;  // default: "America/Argentina/Buenos_Aires"
}

// Type alias for backward compatibility
export type ClientConfigV2 = Client;
Why Optional (?):

Existing clients work with defaults
No migration script needed
Admin form seeds defaults on first edit
4. Brain Prompts System
Firestore Collection: brain_prompts/{brainId}
Schema:


export interface BrainPrompt {
  brainId: 'META' | 'GOOGLE' | 'GA4' | 'ECOMMERCE' | 'MASTER';
  version: string;          // semver: "1.0.0"
  updatedAt: Timestamp;
  systemPrompt: string;     // Role and principles
  analysisPrompt: string;   // Template with {placeholders}
  alertRules: AlertRule[];  // JSON rules — iterable without deploy
}

export interface AlertRule {
  id: string;               // "META_HIGH_FREQUENCY"
  enabled: boolean;
  condition: string;        // Human-readable description
  threshold: number;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  messageTemplate: string;  // "Frecuencia {value}x supera umbral {threshold}x"
  recommendation: string;
}
Initial Seed Data (Phase 1):

Document: brain_prompts/meta
Content: From master plan Section 5.2
Alert Rules: 4 rules (HIGH_FREQUENCY, LOW_ROAS, BUDGET_BLEED, SCALING_OPPORTUNITY)
src/lib/brain-prompt-service.ts (NEW)
Purpose: Service to fetch/cache brain prompts


export class BrainPromptService {
  private static cache = new Map<string, BrainPrompt>();
  private static cacheTTL = 5 * 60 * 1000; // 5 minutes

  static async getBrainPrompt(brainId: string): Promise<BrainPrompt> {
    // Check cache
    const cached = this.cache.get(brainId);
    if (cached && !this.isCacheExpired(cached)) return cached;

    // Fetch from Firestore
    const doc = await db.collection("brain_prompts").doc(brainId).get();
    if (!doc.exists) throw new Error(`Brain prompt not found: ${brainId}`);

    const prompt = doc.data() as BrainPrompt;
    this.cache.set(brainId, prompt);
    return prompt;
  }

  static async getAlertRules(brainId: string): Promise<AlertRule[]> {
    const prompt = await this.getBrainPrompt(brainId);
    return prompt.alertRules.filter(r => r.enabled);
  }
}
Integration with MetaBrain:


// In MetaBrain.evaluateAlerts()
const rules = await BrainPromptService.getAlertRules('META');

for (const rule of rules) {
  if (this.meetsCondition(rule, data)) {
    alerts.push({
      type: rule.id,
      severity: rule.severity,
      message: this.interpolate(rule.messageTemplate, data),
      recommendation: rule.recommendation
    });
  }
}
Why This Matters:

Iterate alert logic without deploy — edit in Cerebro, save, next cron uses new rules
Version control — track changes via updatedAt timestamp
A/B testing — can have multiple versions and switch between them
5. Admin UI Updates
src/app/admin/clients/page.tsx (MODIFY)
Add Section: Integraciones (Channel Integrations)


<div className="space-y-4">
  <h3>Integraciones Activas</h3>

  <label>
    <input type="checkbox" checked={client.integraciones?.meta ?? true} />
    Meta Ads (Facebook/Instagram)
  </label>

  <label>
    <input type="checkbox" checked={client.integraciones?.google ?? false} />
    Google Ads
  </label>

  <label>
    <input type="checkbox" checked={client.integraciones?.ga4 ?? false} />
    Google Analytics 4
  </label>

  <label>
    <select value={client.integraciones?.ecommerce || ''}>
      <option value="">Sin ecommerce</option>
      <option value="tiendanube">TiendaNube</option>
      <option value="shopify">Shopify</option>
    </select>
  </label>
</div>
Add Section: Targets por Canal


<div className="grid grid-cols-2 gap-4">
  <div>
    <label>CPA Target Meta</label>
    <input type="number" value={client.targets?.cpa_meta || ''} />
  </div>

  <div>
    <label>ROAS Target Meta</label>
    <input type="number" value={client.targets?.roas_meta || ''} />
  </div>

  <div>
    <label>Timezone</label>
    <select value={client.timezone || 'America/Argentina/Buenos_Aires'}>
      <option value="America/Argentina/Buenos_Aires">Buenos Aires (GMT-3)</option>
      <option value="America/Mexico_City">Ciudad de México (GMT-6)</option>
      <option value="America/New_York">New York (GMT-5)</option>
      <option value="Europe/Madrid">Madrid (GMT+1)</option>
    </select>
  </div>
</div>
src/app/admin/cerebro/page.tsx (MODIFY)
Add Tab: Brain Prompts Editor

UI Flow:

Select Brain ID (dropdown: META, GOOGLE, GA4, ECOMMERCE, MASTER)
Load current version from Firestore
Show editable fields:
System Prompt (textarea)
Analysis Prompt (textarea)
Alert Rules (JSON editor or table)
Save as new version (increment semver)
Activate button (archives previous, sets new as active)
API Endpoint: /api/admin/brain-prompts

GET ?brainId=META → Load current active version
POST → Create new draft version
POST /activate → Set draft as active
Cache Structure Migration
Current Structure (Flat)

daily_entity_snapshots/
  {docId} = {clientId}__{date}__{level}__{entityId}
    fields: { clientId, date, level, entityId, performance, engagement, ... }
Problems:

All clients mixed in one collection
Hard to query by date range
No separation by channel
Doc size limits for high-volume accounts
New Structure (Nested)

dashbo_snapshots/
  {clientId}/
    {YYYY-MM-DD}/
      meta/
        fields: {
          account: DailyEntitySnapshot[]
          campaign: DailyEntitySnapshot[]
          adset: DailyEntitySnapshot[]
          ad: DailyEntitySnapshot[]
          updatedAt: string
        }
      google/      ← Phase 4
      ga4/         ← Phase 3
      ecommerce/   ← Phase 2
      master/      ← Phase 4 (Master Brain output)
    {YYYY-MM}/
      mtd_meta/    ← Monthly aggregations
      mtd_google/
      mtd_ga4/
      mtd_ecommerce/
Benefits:

Atomicity: One write per channel per day
Queryability: Easy to fetch date ranges for a client
Scalability: Separates channels, prevents doc size bloat
Historical: Natural versioning by date
Future-proof: Structure supports MTD aggregations
Migration Script
File: scripts/migrate-to-dashbo-structure.ts (NEW)


// Read from daily_entity_snapshots
// Group by clientId, date, level
// Write to dashbo_snapshots/{clientId}/{date}/meta

const clients = ['client1', 'client2', ...];
const last35Days = getLast35Days();

for (const clientId of clients) {
  for (const date of last35Days) {
    const snapshots = await db.collection("daily_entity_snapshots")
      .where("clientId", "==", clientId)
      .where("date", "==", date)
      .get();

    const grouped = groupByLevel(snapshots);

    await db.doc(`dashbo_snapshots/${clientId}/${date}/meta`).set({
      account: grouped.account,
      campaign: grouped.campaign,
      adset: grouped.adset,
      ad: grouped.ad,
      updatedAt: new Date().toISOString()
    });
  }
}
Execution:


npm run migrate-cache -- --clients=all --days=35
Implementation Checklist (4 Weeks)
Week 1: Core Infrastructure
 Create src/lib/channel-brain-interface.ts

Define ChannelSignals, ChannelAlert, ChannelBrain abstract class
Add JSDoc comments with examples
 Create src/lib/date-utils.ts

Implement buildDateRanges(), parseDashboDate(), buildDateRangesForTimezone()
Add unit tests (__tests__/date-utils.test.ts)
Test edge cases: leap years, month boundaries, invalid timezones
 Create src/lib/meta-brain.ts

Implement MetaBrain extends ChannelBrain
Wrapper methods delegate to DecisionEngine, AlertEngine, CreativeClassifier
Map outputs to ChannelSignals interface
Add JSDoc with architecture notes
 Extend src/types/index.ts

Add integraciones, targets, crossChannelThresholds, timezone to Client interface
Make all fields optional for backward compatibility
Add type alias ClientConfigV2 = Client
Week 2: Cache Migration & Brain Prompts
Track A: Cache (3 days)

 Create migration script

scripts/migrate-to-dashbo-structure.ts
Group snapshots by client, date, level
Write to new structure
Log progress and errors
 Update PerformanceService for dual-write

Modify syncAllLevels() to write to both old and new structures
Add ENABLE_DUAL_WRITE env flag (default: true)
Log which structure(s) written
 Run migration for all active clients

Execute script for last 35 days
Verify data integrity (compare doc counts)
Spot-check 3 clients manually
Track B: Brain Prompts (2 days)

 Create seed script

scripts/seed-brain-prompts.ts
Populate brain_prompts/meta with v1.0.0 from master plan Section 5.2
Include 4 alert rules
 Create src/lib/brain-prompt-service.ts

getBrainPrompt(brainId) with 5-min cache
getAlertRules(brainId) filtering enabled rules
 Update MetaBrain to use prompts

Replace hardcoded alert logic with rules from brain_prompts/meta
Keep client-specific thresholds in engine_configs (override defaults)
Week 3: Orchestrator Refactor & Admin UI
Track A: Orchestrator (3 days)

 Refactor ClientSnapshotService.computeAndStore()

Check client.integraciones.meta before running MetaBrain
Call MetaBrain.analyze() instead of direct engine calls
Keep same output structure (client_snapshots + client_snapshots_ads)
 Update MetaBrain reader

Read from dashbo_snapshots/{clientId}/{date}/meta
Fallback to daily_entity_snapshots if new structure doesn't exist (safety)
 Test cron jobs

Run data-sync manually → verify new snapshots created
Run daily-digest → verify Slack message sent correctly
Compare output to previous day (should be identical)
Track B: Admin UI (2 days)

 Update /admin/clients form

Add "Integraciones" section (checkboxes + dropdown)
Add "Targets por Canal" section (CPA/ROAS inputs)
Add "Timezone" dropdown (use IANA tz list)
 Update /admin/cerebro

Add tab for editing Brain Prompts
Load from brain_prompts/{brainId}
Allow editing systemPrompt, analysisPrompt, alertRules
Save as new version (increment semver)
Activate button (archives old, sets new active)
 Create API routes

GET /api/admin/brain-prompts?brainId=META
POST /api/admin/brain-prompts (create draft)
POST /api/admin/brain-prompts/activate (set active)
Week 4: Testing & Validation
 Unit tests

date-utils.test.ts: All timezone combinations
meta-brain.test.ts: Signal extraction, alert mapping
Mock Firestore responses
 Integration tests

Full pipeline: Meta API → dashbo_snapshots → MetaBrain → client_snapshots → Slack
Use test client with known data
Compare old vs new output (should match 100%)
 Regression validation

Record baseline output for 3 production clients (pre-Phase 1)
Run Phase 1 system for same date range
Compare outputs field-by-field
Acceptance: 100% match
 Manual testing

Edit alert rule in Cerebro → save → run cron → verify Slack reflects change
Change client timezone → run cron → verify date ranges correct
Disable Meta integration → verify no alerts generated
 Performance testing

Measure cron execution time before/after
Acceptance: <10% latency increase
Monitor Firestore read/write costs
Verification Steps
1. Cache Migration Validation

# Check new structure created
firebase firestore:get dashbo_snapshots/{clientId}/{YYYY-MM-DD}/meta

# Compare doc counts
OLD_COUNT=$(firebase firestore:count daily_entity_snapshots --where clientId=={clientId})
NEW_COUNT=$(firebase firestore:count dashbo_snapshots/{clientId})

echo "Old: $OLD_COUNT, New: $NEW_COUNT (should be similar)"
2. MetaBrain Output Validation

# Run data-sync for test client
npm run cron:data-sync -- --clientId=test_client_123

# Compare to baseline (pre-Phase 1)
npm run compare-snapshots -- --clientId=test_client_123 --date=2026-02-24
# Expected: ✅ 100% match
3. Slack Digest Validation
Before Phase 1: Record Slack message for client X on date Y
After Phase 1: Run cron for same date, compare messages
Acceptance: Identical format, alerts, metrics
4. Cerebro Prompt Editing
Open /admin/cerebro → Brain Prompts tab
Edit alert rule: Change META_HIGH_FREQUENCY threshold from 3.5 to 4.0
Save as draft → Activate
Run data-sync cron
Check Slack → verify no high frequency alert for campaigns with frequency 3.6-3.9x
Acceptance: Alert logic changed WITHOUT code deploy
5. Timezone Handling
Open /admin/clients → Edit client in Mexico
Set timezone: America/Mexico_City (GMT-6)
Run data-sync at 10:00 UTC (04:00 Mexico time)
Verify dashbo_snapshots/{clientId}/{YYYY-MM-DD}/meta uses PREVIOUS day (Mexico is still in yesterday)
Acceptance: Date ranges respect client timezone
Rollback Plan
If Issues Detected in Week 4 Validation:
Step 1: Emergency Reader Flip


// src/lib/meta-brain.ts
const USE_OLD_STRUCTURE = true; // Emergency flag

private async readMetaSnapshot(clientId: string, dateRange: any) {
  if (USE_OLD_STRUCTURE) {
    // Fall back to reading from daily_entity_snapshots
    return this.readFromOldStructure(clientId, dateRange);
  }
  // Normal path: read from dashbo_snapshots
}
Step 2: Keep Dual-Write Enabled

ENABLE_DUAL_WRITE=true stays on
Both structures continue to be populated
System uses old structure until fix deployed
Step 3: Investigate & Fix

Debug in staging with new structure
Fix issues
Deploy to production
Step 4: Re-enable New Structure

Flip USE_OLD_STRUCTURE back to false
Resume validation period
Safety Net:

Dual-write preserves both structures for 30 days
Old collection (daily_entity_snapshots) kept as backup
Zero data loss — can always roll back
Post-Phase 1 State
What Changes:
✅ Meta data in dashbo_snapshots instead of daily_entity_snapshots
✅ MetaBrain wrapper around existing engines
✅ Prompts in Firestore, editable via Cerebro
✅ Client config supports multi-channel fields
What Stays Same:
✅ UI pages (read from same client_snapshots)
✅ Slack messages (same format, timing, channels)
✅ Cron schedule (same timing, same triggers)
✅ Alert logic (same rules, now in Firestore)
✅ DecisionEngine/AlertEngine/CreativeClassifier (unchanged)
Architecture Ready For:
Phase 2 (Ecommerce): Add EcommerceBrain, Blended ROAS calculation
Phase 3 (GA4): Add GA4Brain, landing page diagnostics
Phase 4 (Google + Master): Add GoogleBrain, Master Brain correlation
Phase 5 (Dashboard): Business Overview unified view
Key Interfaces Summary
ChannelBrain (Abstract Class)

export abstract class ChannelBrain {
  abstract analyze(
    clientId: string,
    dateRange: { start: string; end: string },
    clientConfig: ClientConfigV2
  ): Promise<ChannelSignals>;
}
ChannelSignals (Output)

export interface ChannelSignals {
  canal: 'META' | 'GOOGLE' | 'GA4' | 'ECOMMERCE';
  clientId: string;
  dateRange: { start: string; end: string };
  kpis: { costo?, ingresos?, roas?, cpa?, ... };
  alerts: ChannelAlert[];
  signals: Record<string, any>;  // For Master Brain
  dataQuality: { fieldsWithNull: string[]; confidence: 'HIGH' | 'MEDIUM' | 'LOW' };
}
BrainPrompt (Firestore Schema)

export interface BrainPrompt {
  brainId: 'META' | 'GOOGLE' | 'GA4' | 'ECOMMERCE' | 'MASTER';
  version: string;
  systemPrompt: string;
  analysisPrompt: string;
  alertRules: AlertRule[];
}
ClientConfigV2 (Extended Client)

export interface ClientConfigV2 extends Client {
  integraciones?: { meta, google, ga4, ecommerce, email };
  targets?: { cpa_meta, cpa_google, roas_meta, roas_google, blended_roas_target };
  crossChannelThresholds?: { attribution_discrepancy_pct, organic_drop_pct, bounce_spike_pct };
  timezone?: string;
}
Timeline: 4 Weeks
Week 1: Core infrastructure (interfaces, date utils, MetaBrain wrapper)
Week 2: Cache migration + brain prompts (parallel tracks)
Week 3: Orchestrator refactor + admin UI
Week 4: Testing + validation + deployment
Deliverable: Fully functional system with zero regression, ready for multi-channel expansion.

Success Metrics
Zero Regression: Slack digests identical to pre-Phase 1 ✅
Prompt Editing: Change alert rule → reflected without deploy ✅
Timezone Support: Clients in different timezones see correct date ranges ✅
Performance: <10% latency increase vs current system ✅
Data Integrity: 100% of historical data migrated ✅
Final Acceptance: Run for 1 week in production with no reported issues.