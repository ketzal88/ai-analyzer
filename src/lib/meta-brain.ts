/**
 * MetaBrain — Worker Brain V2 Phase 1
 *
 * Wrapper around existing DecisionEngine, AlertEngine, and CreativeClassifier that
 * implements the ChannelBrain interface.
 *
 * Architecture Decision (Phase 1):
 * This is a THIN FACADE, not a rewrite. It delegates to existing engines to ensure
 * zero breaking changes. The heavy lifting stays in:
 * - DecisionEngine: 5-layer classification
 * - AlertEngine: 10+ alert types
 * - CreativeClassifier: 6 creative categories
 * - PerformanceService: Rolling metric computation
 *
 * What MetaBrain adds:
 * 1. Reads from new dashbo_snapshots structure (with fallback to old structure)
 * 2. Maps outputs to standardized ChannelSignals interface
 * 3. Prepares signals for future Master Brain correlation
 *
 * Future Phases:
 * - Phase 2-4: Add GoogleBrain, GA4Brain, EcommerceBrain as siblings
 * - Phase 4: Master Brain reads ChannelSignals from all brains and correlates
 */

import { db } from "@/lib/firebase-admin";
import { ChannelBrain, ChannelSignals, ChannelAlert, ClientConfigV2 } from "./channel-brain-interface";
import { Alert, Client } from "@/types";
import { DailyEntitySnapshot, EntityRollingMetrics } from "@/types/performance-snapshots";
import { EntityClassification } from "@/types/classifications";
import { PerformanceService } from "./performance-service";

/**
 * MetaBrain: Analyzes Meta Ads (Facebook/Instagram) performance
 *
 * Wraps existing Meta-specific engines without changing their logic.
 */
export class MetaBrain extends ChannelBrain {
  /**
   * Analyze Meta Ads for a client
   *
   * @param clientId - Client to analyze
   * @param dateRange - Date range (YYYY-MM-DD)
   * @param clientConfig - Client configuration
   * @returns ChannelSignals for Meta channel
   */
  async analyze(
    clientId: string,
    dateRange: { start: string; end: string },
    clientConfig: ClientConfigV2
  ): Promise<ChannelSignals> {
    // 1. Read Meta snapshot from new structure (with fallback)
    const snapshots = await this.readSnapshot(clientId, dateRange);

    if (snapshots.length === 0) {
      // No data available - return empty signals
      return this.buildEmptySignals(clientId, dateRange);
    }

    // 2. Compute rolling metrics (delegates to existing PerformanceService logic)
    const rolling = this.computeRollingMetrics(snapshots, dateRange);

    // 3. Read classifications and alerts from Firestore
    // Note: In Phase 1, these are still written by ClientSnapshotService.
    // MetaBrain reads them to map to ChannelSignals format.
    const [classifications, alerts] = await Promise.all([
      this.readClassifications(clientId),
      this.readAlerts(clientId)
    ]);

    // 4. Extract KPIs
    const kpis = this.extractKPIs(rolling);

    // 5. Map alerts to ChannelAlert format
    const channelAlerts = this.mapAlerts(alerts);

    // 6. Extract signals for Master Brain
    const signals = this.extractSignals(rolling, classifications);

    // 7. Assess data quality
    const dataQuality = {
      fieldsWithNull: this.detectNullFields(rolling),
      confidence: 'HIGH' as const  // Meta data is always high confidence
    };

    return {
      canal: 'META',
      clientId,
      dateRange,
      kpis,
      alerts: channelAlerts,
      signals,
      dataQuality
    };
  }

  /**
   * Read Meta snapshots from dashbo_snapshots (with fallback)
   *
   * Phase 1 Strategy:
   * - Try reading from dashbo_snapshots/{clientId}/{date}/meta (new structure)
   * - Fallback to daily_entity_snapshots (old structure) if new doesn't exist
   * - This dual-read ensures zero downtime during migration
   */
  protected async readSnapshot(
    clientId: string,
    dateRange: { start: string; end: string }
  ): Promise<DailyEntitySnapshot[]> {
    // Try new structure first
    const newData = await this.readFromDashboSnapshots(clientId, dateRange);
    if (newData.length > 0) {
      return newData;
    }

    // Fallback to old structure
    console.log(`[MetaBrain] dashbo_snapshots not found for ${clientId}, falling back to daily_entity_snapshots`);
    return await this.readFromLegacyStructure(clientId, dateRange);
  }

