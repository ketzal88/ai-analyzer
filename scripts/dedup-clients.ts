/**
 * Script: Deduplicate clients in Firestore
 * Run: npx tsx scripts/dedup-clients.ts --dry-run
 * Run: npx tsx scripts/dedup-clients.ts
 *
 * Strategy:
 * 1. Fetch all clients
 * 2. Group duplicates by known mappings
 * 3. For each group: keep the one with metaAdAccountId (the "original"),
 *    merge in new CSV data from the duplicate, then archive the duplicate
 * 4. Archive FL Indumentaria, Sherba Blends, demos, and other dead clients
 */

import * as admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";

// Load .env.local
function loadEnvFile(filePath: string) {
    const content = fs.readFileSync(filePath, "utf-8");
    for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIndex = trimmed.indexOf("=");
        if (eqIndex === -1) continue;
        const key = trimmed.substring(0, eqIndex).trim();
        let value = trimmed.substring(eqIndex + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
}

loadEnvFile(path.resolve(__dirname, "../.env.local"));

if (!admin.apps.length) {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (privateKey) {
        privateKey = privateKey.replace(/^['"]|['"]$/g, '');
        if (privateKey.includes('\\n')) {
            privateKey = privateKey.replace(/\\n/g, '\n');
        }
    }
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey,
        }),
    });
    admin.firestore().settings({ ignoreUndefinedProperties: true });
}

const db = admin.firestore();

// ============ DUPLICATE MAPPINGS ============
// Key = name of the NEW duplicate (from CSV import), Value = name of the ORIGINAL (already had metaAdAccountId, slack, etc.)
const DUPLICATE_MAP: Record<string, string> = {
    "TheMinimal Co": "TheMinimalCo",
    "Cover UP": "CoverUp",
    "Almacen de Colchones": "Alma Colchones",
    "Phone Case": "PhoneCase",
    "Casa Nostra": "CasaNostra",
    "Coco Nude": "CocoNude",
    "Pietra Essentials": "Pietra",
    "Cordoba Notebooks": "Cordoba Notebook",
    "Andahlue": "Anadalhue",
    "Black Horn": "Blackhorn",
    "Simoneta": "Simonetta",
    "Galo Handmade": "Galo Hand Made",
    "Carrara": "Carrara Design",
    // Deco Bluna is a NEW client, NOT a duplicate of EasyHome
    // Vinitus is a NEW client, no duplicate
};

// Clients to archive (no longer active)
const ARCHIVE_LIST = [
    "FL Indumentaria",
    "Sherba Blends",
    "Golden Brand (AI Demo)",
    "Golden Brand Demo",
    "Mailex",
    "Aires",
    "EasyHome",
];

// ============ HELPERS ============

/** Deep merge: source overwrites target, but only for defined non-empty values */
function mergeClientData(original: Record<string, any>, newData: Record<string, any>): Record<string, any> {
    const merged = { ...original };

    for (const [key, value] of Object.entries(newData)) {
        // Skip system fields we don't want to overwrite
        if (['id', 'createdAt', 'slug', 'metaAdAccountId', 'slackPublicChannel', 'slackInternalChannel'].includes(key)) continue;

        // Skip if new value is undefined/null/empty
        if (value === undefined || value === null || value === '') continue;

        // For constraints, deep merge
        if (key === 'constraints' && typeof value === 'object' && typeof merged.constraints === 'object') {
            merged.constraints = { ...merged.constraints, ...value };
            continue;
        }

        // For conversionSchema, keep original if exists
        if (key === 'conversionSchema' && merged.conversionSchema) continue;

        // Overwrite with new value (CSV data is more up-to-date for business fields)
        merged[key] = value;
    }

    return merged;
}

// ============ MAIN ============

