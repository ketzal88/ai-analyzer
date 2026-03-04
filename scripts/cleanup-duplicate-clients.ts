/**
 * cleanup-duplicate-clients.ts
 *
 * Finds duplicate clients by name, MERGES all fields into the best copy
 * (keeping the most complete value for each field), then deletes the extras.
 *
 * Usage:
 *   npx tsx --require ./scripts/load-env.cjs scripts/cleanup-duplicate-clients.ts --dry-run
 *   npx tsx --require ./scripts/load-env.cjs scripts/cleanup-duplicate-clients.ts
 */

import { db } from "../src/lib/firebase-admin";

const DRY_RUN = process.argv.includes("--dry-run");

// Fields we want to merge (non-system fields)
const MERGEABLE_FIELDS = [
    "metaAdAccountId", "googleAdsId", "slackPublicChannel", "slackInternalChannel",
    "businessType", "businessModel", "description",
    "targetCpa", "targetRoas", "targetSalesVolume", "averageTicket", "grossMarginPct",
    "primaryGoal", "growthMode", "ltv", "funnelPriority", "seasonalityNotes",
    "currency", "conversionSchema", "constraints", "kpiConfig",
    "isEcommerce", "isGoogle", "slug", "active",
];

function isEmpty(val: any): boolean {
    if (val === undefined || val === null) return true;
    if (val === "" || val === 0) return true;
    if (typeof val === "object" && !Array.isArray(val) && Object.keys(val).length === 0) return true;
    return false;
}

/** Pick the richer value: prefer non-empty, prefer longer strings, prefer deeper objects */
function pickBest(a: any, b: any): any {
    if (isEmpty(a) && isEmpty(b)) return a;
    if (isEmpty(a)) return b;
    if (isEmpty(b)) return a;

    // Both have values — pick the richer one
    if (typeof a === "string" && typeof b === "string") {
        return a.length >= b.length ? a : b;
    }
    if (typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
        // Merge nested objects: combine keys from both, picking non-empty
        const merged = { ...a };
        for (const [k, v] of Object.entries(b)) {
            if (isEmpty(merged[k]) && !isEmpty(v)) merged[k] = v;
        }
        return merged;
    }
    // For booleans: prefer true
    if (typeof a === "boolean" && typeof b === "boolean") {
        return a || b;
    }
    // For numbers: prefer non-zero, then larger
    if (typeof a === "number" && typeof b === "number") {
        if (a === 0) return b;
        if (b === 0) return a;
        return a;
    }
    return a;
}

/** Merge all duplicates into a single unified profile */
function mergeProfiles(dupes: Record<string, any>[]): Record<string, any> {
    const merged: Record<string, any> = {};

    for (const field of MERGEABLE_FIELDS) {
        let best: any = undefined;
        for (const d of dupes) {
            best = pickBest(best, d[field]);
        }
        if (!isEmpty(best)) {
            merged[field] = best;
        }
    }

    // Always active after merge
    merged.active = true;

    return merged;
}

function scoreCompleteness(data: Record<string, any>): number {
    let score = 0;
    for (const field of MERGEABLE_FIELDS) {
        if (!isEmpty(data[field])) score++;
    }
    if (data.active === true) score += 2; // strong bonus for active
    if (data.metaAdAccountId) score += 2; // strong bonus for connected account
    return score;
}

