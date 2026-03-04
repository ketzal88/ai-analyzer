/**
 * test-alert-engine.ts
 *
 * Test script for AlertEngine.evaluate() — runs offline with mock data.
 * No real DB access needed (Firebase initializes with dummy creds but
 * evaluate() is pure computation, no DB calls).
 *
 * Usage:
 *   npx tsx scripts/test-alert-engine.ts
 *
 * Tests ALL 16 alert types + routing + deduplication + negative cases.
 */

// NOTE: Run with: npx tsx --require ./scripts/load-env.cjs scripts/test-alert-engine.ts
// This ensures .env.local is loaded BEFORE any imports (firebase-admin needs credentials at init).

import { AlertEngine, getAlertChannel, type AlertEvaluationInput } from "../src/lib/alert-engine";
import { getDefaultEngineConfig } from "../src/types/engine-config";
import type { EntityRollingMetrics, DailyEntitySnapshot } from "../src/types/performance-snapshots";
import type { EntityClassification } from "../src/types/classifications";
import type { Client, Alert } from "../src/types";

// ─── Test Helpers ───────────────────────────────────────────

const CLIENT_ID = "test_client";
const config = getDefaultEngineConfig(CLIENT_ID);

function makeRolling(overrides: Partial<EntityRollingMetrics> & { entityId: string }): EntityRollingMetrics {
    return {
        clientId: CLIENT_ID,
        entityId: overrides.entityId,
        level: overrides.level || "ad",
        name: overrides.name || `Ad ${overrides.entityId}`,
        rolling: {
            spend_7d: 100,
            impressions_7d: 5000,
            clicks_7d: 50,
            ctr_7d: 1.0,
            frequency_7d: 2.0,
            purchases_7d: 5,
            cpa_7d: 20,
            cpa_14d: 18,
            cpa_delta_pct: 0,
            roas_7d: 3.0,
            conversion_velocity_7d: 0.7,
            budget_change_3d_pct: 0,
            ...overrides.rolling,
        },
        lastUpdate: "2026-03-03",
    } as EntityRollingMetrics;
}

function makeSnap(entityId: string, overrides?: Partial<DailyEntitySnapshot>): DailyEntitySnapshot {
    return {
        clientId: CLIENT_ID,
        date: "2026-03-03",
        level: overrides?.level || "ad",
        entityId,
        name: `Ad ${entityId}`,
        meta: { objective: "OUTCOME_SALES", campaignId: "camp_1", adsetId: "adset_1", ...overrides?.meta },
        performance: { spend: 100, impressions: 5000, reach: 3000, clicks: 50, ctr: 1.0, cpc: 2.0, purchases: 5, ...overrides?.performance },
        engagement: overrides?.engagement || {},
        audience: overrides?.audience || {},
        stability: { daysActive: 10, daysSinceLastEdit: 5, ...overrides?.stability },
    } as DailyEntitySnapshot;
}

function makeClassif(entityId: string, overrides?: Partial<EntityClassification>): EntityClassification {
    return {
        clientId: CLIENT_ID,
        level: "ad",
        entityId,
        updatedAt: "2026-03-03",
        learningState: "EXPLOITATION",
        intentScore: 0.7,
        intentStage: "BOFU",
        fatigueState: "NONE",
        structuralState: "HEALTHY",
        finalDecision: "HOLD",
        evidence: ["Test evidence"],
        confidenceScore: 80,
        impactScore: 50,
        ...overrides,
    };
}

const clientData: Client = {
    id: CLIENT_ID,
    name: "Test Client",
    active: true,
    targetCpa: 25,
    targetRoas: 3.0,
    businessType: "ecommerce",
} as Client;

// ─── Test Runner ────────────────────────────────────────────

interface TestCase {
    name: string;
    expectedTypes: string[];
    input: AlertEvaluationInput;
    validate?: (alerts: Alert[]) => { ok: boolean; issues: string[] };
}

const tests: TestCase[] = [];