  /**
   * Read from new dashbo_snapshots structure
   */
  private async readFromDashboSnapshots(
    clientId: string,
    dateRange: { start: string; end: string }
  ): Promise<DailyEntitySnapshot[]> {
    const allSnapshots: DailyEntitySnapshot[] = [];

    // Read all dates in range
    const dates = this.getDatesBetween(dateRange.start, dateRange.end);

    for (const date of dates) {
      const docRef = db.doc(`dashbo_snapshots/${clientId}/${date}/meta`);
      const doc = await docRef.get();

      if (doc.exists) {
        const data = doc.data();
        // Structure: { account: [...], campaign: [...], adset: [...], ad: [...] }
        if (data) {
          allSnapshots.push(
            ...(data.account || []),
            ...(data.campaign || []),
            ...(data.adset || []),
            ...(data.ad || [])
          );
        }
      }
    }

    return allSnapshots;
  }

  /**
   * Read from legacy daily_entity_snapshots structure
   */
  private async readFromLegacyStructure(
    clientId: string,
    dateRange: { start: string; end: string }
  ): Promise<DailyEntitySnapshot[]> {
    const snapshot = await db.collection("daily_entity_snapshots")
      .where("clientId", "==", clientId)
      .where("date", ">=", dateRange.start)
      .where("date", "<=", dateRange.end)
      .get();

    return snapshot.docs.map(d => d.data() as DailyEntitySnapshot);
  }