async function main() {
    const isDryRun = process.argv.includes("--dry-run");
    if (isDryRun) console.log("🔍 DRY RUN MODE — no changes will be made\n");

    // 1. Fetch ALL clients
    const allClientsSnap = await db.collection("clients").get();
    const clientsByName: Map<string, { id: string; data: Record<string, any> }> = new Map();

    for (const doc of allClientsSnap.docs) {
        const data = doc.data();
        clientsByName.set(data.name, { id: doc.id, data });
    }

    console.log(`📊 Total clients in Firestore: ${clientsByName.size}\n`);

    const now = new Date().toISOString();
    let merged = 0;
    let archived = 0;
    let errors = 0;

    // 2. Process duplicates: merge new → original, archive new
    console.log("=== MERGING DUPLICATES ===\n");

    for (const [newName, originalName] of Object.entries(DUPLICATE_MAP)) {
        if (newName === originalName) continue; // Skip non-duplicates

        const newClient = clientsByName.get(newName);
        const originalClient = clientsByName.get(originalName);

        if (!newClient) {
            console.log(`⏭️  Skip: "${newName}" not found in Firestore`);
            continue;
        }

        if (!originalClient) {
            // The new one IS the only one — just rename/update it, don't archive
            console.log(`⚠️  "${originalName}" (original) not found — keeping "${newName}" as-is`);
            continue;
        }

        // Merge: take original (has metaAdAccountId, slack channels) + overlay new CSV data
        const mergedData = mergeClientData(originalClient.data, newClient.data);
        mergedData.updatedAt = now;
        // Keep original's name if preferred, or use the CSV name
        mergedData.name = newName; // Use the cleaner CSV name (e.g., "TheMinimal Co" vs "TheMinimalCo")

        if (isDryRun) {
            console.log(`🔀 Would merge: "${newName}" → "${originalName}" (id: ${originalClient.id})`);
            console.log(`   Original has: metaAdAccountId=${originalClient.data.metaAdAccountId ? 'YES' : 'NO'}, slack=${originalClient.data.slackPublicChannel ? 'YES' : 'NO'}`);
            console.log(`   New brings: targetCpa=${newClient.data.targetCpa ?? 'N/A'}, description=${newClient.data.description ? 'YES' : 'NO'}, team=${newClient.data.team ?? 'N/A'}`);
            console.log(`   Would archive duplicate: ${newClient.id}`);
            console.log('');
        } else {
            try {
                // Update original with merged data
                await db.collection("clients").doc(originalClient.id).update(mergedData);
                // Archive the duplicate
                await db.collection("clients").doc(newClient.id).update({
                    archived: true,
                    active: false,
                    archivedAt: now,
                    archivedReason: `Merged into ${originalClient.id} (${originalName})`,
                    updatedAt: now,
                });
                console.log(`✅ Merged "${newName}" → "${originalName}" (${originalClient.id}) + archived duplicate ${newClient.id}`);
                merged++;
            } catch (err: any) {
                console.error(`❌ Error merging ${newName}: ${err.message}`);
                errors++;
            }
        }
    }

    // 3. Archive dead clients
    console.log("\n=== ARCHIVING INACTIVE CLIENTS ===\n");

    for (const name of ARCHIVE_LIST) {
        const client = clientsByName.get(name);
        if (!client) {
            console.log(`⏭️  Skip: "${name}" not found`);
            continue;
        }

        if (client.data.archived) {
            console.log(`⏭️  Skip: "${name}" already archived`);
            continue;
        }

        if (isDryRun) {
            console.log(`🗄️  Would archive: "${name}" (${client.id})`);
        } else {
            try {
                await db.collection("clients").doc(client.id).update({
                    archived: true,
                    active: false,
                    archivedAt: now,
                    archivedReason: "Client no longer active",
                    updatedAt: now,
                });
                console.log(`🗄️  Archived: "${name}" (${client.id})`);
                archived++;
            } catch (err: any) {
                console.error(`❌ Error archiving ${name}: ${err.message}`);
                errors++;
            }
        }
    }

    console.log(`\n📋 Summary: ${merged} merged, ${archived} archived, ${errors} errors`);
    process.exit(0);
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