// ─── 1. SCALING_OPPORTUNITY ─────────────────────────────────
tests.push({
    name: "SCALING_OPPORTUNITY — CPA below target + stable velocity + low frequency",
    expectedTypes: ["SCALING_OPPORTUNITY"],
    input: {
        clientId: CLIENT_ID,
        rollingMetrics: [makeRolling({
            entityId: "ad_scale",
            rolling: {
                spend_7d: 200, purchases_7d: 15, cpa_7d: 13.3, roas_7d: 4.0,
                conversion_velocity_7d: 2.0, frequency_7d: 1.5, cpa_delta_pct: 0,
                budget_change_3d_pct: 0, impressions_7d: 10000, clicks_7d: 200, ctr_7d: 2.0,
            }
        })],
        classifications: [],
        dailySnapshots: [makeSnap("ad_scale", { stability: { daysActive: 14, daysSinceLastEdit: 7 } })],
        clientData,
        config,
    }
});

// ─── 2. LEARNING_RESET_RISK ─────────────────────────────────
tests.push({
    name: "LEARNING_RESET_RISK — Big budget change + recent edit on adset",
    expectedTypes: ["LEARNING_RESET_RISK"],
    input: {
        clientId: CLIENT_ID,
        rollingMetrics: [makeRolling({
            entityId: "adset_lr",
            level: "adset",
            name: "Adset Learning Reset",
            rolling: {
                spend_7d: 150, budget_change_3d_pct: 45, purchases_7d: 3,
                cpa_delta_pct: 0, impressions_7d: 5000, clicks_7d: 50, ctr_7d: 1.0,
                frequency_7d: 2.0,
            }
        })],
        classifications: [],
        dailySnapshots: [makeSnap("adset_lr", {
            level: "adset",
            stability: { daysActive: 10, daysSinceLastEdit: 1 },
        })],
        clientData,
        config,
    }
});

// ─── 3. CPA_SPIKE ──────────────────────────────────────────
tests.push({
    name: "CPA_SPIKE — CPA delta > 25% (cpaSpikeThreshold)",
    expectedTypes: ["CPA_SPIKE"],
    input: {
        clientId: CLIENT_ID,
        rollingMetrics: [makeRolling({
            entityId: "ad_cpaspike",
            rolling: {
                spend_7d: 200, purchases_7d: 2, cpa_7d: 100, cpa_14d: 30,
                cpa_delta_pct: 60, frequency_7d: 2.0, budget_change_3d_pct: 0,
                impressions_7d: 8000, clicks_7d: 80, ctr_7d: 1.0,
            }
        })],
        classifications: [],
        dailySnapshots: [makeSnap("ad_cpaspike")],
        clientData,
        config,
    }
});

// ─── 4. BUDGET_BLEED ───────────────────────────────────────
tests.push({
    name: "BUDGET_BLEED — 0 conversions + spend > 2x targetCPA",
    expectedTypes: ["BUDGET_BLEED"],
    input: {
        clientId: CLIENT_ID,
        rollingMetrics: [makeRolling({
            entityId: "ad_bleed",
            rolling: {
                spend_7d: 80, purchases_7d: 0, leads_7d: 0, whatsapp_7d: 0, schedule_7d: 0, installs_7d: 0,
                cpa_delta_pct: 0, frequency_7d: 2.0, budget_change_3d_pct: 0,
                impressions_7d: 6000, clicks_7d: 40, ctr_7d: 0.67,
            }
        })],
        classifications: [],
        dailySnapshots: [makeSnap("ad_bleed")],
        clientData, // targetCpa = 25, so 2x = 50, spend 80 > 50
        config,
    }
});

// ─── 5. CPA_VOLATILITY ─────────────────────────────────────
tests.push({
    name: "CPA_VOLATILITY — Budget change > 50% (volatilityThreshold)",
    expectedTypes: ["CPA_VOLATILITY"],
    input: {
        clientId: CLIENT_ID,
        rollingMetrics: [makeRolling({
            entityId: "ad_volatile",
            rolling: {
                spend_7d: 100, purchases_7d: 5, budget_change_3d_pct: 65,
                cpa_delta_pct: 0, frequency_7d: 2.0,
                impressions_7d: 5000, clicks_7d: 50, ctr_7d: 1.0,
            }
        })],
        classifications: [],
        dailySnapshots: [makeSnap("ad_volatile")],
        clientData,
        config,
    }
});

