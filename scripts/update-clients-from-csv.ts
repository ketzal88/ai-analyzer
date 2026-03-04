/**
 * Script: Update all clients in Firestore from CSV data
 * Run: npx tsx scripts/update-clients-from-csv.ts
 *
 * Reads the CSV export and upserts each client by slug.
 * - Existing clients (matched by slug) → updated with new fields
 * - New clients → created with all fields
 */

import * as admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";

// Load .env.local manually (no dotenv dependency needed)
function loadEnvFile(filePath: string) {
    const content = fs.readFileSync(filePath, "utf-8");
    for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIndex = trimmed.indexOf("=");
        if (eqIndex === -1) continue;
        const key = trimmed.substring(0, eqIndex).trim();
        let value = trimmed.substring(eqIndex + 1).trim();
        // Remove surrounding quotes
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
}

loadEnvFile(path.resolve(__dirname, "../.env.local"));

// Init Firebase Admin
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

// ============ HELPERS ============

function slugify(name: string): string {
    return name.trim().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents: á→a, é→e, etc.
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
}

/** Parse Argentine-format numbers: $42.150 or $6.857,00 or 6,94 */
function parseArgNumber(raw: string): number | undefined {
    if (!raw || raw.trim() === '' || raw.trim() === '-') return undefined;
    let cleaned = raw.trim()
        .replace(/^\$/, '')    // Remove leading $
        .replace(/\s/g, '');   // Remove spaces

    // Handle range like "$5.000 - $8.0000" → take the first value
    if (cleaned.includes(' - ') || cleaned.includes('-') && cleaned.indexOf('-') > 0) {
        const parts = cleaned.split(/\s*-\s*/);
        cleaned = parts[0].replace(/^\$/, '');
    }

    // Argentine format: dots are thousands, comma is decimal
    // e.g. "6.857,00" → "6857.00", "42.150" → "42150"
    if (cleaned.includes(',')) {
        // Has comma → comma is decimal separator
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
        // No comma → dots are thousands separators
        cleaned = cleaned.replace(/\./g, '');
    }

    const num = parseFloat(cleaned);
    return isNaN(num) ? undefined : num;
}

function mapPrimaryGoal(raw: string): "scale" | "efficiency" | "stability" | undefined {
    const lower = raw.trim().toLowerCase();
    if (lower.includes("aggressive") || lower.includes("scale")) return "scale";
    if (lower.includes("profitability") || lower.includes("efficiency")) return "efficiency";
    if (lower.includes("stability") || lower.includes("maintenance")) return "stability";
    return undefined;
}

function mapGrowthMode(goal: string): "aggressive" | "stable" | "conservative" | undefined {
    const lower = goal.trim().toLowerCase();
    if (lower.includes("aggressive")) return "aggressive";
    if (lower.includes("stability") || lower.includes("maintenance")) return "stable";
    if (lower.includes("profitability") || lower.includes("efficiency")) return "conservative";
    return undefined;
}

function mapBusinessType(model: string): "ecommerce" | "leads" | "whatsapp" {
    const lower = model.trim().toLowerCase();
    if (lower.includes("lead")) return "leads";
    if (lower.includes("whatsapp")) return "whatsapp";
    return "ecommerce"; // E-commerce, Mayorista, Suscripción all use ecommerce
}

function parseBool(raw: string): boolean {
    const lower = raw.trim().toLowerCase();
    return lower === "si" || lower.startsWith("si,") || lower === "yes";
}

// ============ CSV PARSING ============

function parseCSVLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            fields.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    fields.push(current);
    return fields;
}

// ============ MAIN ============

interface CSVRow {
    name: string;
    team: string;
    businessModel: string;
    primaryGoalRaw: string;
    avgTicketLastMonth: string;
    avgTicketHistoric: string;
    grossMarginPct: string;
    targetCpa: string;
    targetRoas: string;
    revenueTarget: string;
    ordersInitial: string;
    ordersTarget: string;
    aovTarget: string;
    ltv: string;
    maxDailyBudget: string;
    seasonality: string;
    hasEmail: string;
    hasGoogle: string;
    hasWhatsapp: string;
    description: string;
}