async function main() {
    console.log(`\n${"=".repeat(65)}`);
    console.log(` Client Deduplication + Merge${DRY_RUN ? " (DRY RUN)" : ""}`);
    console.log(`${"=".repeat(65)}\n`);

    const snap = await db.collection("clients").get();
    const clients = snap.docs.map(d => ({ id: d.id, ...d.data() as Record<string, any> }));

    console.log(`Total clients in Firestore: ${clients.length}\n`);

    // Group by normalized name
    const groups = new Map<string, typeof clients>();
    for (const c of clients) {
        const key = (c.name || "").trim().toLowerCase().replace(/\s+/g, " ");
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(c);
    }

    const duplicates = [...groups.entries()].filter(([, v]) => v.length > 1);

    if (duplicates.length === 0) {
        console.log("No duplicates found.\n");
        return;
    }

    console.log(`Found ${duplicates.length} duplicate group(s):\n`);

    interface MergeAction {
        keeperId: string;
        keeperName: string;
        mergedFields: Record<string, any>;
        fieldsAdded: string[];
        toDeleteIds: string[];
    }

    const actions: MergeAction[] = [];

    for (const [name, dupes] of duplicates) {
        console.log(`--- "${name}" (${dupes.length} copies) ---`);

        // Score and sort: best first (will be the keeper)
        const scored = dupes
            .map(d => ({ ...d, score: scoreCompleteness(d) }))
            .sort((a, b) => b.score - a.score);

        const keeper = scored[0];
        const losers = scored.slice(1);

        // Show current state
        for (const s of scored) {
            const tag = s.id === keeper.id ? "KEEP " : "MERGE";
            const filledFields = MERGEABLE_FIELDS.filter(f => !isEmpty(s[f]));
            console.log(`  [${tag}] ${s.id} | active=${s.active ?? false} | score=${s.score} | ${filledFields.length} fields`);
        }

        // Build merged profile from ALL copies
        const allCopies = [keeper, ...losers];
        const merged = mergeProfiles(allCopies);

        // Figure out what fields the merge adds to the keeper
        const fieldsAdded: string[] = [];
        const updatePayload: Record<string, any> = {};

        for (const [field, val] of Object.entries(merged)) {
            const keeperVal = keeper[field];
            if (isEmpty(keeperVal) && !isEmpty(val)) {
                fieldsAdded.push(field);
                updatePayload[field] = val;
            } else if (
                typeof val === "object" && typeof keeperVal === "object" &&
                !Array.isArray(val) && val !== null && keeperVal !== null
            ) {
                // Check if nested merge added keys
                const newKeys = Object.keys(val).filter(k => isEmpty(keeperVal[k]) && !isEmpty(val[k]));
                if (newKeys.length > 0) {
                    fieldsAdded.push(`${field}.{${newKeys.join(",")}}`);
                    updatePayload[field] = val;
                }
            }
        }

        if (fieldsAdded.length > 0) {
            console.log(`  -> Merging into keeper: +${fieldsAdded.join(", ")}`);
        } else {
            console.log(`  -> Keeper already has all fields, nothing to merge`);
        }

        actions.push({
            keeperId: keeper.id,
            keeperName: keeper.name,
            mergedFields: updatePayload,
            fieldsAdded,
            toDeleteIds: losers.map(l => l.id),
        });

        console.log();
    }

    // Summary
    const totalDeletes = actions.reduce((acc, a) => acc + a.toDeleteIds.length, 0);
    const totalMerges = actions.filter(a => a.fieldsAdded.length > 0).length;

    console.log(`${"=".repeat(65)}`);
    console.log(` ${totalMerges} clients to update (merge fields)`);
    console.log(` ${totalDeletes} duplicate clients to delete`);
    console.log(`${"=".repeat(65)}\n`);

    if (DRY_RUN) {
        console.log("(DRY RUN — no changes made. Remove --dry-run to execute.)\n");
        return;
    }

    // Execute
    console.log("Executing...\n");

    for (const action of actions) {
        // 1. Merge fields into keeper
        if (Object.keys(action.mergedFields).length > 0) {
            await db.collection("clients").doc(action.keeperId).update({
                ...action.mergedFields,
                updatedAt: new Date().toISOString(),
            });
            console.log(`  MERGED ${action.keeperName} (${action.keeperId}) — added: ${action.fieldsAdded.join(", ")}`);
        }

        // 2. Delete duplicates + cleanup
        for (const deleteId of action.toDeleteIds) {
            console.log(`  DELETE ${deleteId}`);

            await db.collection("clients").doc(deleteId).delete();

            // Clean up doc-per-client collections
            const docCollections = [
                "engine_configs", "client_snapshots", "client_snapshots_ads", "creative_diversity_scores",
            ];
            for (const col of docCollections) {
                const doc = await db.collection(col).doc(deleteId).get();
                if (doc.exists) {
                    await db.collection(col).doc(deleteId).delete();
                    console.log(`    cleaned ${col}/${deleteId}`);
                }
            }

            // Clean up query-based collections
            const queryCollections = [
                "entity_rolling_metrics", "daily_entity_snapshots", "entity_classifications",
                "creative_dna", "meta_creatives", "alerts", "creative_kpi_snapshots",
            ];
            for (const col of queryCollections) {
                const relSnap = await db.collection(col)
                    .where("clientId", "==", deleteId)
                    .limit(500)
                    .get();

                if (!relSnap.empty) {
                    const batch = db.batch();
                    for (const doc of relSnap.docs) batch.delete(doc.ref);
                    await batch.commit();
                    console.log(`    cleaned ${relSnap.size} docs from ${col}`);
                }
            }
        }
        console.log();
    }

    console.log(`Done. Merged ${totalMerges} profiles, deleted ${totalDeletes} duplicates.\n`);
}

main().catch(console.error);