// ─── 6. HOOK_KILL (Video) ───────────────────────────────────
tests.push({
    name: "HOOK_KILL — Video with hook rate < 20% + spend > $50",
    expectedTypes: ["HOOK_KILL"],
    input: {
        clientId: CLIENT_ID,
        rollingMetrics: [makeRolling({
            entityId: "ad_hookkill",
            rolling: {
                spend_7d: 120, video_views_7d: 500, hook_rate_7d: 12, hold_rate_7d: 40,
                purchases_7d: 1, cpa_delta_pct: 0, frequency_7d: 2.0, budget_change_3d_pct: 0,
                impressions_7d: 8000, clicks_7d: 30, ctr_7d: 0.38,
            }
        })],
        classifications: [],
        dailySnapshots: [makeSnap("ad_hookkill")],
        clientData,
        config,
    }
});

// ─── 7. BODY_WEAK (Video) ──────────────────────────────────
tests.push({
    name: "BODY_WEAK — Hook > 25% but hold < 30%",
    expectedTypes: ["BODY_WEAK"],
    input: {
        clientId: CLIENT_ID,
        rollingMetrics: [makeRolling({
            entityId: "ad_bodyweak",
            rolling: {
                spend_7d: 100, video_views_7d: 800, hook_rate_7d: 35, hold_rate_7d: 18,
                purchases_7d: 3, cpa_delta_pct: 0, frequency_7d: 2.0, budget_change_3d_pct: 0,
                impressions_7d: 6000, clicks_7d: 60, ctr_7d: 1.0,
            }
        })],
        classifications: [],
        dailySnapshots: [makeSnap("ad_bodyweak")],
        clientData,
        config,
    }
});

// ─── 8. CTA_WEAK (Video) ───────────────────────────────────
tests.push({
    name: "CTA_WEAK — Hook + Hold OK but CTR < 0.8%",
    expectedTypes: ["CTA_WEAK"],
    input: {
        clientId: CLIENT_ID,
        rollingMetrics: [makeRolling({
            entityId: "ad_ctaweak",
            rolling: {
                spend_7d: 100, video_views_7d: 1000, hook_rate_7d: 40, hold_rate_7d: 45,
                ctr_7d: 0.5, // below 0.8%
                purchases_7d: 3, cpa_delta_pct: 0, frequency_7d: 2.0, budget_change_3d_pct: 0,
                impressions_7d: 10000, clicks_7d: 50,
            }
        })],
        classifications: [],
        dailySnapshots: [makeSnap("ad_ctaweak")],
        clientData,
        config,
    }
});

// ─── 9. VIDEO_DROPOFF ──────────────────────────────────────
tests.push({
    name: "VIDEO_DROPOFF — Drop-off point detected at p50",
    expectedTypes: ["VIDEO_DROPOFF"],
    input: {
        clientId: CLIENT_ID,
        rollingMetrics: [makeRolling({
            entityId: "ad_dropoff",
            rolling: {
                spend_7d: 80, video_views_7d: 600, hook_rate_7d: 45, hold_rate_7d: 50,
                drop_off_point: "p50", completion_rate_7d: 15,
                ctr_7d: 1.2, purchases_7d: 2, cpa_delta_pct: 0, frequency_7d: 1.5, budget_change_3d_pct: 0,
                impressions_7d: 5000, clicks_7d: 60,
            }
        })],
        classifications: [],
        dailySnapshots: [makeSnap("ad_dropoff")],
        clientData,
        config,
    }
});

// ─── 10. IMAGE_INVISIBLE ───────────────────────────────────
tests.push({
    name: "IMAGE_INVISIBLE — CTR < 0.5% + impressions > 2000 (non-video)",
    expectedTypes: ["IMAGE_INVISIBLE"],
    input: {
        clientId: CLIENT_ID,
        rollingMetrics: [makeRolling({
            entityId: "ad_imginvis",
            rolling: {
                spend_7d: 60, video_views_7d: 0, hook_rate_7d: 0, // no video signals
                ctr_7d: 0.3, impressions_7d: 5000,
                purchases_7d: 1, cpa_delta_pct: 0, frequency_7d: 2.0, budget_change_3d_pct: 0,
                clicks_7d: 15,
            }
        })],
        classifications: [],
        dailySnapshots: [makeSnap("ad_imginvis")],
        clientData,
        config,
    }
});