async function main() {
    const isDryRun = process.argv.includes("--dry-run");
    if (isDryRun) console.log("🔍 DRY RUN MODE — no changes will be made\n");

    const csvPath = path.resolve(__dirname, "../docs/Objetivos y KPIs Clientes - Hoja 1.csv");
    const csvContent = fs.readFileSync(csvPath, "utf-8");
    const lines = csvContent.split("\n").filter(l => l.trim().length > 0);

    // Skip header
    const dataLines = lines.slice(1);

    console.log(`📊 Found ${dataLines.length} clients in CSV\n`);

    const now = new Date().toISOString();
    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const line of dataLines) {
        const fields = parseCSVLine(line);
        const row: CSVRow = {
            name: fields[0]?.trim() || '',
            team: fields[1]?.trim() || '',
            businessModel: fields[2]?.trim() || '',
            primaryGoalRaw: fields[3]?.trim() || '',
            avgTicketLastMonth: fields[4]?.trim() || '',
            avgTicketHistoric: fields[5]?.trim() || '',
            grossMarginPct: fields[6]?.trim() || '',
            targetCpa: fields[7]?.trim() || '',
            targetRoas: fields[8]?.trim() || '',
            revenueTarget: fields[9]?.trim() || '',
            ordersInitial: fields[10]?.trim() || '',
            ordersTarget: fields[11]?.trim() || '',
            aovTarget: fields[12]?.trim() || '',
            ltv: fields[13]?.trim() || '',
            maxDailyBudget: fields[14]?.trim() || '',
            seasonality: fields[15]?.trim() || '',
            hasEmail: fields[16]?.trim() || '',
            hasGoogle: fields[17]?.trim() || '',
            hasWhatsapp: fields[18]?.trim() || '',
            description: fields[19]?.trim() || '',
        };

        if (!row.name) continue;

        const slug = slugify(row.name);
        const targetCpa = parseArgNumber(row.targetCpa);
        const targetRoas = parseArgNumber(row.targetRoas);
        const avgTicket = parseArgNumber(row.avgTicketHistoric) || parseArgNumber(row.avgTicketLastMonth);
        const grossMargin = parseArgNumber(row.grossMarginPct);
        const ltv = parseArgNumber(row.ltv);
        const maxDailyBudget = parseArgNumber(row.maxDailyBudget);
        const ordersTarget = parseArgNumber(row.ordersTarget);

        // Build update payload (only defined fields)
        const payload: Record<string, any> = {
            name: row.name,
            slug,
            active: true,
            businessType: mapBusinessType(row.businessModel),
            isEcommerce: mapBusinessType(row.businessModel) === "ecommerce",
            isGoogle: parseBool(row.hasGoogle),
            businessModel: row.businessModel || undefined,
            primaryGoal: mapPrimaryGoal(row.primaryGoalRaw),
            growthMode: mapGrowthMode(row.primaryGoalRaw),
            updatedAt: now,
        };

        // Only set if value exists
        if (targetCpa !== undefined) payload.targetCpa = targetCpa;
        if (targetRoas !== undefined) payload.targetRoas = targetRoas;
        if (avgTicket !== undefined) payload.averageTicket = avgTicket;
        if (grossMargin !== undefined) payload.grossMarginPct = grossMargin;
        if (ltv !== undefined) payload.ltv = ltv;
        if (ordersTarget !== undefined) payload.targetSalesVolume = ordersTarget;
        if (row.description) payload.description = row.description;
        if (row.seasonality) payload.seasonalityNotes = row.seasonality;
        if (row.team) payload.team = row.team;

        // Constraints
        const constraints: Record<string, any> = {};
        if (maxDailyBudget !== undefined) constraints.maxDailyBudget = maxDailyBudget;
        if (row.seasonality) constraints.seasonality = row.seasonality;

        // Map fatigue tolerance from primary goal
        if (row.primaryGoalRaw.toLowerCase().includes("aggressive")) {
            constraints.fatigueTolerance = "high";
            constraints.scalingSpeed = "fast";
        } else if (row.primaryGoalRaw.toLowerCase().includes("stability")) {
            constraints.fatigueTolerance = "low";
            constraints.scalingSpeed = "slow";
        } else if (row.primaryGoalRaw.toLowerCase().includes("efficiency")) {
            constraints.fatigueTolerance = "normal";
            constraints.scalingSpeed = "normal";
        }

        if (Object.keys(constraints).length > 0) {
            payload.constraints = constraints;
        }

        // Currency — USD clients: comma is decimal separator in the CSV
        const isUSD = row.name === "Accuracy" || row.name === "Shallpass";
        if (isUSD) {
            payload.currency = "USD";
            // For USD clients, the CSV still uses Argentine format (comma = decimal)
            // but the values are in USD. The parseArgNumber already handles this correctly,
            // so we just need to verify the values make sense for USD.
            // Accuracy: "$95,00" → 95.00 USD (parseArgNumber gives 95 ✓)
            // Shallpass: "32.42" → could be 3242 or 32.42
            // Fix: re-parse with awareness that these are small USD values
            if (row.targetCpa) {
                let rawCpa = row.targetCpa.replace(/^\$/, '').trim();
                // If it has comma, treat as decimal (Argentine format)
                if (rawCpa.includes(',')) {
                    rawCpa = rawCpa.replace(/\./g, '').replace(',', '.');
                }
                // If no comma and has dot: for USD it's likely a decimal (32.42)
                // not a thousands separator
                const usdCpa = parseFloat(rawCpa);
                if (!isNaN(usdCpa)) payload.targetCpa = usdCpa;
            }
            if (row.avgTicketHistoric) {
                let rawTicket = row.avgTicketHistoric.replace(/^\$/, '').trim();
                if (rawTicket.includes(',')) {
                    rawTicket = rawTicket.replace(/\./g, '').replace(',', '.');
                }
                const usdTicket = parseFloat(rawTicket);
                if (!isNaN(usdTicket)) payload.averageTicket = usdTicket;
            }
        } else {
            payload.currency = "ARS";
        }

        if (isDryRun) {
            console.log(`📋 ${row.name} (${slug}):`);
            console.log(`   businessType=${payload.businessType} | goal=${payload.primaryGoal} | growthMode=${payload.growthMode}`);
            console.log(`   targetCpa=${payload.targetCpa ?? 'N/A'} | targetRoas=${payload.targetRoas ?? 'N/A'} | avgTicket=${payload.averageTicket ?? 'N/A'}`);
            console.log(`   grossMargin=${payload.grossMarginPct ?? 'N/A'}% | ltv=${payload.ltv ?? 'N/A'} | maxBudget=${payload.constraints?.maxDailyBudget ?? 'N/A'}`);
            console.log(`   isGoogle=${payload.isGoogle} | currency=${payload.currency} | team=${payload.team}`);
            console.log(`   ordersTarget=${payload.targetSalesVolume ?? 'N/A'} | seasonality=${payload.seasonalityNotes ?? 'N/A'}`);
            if (payload.description) console.log(`   description: ${payload.description.substring(0, 80)}...`);
            console.log('');
            updated++; // Count as "would update"
            continue;
        }

        try {
            // Find existing by slug
            const existingSnap = await db.collection("clients")
                .where("slug", "==", slug)
                .limit(1)
                .get();

            if (!existingSnap.empty) {
                // Update existing
                const docRef = existingSnap.docs[0].ref;
                // Merge constraints with existing
                const existingData = existingSnap.docs[0].data();
                if (payload.constraints && existingData.constraints) {
                    payload.constraints = { ...existingData.constraints, ...payload.constraints };
                }
                await docRef.update(payload);
                console.log(`✅ Updated: ${row.name} (${slug})`);
                updated++;
            } else {
                // Create new
                payload.createdAt = now;
                const newRef = db.collection("clients").doc();
                await newRef.set(payload);
                console.log(`🆕 Created: ${row.name} (${slug})`);
                created++;
            }
        } catch (err: any) {
            console.error(`❌ Error for ${row.name}: ${err.message}`);
            errors++;
        }
    }

    console.log(`\n📋 Summary: ${updated} updated, ${created} created, ${errors} errors`);
    process.exit(0);
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