  /**
   * Helper: Get array of dates between start and end (YYYY-MM-DD)
   */
  private getDatesBetween(start: string, end: string): string[] {
    const dates: string[] = [];
    const current = new Date(start);
    const endDate = new Date(end);

    while (current <= endDate) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  /**
   * Compute rolling metrics from snapshots
   *
   * Delegates to PerformanceService.computeRollingForEntity() logic.
   * This is the same computation used by ClientSnapshotService.
   */
  private computeRollingMetrics(
    snapshots: DailyEntitySnapshot[],
    dateRange: { start: string; end: string }
  ): EntityRollingMetrics[] {
    // Group by entity
    const entityGroups: Record<string, DailyEntitySnapshot[]> = {};
    for (const snap of snapshots) {
      const key = `${snap.entityId}__${snap.level}`;
      if (!entityGroups[key]) entityGroups[key] = [];
      entityGroups[key].push(snap);
    }

    // Compute rolling for each entity
    const rolling: EntityRollingMetrics[] = [];
    const refDate = new Date(dateRange.end);

    for (const [key, group] of Object.entries(entityGroups)) {
      const [entityId, level] = key.split("__");

      // Delegate to PerformanceService (existing logic)
      const rollingData = PerformanceService.computeRollingForEntity(
        group,
        entityId,
        level as any,
        refDate,
        {},  // adEntitySpends7d (computed separately in full orchestration)
        0,   // totalAdSpend7d
        0,   // globalSpendTop1Pct
        0    // globalSpendTop3Pct
      );

      // Build complete EntityRollingMetrics object
      rolling.push({
        clientId: snapshots[0]?.clientId || '',
        entityId,
        level: level as any,
        rolling: rollingData,
        updatedAt: new Date().toISOString()
      });
    }

    return rolling;
  }

  /**
   * Read classifications from Firestore
   *
   * Phase 1 Note: Classifications are still written by ClientSnapshotService.
   * MetaBrain just reads them to include in ChannelSignals.
   */
  private async readClassifications(clientId: string): Promise<EntityClassification[]> {
    const snapshot = await db.collection("entity_classifications")
      .where("clientId", "==", clientId)
      .get();

    return snapshot.docs.map(d => d.data() as EntityClassification);
  }

  /**
   * Read alerts from Firestore
   *
   * Phase 1 Note: Alerts are still written by AlertEngine.
   * MetaBrain just reads them to map to ChannelAlert format.
   */
  private async readAlerts(clientId: string): Promise<Alert[]> {
    const snapshot = await db.collection("alerts")
      .where("clientId", "==", clientId)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    return snapshot.docs.map(d => d.data() as Alert);
  }

  /**
   * Extract normalized KPIs from rolling metrics
   */
  protected extractKPIs(rolling: EntityRollingMetrics[]): ChannelSignals['kpis'] {
    // Aggregate account-level metrics
    const accountRolling = rolling.find(r => r.level === 'account');

    if (!accountRolling) {
      return {};
    }

    const r = accountRolling.rolling;

    return {
      costo: r.spend_7d,
      ingresos: r.purchase_value_7d,
      roas: r.roas_7d,
      cpa: r.cpa_7d,
      conversiones: r.purchases_7d || r.leads_7d || r.whatsapp_7d || r.installs_7d || 0,
      clicks: r.link_clicks_7d,
      impresiones: r.impressions_7d,
      ctr: r.ctr_7d
    };
  }

  /**
   * Map system alerts to ChannelAlert format
   */
  private mapAlerts(alerts: Alert[]): ChannelAlert[] {
    return alerts.map(alert => ({
      type: alert.type,
      severity: alert.severity as 'CRITICAL' | 'WARNING' | 'INFO',
      message: alert.title,
      recommendation: alert.description,
      data: {
        entityId: alert.entityId,
        entityName: alert.entityName,
        level: alert.level,
        evidence: alert.evidence,
        impactScore: alert.impactScore
      }
    }));
  }

  /**
   * Extract signals for Master Brain consumption
   *
   * These are Meta-specific signals that the Master Brain will use for
   * cross-channel correlation in Phase 4.
   */
  protected extractSignals(
    rolling: EntityRollingMetrics[],
    classifications: EntityClassification[]
  ): Record<string, any> {
    const accountRolling = rolling.find(r => r.level === 'account');
    const r = accountRolling?.rolling || {};

    // Check for bleeding campaigns (campaigns spending without converting)
    const hasBleeding = classifications.some(
      c => c.level === 'campaign' && c.finalDecision === 'KILL_RETRY'
    );

    // Check for scaling opportunities
    const hasScaling = classifications.some(
      c => c.finalDecision === 'SCALE'
    );

    // Find top performing ad
    const adRollings = rolling.filter(r => r.level === 'ad');
    const topAd = adRollings.sort((a, b) =>
      (b.rolling.spend_7d || 0) - (a.rolling.spend_7d || 0)
    )[0];

    return {
      meta_roas: r.roas_7d,
      meta_cpa: r.cpa_7d,
      meta_frecuencia_promedio: r.frequency_7d,
      meta_pixel_purchases: r.purchases_7d,
      meta_valor_compra: r.purchase_value_7d,
      meta_budget_pace: 0,  // Placeholder — requires BU data from Dashbo (Phase 2)
      meta_has_bleeding_campaigns: hasBleeding,
      meta_has_scaling_opportunities: hasScaling,
      meta_top_ad_id: topAd?.entityId || null,
      meta_top_ad_roas: topAd?.rolling.roas_7d || null
    };
  }

  /**
   * Detect which fields are null (indicates missing tracking)
   */
  private detectNullFields(rolling: EntityRollingMetrics[]): string[] {
    const accountRolling = rolling.find(r => r.level === 'account');
    if (!accountRolling) return [];

    const nullFields: string[] = [];
    const r = accountRolling.rolling;

    // Check critical fields
    if (!r.purchases_7d && !r.leads_7d && !r.whatsapp_7d && !r.installs_7d) {
      nullFields.push('conversions');
    }
    if (!r.purchase_value_7d) nullFields.push('purchase_value');
    if (!r.frequency_7d) nullFields.push('frequency');
    if (!r.hook_rate_7d) nullFields.push('hook_rate');

    return nullFields;
  }

  /**
   * Build empty signals when no data available
   */
  private buildEmptySignals(clientId: string, dateRange: { start: string; end: string }): ChannelSignals {
    return {
      canal: 'META',
      clientId,
      dateRange,
      kpis: {},
      alerts: [],
      signals: {},
      dataQuality: {
        fieldsWithNull: [],
        confidence: 'LOW',
        notes: 'No data available for date range'
      }
    };
  }

  /**
   * Placeholder for Phase 2+: Alert evaluation will move here
   *
   * In Phase 1, alerts are still generated by AlertEngine and read from Firestore.
   * In Phase 2+, alert evaluation will use brain_prompts/meta from Firestore.
   */
  protected async evaluateAlerts(data: any, clientConfig: Client): Promise<ChannelAlert[]> {
    // Phase 1: Delegate to existing AlertEngine (via readAlerts)
    // Phase 2+: Implement alert rule evaluation from brain_prompts/meta
    return [];
  }
}