// ─── 11. IMAGE_NO_CONVERT ──────────────────────────────────
tests.push({
    name: "IMAGE_NO_CONVERT — Good CTR (>1.5%) but CPA > 2x target",
    expectedTypes: ["IMAGE_NO_CONVERT"],
    input: {
        clientId: CLIENT_ID,
        rollingMetrics: [makeRolling({
            entityId: "ad_imgnoconv",
            rolling: {
                spend_7d: 200, video_views_7d: 0, hook_rate_7d: 0,
                ctr_7d: 2.5, impressions_7d: 8000, clicks_7d: 200,
                purchases_7d: 2, // CPA = 200/2 = 100, target = 25, 100 > 25*2 = 50
                cpa_delta_pct: 0, frequency_7d: 2.0, budget_change_3d_pct: 0,
            }
        })],
        classifications: [],
        dailySnapshots: [makeSnap("ad_imgnoconv")],
        clientData,
        config,
    }
});

// ─── 12. ROTATE_CONCEPT ────────────────────────────────────
tests.push({
    name: "ROTATE_CONCEPT — Classification shows REAL fatigue",
    expectedTypes: ["ROTATE_CONCEPT"],
    input: {
        clientId: CLIENT_ID,
        rollingMetrics: [makeRolling({
            entityId: "ad_fatigue",
            rolling: {
                spend_7d: 150, purchases_7d: 3, hook_rate_7d: 15, frequency_7d: 5.0,
                cpa_delta_pct: 0, budget_change_3d_pct: 0, impressions_7d: 7000, clicks_7d: 70, ctr_7d: 1.0,
            }
        })],
        classifications: [makeClassif("ad_fatigue", { fatigueState: "REAL", impactScore: 70, evidence: ["Frequency 5.0", "CTR dropping"] })],
        dailySnapshots: [makeSnap("ad_fatigue")],
        clientData,
        config,
    }
});

// ─── 13. CONSOLIDATE ───────────────────────────────────────
tests.push({
    name: "CONSOLIDATE — Classification shows FRAGMENTED structure",
    expectedTypes: ["CONSOLIDATE"],
    input: {
        clientId: CLIENT_ID,
        rollingMetrics: [makeRolling({
            entityId: "adset_frag",
            level: "adset",
            rolling: {
                spend_7d: 200, purchases_7d: 5, cpa_delta_pct: 0, frequency_7d: 2.0,
                budget_change_3d_pct: 0, impressions_7d: 8000, clicks_7d: 80, ctr_7d: 1.0,
            }
        })],
        classifications: [makeClassif("adset_frag", { level: "adset", structuralState: "FRAGMENTED", impactScore: 60, evidence: ["8 adsets activos"] })],
        dailySnapshots: [makeSnap("adset_frag", { level: "adset" })],
        clientData,
        config,
    }
});

// ─── 14. KILL_RETRY ────────────────────────────────────────
tests.push({
    name: "KILL_RETRY — Classification decision is KILL_RETRY",
    expectedTypes: ["KILL_RETRY"],
    input: {
        clientId: CLIENT_ID,
        rollingMetrics: [makeRolling({
            entityId: "ad_kill",
            rolling: {
                spend_7d: 80, purchases_7d: 0, cpa_delta_pct: 0, frequency_7d: 3.0,
                budget_change_3d_pct: 0, impressions_7d: 4000, clicks_7d: 20, ctr_7d: 0.5,
            }
        })],
        classifications: [makeClassif("ad_kill", { finalDecision: "KILL_RETRY", impactScore: 40, evidence: ["0 conversions", "High spend"] })],
        dailySnapshots: [makeSnap("ad_kill")],
        clientData,
        config,
    }
});

// ─── 15. INTRODUCE_BOFU_VARIANTS ───────────────────────────
tests.push({
    name: "INTRODUCE_BOFU_VARIANTS — Classification decision is INTRODUCE_BOFU_VARIANTS",
    expectedTypes: ["INTRODUCE_BOFU_VARIANTS"],
    input: {
        clientId: CLIENT_ID,
        rollingMetrics: [makeRolling({
            entityId: "ad_bofu",
            rolling: {
                spend_7d: 300, purchases_7d: 20, cpa_7d: 15, roas_7d: 5.0,
                cpa_delta_pct: 0, frequency_7d: 1.8, budget_change_3d_pct: 0,
                impressions_7d: 15000, clicks_7d: 300, ctr_7d: 2.0,
                conversion_velocity_7d: 2.8,
            }
        })],
        classifications: [makeClassif("ad_bofu", { finalDecision: "INTRODUCE_BOFU_VARIANTS", intentStage: "BOFU", impactScore: 65 })],
        dailySnapshots: [makeSnap("ad_bofu", { stability: { daysActive: 20, daysSinceLastEdit: 10 } })],
        clientData,
        config,
    }
});

// ─── 16. CREATIVE_MIX_IMBALANCE ────────────────────────────
tests.push({
    name: "CREATIVE_MIX_IMBALANCE — 6 image ads, 0 video ads (low diversity)",
    expectedTypes: ["CREATIVE_MIX_IMBALANCE"],
    input: {
        clientId: CLIENT_ID,
        rollingMetrics: [
            ...Array.from({ length: 6 }, (_, i) => makeRolling({
                entityId: `ad_img_${i}`,
                rolling: {
                    spend_7d: 50, video_views_7d: 0, hook_rate_7d: 0,
                    purchases_7d: 2, cpa_delta_pct: 0, frequency_7d: 2.0,
                    budget_change_3d_pct: 0, impressions_7d: 3000, clicks_7d: 30, ctr_7d: 1.0,
                }
            })),
        ],
        classifications: [],
        dailySnapshots: Array.from({ length: 6 }, (_, i) => makeSnap(`ad_img_${i}`)),
        clientData,
        config,
    }
});

// ─── ROUTING TEST ──────────────────────────────────────────
tests.push({
    name: "ROUTING — Verify channel assignment (immediate/weekly/panel)",
    expectedTypes: ["CPA_SPIKE", "BODY_WEAK", "VIDEO_DROPOFF", "SCALING_OPPORTUNITY"],
    input: {
        clientId: CLIENT_ID,
        rollingMetrics: [
            // CRITICAL → slack_immediate
            makeRolling({ entityId: "ad_r1", rolling: { spend_7d: 200, purchases_7d: 2, cpa_delta_pct: 60, frequency_7d: 2.0, budget_change_3d_pct: 0, impressions_7d: 8000, clicks_7d: 80, ctr_7d: 1.0, cpa_7d: 100, cpa_14d: 30 } }),
            // WARNING → slack_weekly
            makeRolling({ entityId: "ad_r2", rolling: { spend_7d: 100, video_views_7d: 500, hook_rate_7d: 35, hold_rate_7d: 18, purchases_7d: 3, cpa_delta_pct: 0, frequency_7d: 2.0, budget_change_3d_pct: 0, impressions_7d: 6000, clicks_7d: 60, ctr_7d: 1.0 } }),
            // INFO → panel_only
            makeRolling({ entityId: "ad_r3", rolling: { spend_7d: 80, video_views_7d: 600, hook_rate_7d: 45, hold_rate_7d: 50, drop_off_point: "p50", completion_rate_7d: 15, ctr_7d: 1.2, purchases_7d: 2, cpa_delta_pct: 0, frequency_7d: 1.5, budget_change_3d_pct: 0, impressions_7d: 5000, clicks_7d: 60 } }),
            // SCALING_OPPORTUNITY (INFO but → slack_immediate)
            makeRolling({ entityId: "ad_r4", rolling: { spend_7d: 200, purchases_7d: 15, cpa_7d: 13.3, roas_7d: 4.0, conversion_velocity_7d: 2.0, frequency_7d: 1.5, cpa_delta_pct: 0, budget_change_3d_pct: 0, impressions_7d: 10000, clicks_7d: 200, ctr_7d: 2.0 } }),
        ],
        classifications: [],
        dailySnapshots: [
            makeSnap("ad_r1"),
            makeSnap("ad_r2"),
            makeSnap("ad_r3"),
            makeSnap("ad_r4", { stability: { daysActive: 14, daysSinceLastEdit: 7 } }),
        ],
        clientData,
        config,
    },
    validate(alerts) {
        const issues: string[] = [];
        for (const alert of alerts) {
            const channel = getAlertChannel(alert);
            if (alert.severity === "CRITICAL" && channel !== "slack_immediate") {
                issues.push(`${alert.type} (CRITICAL) should route to slack_immediate, got ${channel}`);
            }
            if (alert.type === "SCALING_OPPORTUNITY" && channel !== "slack_immediate") {
                issues.push(`SCALING_OPPORTUNITY should route to slack_immediate, got ${channel}`);
            }
            if (alert.severity === "WARNING" && alert.type !== "SCALING_OPPORTUNITY" && channel !== "slack_weekly") {
                issues.push(`${alert.type} (WARNING) should route to slack_weekly, got ${channel}`);
            }
            if (alert.severity === "INFO" && alert.type !== "SCALING_OPPORTUNITY" && channel !== "panel_only") {
                issues.push(`${alert.type} (INFO) should route to panel_only, got ${channel}`);
            }
        }
        return { ok: issues.length === 0, issues };
    }
});

// ─── NEGATIVE: Video alerts should NOT fire on image ads ────
tests.push({
    name: "NEGATIVE — Video alerts should NOT fire on image-only ads",
    expectedTypes: [],
    input: {
        clientId: CLIENT_ID,
        rollingMetrics: [makeRolling({
            entityId: "ad_image_only",
            rolling: {
                spend_7d: 100, video_views_7d: 0, hook_rate_7d: 0,
                purchases_7d: 5, cpa_delta_pct: 0, frequency_7d: 2.0, budget_change_3d_pct: 0,
                impressions_7d: 5000, clicks_7d: 50, ctr_7d: 1.0,
            }
        })],
        classifications: [],
        dailySnapshots: [makeSnap("ad_image_only")],
        clientData,
        config,
    },
    validate(alerts) {
        const VIDEO_TYPES = ["HOOK_KILL", "BODY_WEAK", "CTA_WEAK", "VIDEO_DROPOFF"];
        const videoAlerts = alerts.filter(a => VIDEO_TYPES.includes(a.type));
        if (videoAlerts.length > 0) {
            return { ok: false, issues: [`Expected 0 video alerts on image ad, got: ${videoAlerts.map(a => a.type).join(", ")}`] };
        }
        return { ok: true, issues: [] };
    }
});

// ─── DEDUP: ad > adset priority ────────────────────────────
tests.push({
    name: "DEDUP — Same alert type on ad + adset → keep ad level only",
    expectedTypes: ["BUDGET_BLEED"],
    input: {
        clientId: CLIENT_ID,
        rollingMetrics: [
            makeRolling({ entityId: "ad_dup1", level: "ad", rolling: { spend_7d: 80, purchases_7d: 0, leads_7d: 0, whatsapp_7d: 0, schedule_7d: 0, installs_7d: 0, cpa_delta_pct: 0, frequency_7d: 2.0, budget_change_3d_pct: 0, impressions_7d: 6000, clicks_7d: 40, ctr_7d: 0.67 } }),
            makeRolling({ entityId: "adset_dup1", level: "adset", rolling: { spend_7d: 80, purchases_7d: 0, leads_7d: 0, whatsapp_7d: 0, schedule_7d: 0, installs_7d: 0, cpa_delta_pct: 0, frequency_7d: 2.0, budget_change_3d_pct: 0, impressions_7d: 6000, clicks_7d: 40, ctr_7d: 0.67 } }),
        ],
        classifications: [],
        dailySnapshots: [
            makeSnap("ad_dup1", { meta: { adsetId: "adset_dup1", campaignId: "camp_1" } }),
            makeSnap("adset_dup1", { level: "adset", meta: { campaignId: "camp_1" } }),
        ],
        clientData,
        config,
    },
    validate(alerts) {
        const bleed = alerts.filter(a => a.type === "BUDGET_BLEED");
        if (bleed.length !== 1) {
            return { ok: false, issues: [`Expected 1 BUDGET_BLEED after dedup, got ${bleed.length}`] };
        }
        if (bleed[0].level !== "ad") {
            return { ok: false, issues: [`Expected ad level, got ${bleed[0].level}`] };
        }
        return { ok: true, issues: [] };
    }
});

// ─── SEVERITY CHECK ────────────────────────────────────────
tests.push({
    name: "SEVERITY — Verify correct severity per alert type",
    expectedTypes: ["HOOK_KILL", "BODY_WEAK", "IMAGE_INVISIBLE", "VIDEO_DROPOFF"],
    input: {
        clientId: CLIENT_ID,
        rollingMetrics: [
            // HOOK_KILL → CRITICAL
            makeRolling({ entityId: "sev_1", rolling: { spend_7d: 120, video_views_7d: 500, hook_rate_7d: 12, hold_rate_7d: 40, purchases_7d: 1, cpa_delta_pct: 0, frequency_7d: 2.0, budget_change_3d_pct: 0, impressions_7d: 8000, clicks_7d: 30, ctr_7d: 0.38 } }),
            // BODY_WEAK → WARNING
            makeRolling({ entityId: "sev_2", rolling: { spend_7d: 100, video_views_7d: 800, hook_rate_7d: 35, hold_rate_7d: 18, purchases_7d: 3, cpa_delta_pct: 0, frequency_7d: 2.0, budget_change_3d_pct: 0, impressions_7d: 6000, clicks_7d: 60, ctr_7d: 1.0 } }),
            // IMAGE_INVISIBLE → WARNING
            makeRolling({ entityId: "sev_3", rolling: { spend_7d: 60, video_views_7d: 0, hook_rate_7d: 0, ctr_7d: 0.3, impressions_7d: 5000, purchases_7d: 1, cpa_delta_pct: 0, frequency_7d: 2.0, budget_change_3d_pct: 0, clicks_7d: 15 } }),
            // VIDEO_DROPOFF → INFO
            makeRolling({ entityId: "sev_4", rolling: { spend_7d: 80, video_views_7d: 600, hook_rate_7d: 45, hold_rate_7d: 50, drop_off_point: "p50", completion_rate_7d: 15, ctr_7d: 1.2, purchases_7d: 2, cpa_delta_pct: 0, frequency_7d: 1.5, budget_change_3d_pct: 0, impressions_7d: 5000, clicks_7d: 60 } }),
        ],
        classifications: [],
        dailySnapshots: [makeSnap("sev_1"), makeSnap("sev_2"), makeSnap("sev_3"), makeSnap("sev_4")],
        clientData,
        config,
    },
    validate(alerts) {
        const issues: string[] = [];
        const expected: Record<string, string> = {
            HOOK_KILL: "CRITICAL",
            BODY_WEAK: "WARNING",
            IMAGE_INVISIBLE: "WARNING",
            VIDEO_DROPOFF: "INFO",
        };
        for (const [type, sev] of Object.entries(expected)) {
            const a = alerts.find(x => x.type === type);
            if (!a) { issues.push(`${type} not found`); continue; }
            if (a.severity !== sev) { issues.push(`${type} should be ${sev}, got ${a.severity}`); }
        }
        return { ok: issues.length === 0, issues };
    }
});

// ─── Run All Tests ──────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

console.log("\n" + "=".repeat(70));
console.log(" AlertEngine.evaluate() — Unit Tests");
console.log("=".repeat(70) + "\n");

for (const test of tests) {
    const alerts = AlertEngine.evaluate(test.input);
    const alertTypes = alerts.map(a => a.type);

    let ok = true;
    const issues: string[] = [];

    // Check expected types are present
    for (const expected of test.expectedTypes) {
        if (!alertTypes.includes(expected)) {
            ok = false;
            issues.push(`Expected "${expected}" not found. Got: [${alertTypes.join(", ")}]`);
        }
    }

    // Run custom validation if provided
    if (test.validate) {
        const result = test.validate(alerts);
        if (!result.ok) {
            ok = false;
            issues.push(...result.issues);
        }
    }

    if (ok) {
        console.log(`  PASS  ${test.name}`);
        passed++;
    } else {
        console.log(`  FAIL  ${test.name}`);
        for (const issue of issues) {
            console.log(`         -> ${issue}`);
        }
        failed++;
        failures.push(test.name);
    }

    // Print alert details
    for (const a of alerts) {
        const channel = getAlertChannel(a);
        console.log(`         [${a.severity.padEnd(8)}] ${a.type.padEnd(28)} -> ${channel.padEnd(16)} | ${a.title.substring(0, 60)}`);
    }
    console.log();
}

// ─── Summary ────────────────────────────────────────────────
console.log("=".repeat(70));
if (failed === 0) {
    console.log(` ALL ${passed} TESTS PASSED`);
} else {
    console.log(` ${passed} passed, ${failed} FAILED (of ${tests.length} total)`);
    console.log(` Failures:`);
    for (const f of failures) console.log(`   - ${f}`);
}
console.log("=".repeat(70) + "\n");

process.exit(failed > 0 ? 1 : 0);
