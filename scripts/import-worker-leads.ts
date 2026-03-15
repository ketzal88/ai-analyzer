/**
 * Import Worker leads from CSV into Firestore `leads` collection.
 *
 * Worker CSV has extra columns (Nutrición, Recordatorio) compared to Shallpass,
 * and dates in Spanish format ("lunes, 09 de junio de 2025").
 *
 * Usage:
 *   npx tsx --require ./scripts/load-env.cjs scripts/import-worker-leads.ts
 *   npx tsx --require ./scripts/load-env.cjs scripts/import-worker-leads.ts --dry-run
 */

import * as fs from "fs";
import * as path from "path";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp, cert, getApps } from "firebase-admin/app";

// ── Config ───────────────────────────────────────────────
const CLIENT_ID = "Xztaf4I2sWkpfQcpUiel";
const CSV_PATH = path.resolve(__dirname, "../docs/CRM Worker - 📅 EOD Closer 2.0 (1).csv");
const DRY_RUN = process.argv.includes("--dry-run");

// ── Firebase Init ────────────────────────────────────────
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}
const db = getFirestore();

// ── CSV Parser (handles quoted fields with commas/newlines) ──
function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentField += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        currentRow.push(currentField.trim());
        currentField = "";
      } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
        currentRow.push(currentField.trim());
        if (currentRow.length > 1) rows.push(currentRow);
        currentRow = [];
        currentField = "";
        if (ch === "\r") i++;
      } else {
        currentField += ch;
      }
    }
  }
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.length > 1) rows.push(currentRow);
  }

  return rows;
}

// ── Mappers ──────────────────────────────────────────────

const SPANISH_MONTHS: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

function mapQualification(raw: string): string {
  const normalized = raw.toLowerCase().trim();
  if (normalized === "calificado") return "calificado";
  if (normalized === "no calificado") return "no_calificado";
  if (normalized === "spam") return "spam";
  if (normalized === "no responde") return "no_responde";
  if (normalized === "verificando") return "verificando";
  return "pending";
}

function mapPostCallStatus(raw: string): string {
  const normalized = raw.toLowerCase().trim();
  if (normalized === "nuevo cliente") return "nuevo_cliente";
  if (normalized === "no asistió" || normalized === "no asistio") return "no_asistio";
  if (normalized === "no compró" || normalized === "no compro") return "no_compro";
  if (normalized === "seguimiento") return "seguimiento";
  if (normalized === "reprogramado") return "reprogramado";
  if (normalized.startsWith("cancel")) return "cancelo";
  return "pendiente";
}

function parseDate(raw: string): string | null {
  if (!raw) return null;

  // Format: "lunes, 09 de junio de 2025" or "lunes, 09 de junio de 2025AR"
  const spanishMatch = raw.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/);
  if (spanishMatch) {
    const day = parseInt(spanishMatch[1]);
    const monthName = spanishMatch[2].toLowerCase();
    const year = parseInt(spanishMatch[3]);
    const month = SPANISH_MONTHS[monthName];
    if (month !== undefined) {
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) return date.toISOString();
    }
  }

  // Format: "Monday, January 26, 2026AR" → strip trailing country code
  const cleanedLong = raw.replace(/[A-Z]{2}$/, "").trim();
  const dateLong = new Date(cleanedLong);
  if (!isNaN(dateLong.getTime())) return dateLong.toISOString();

  // Format: "1/24/2026" (M/D/YYYY)
  const parts = raw.split("/");
  if (parts.length === 3) {
    const [m, d, y] = parts.map(Number);
    const date = new Date(y, m - 1, d);
    if (!isNaN(date.getTime())) return date.toISOString();
  }

  // Format: serial number (Excel date serial like 46045)
  const serial = Number(raw);
  if (!isNaN(serial) && serial > 40000 && serial < 60000) {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + serial * 86400000);
    if (!isNaN(date.getTime())) return date.toISOString();
  }

  return null;
}

function parseRevenue(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[$,]/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseAttendance(raw: string): boolean | null {
  if (raw === "TRUE") return true;
  if (raw === "FALSE") return false;
  return null;
}

function mapQualityScore(raw: string): 1 | 2 | 3 | null {
  const n = parseInt(raw);
  if (n === 1 || n === 2 || n === 3) return n;
  return null;
}

// ── Main ─────────────────────────────────────────────────

async function main() {
  console.log(`\n📋 Worker Lead Import`);
  console.log(`   Client: ${CLIENT_ID}`);
  console.log(`   CSV: ${CSV_PATH}`);
  console.log(`   Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

  const content = fs.readFileSync(CSV_PATH, "utf-8");
  const rows = parseCSV(content);

  // Worker CSV column mapping (2 extra cols: Nutrición=21, Recordatorio=22):
  // 0: Fecha de Agenda
  // 1: Fecha ingreso
  // 2: Nombre
  // 3: Calendario
  // 4: Closer
  // 5: Fecha Agenda
  // 6: Pais
  // 7: GRUPO Respuestas de Formulario (business name)
  // 8: Email
  // 9: Teléfono
  // 10: Avatar
  // 11: Cualificación Económica
  // 12: Instagram
  // 13: Confirmación de Asistencia
  // 14: GRUPO UTMS
  // 15: utm_source
  // 16: utm_campaign
  // 17: utm_medium
  // 18: utm_content
  // 19: utm_term
  // 20: Calificación
  // 21: Nutrición (TRUE/FALSE) — extra
  // 22: Recordatorio (TRUE/FALSE) — extra
  // 23: Asistencia (TRUE/FALSE)
  // 24: Estado Post Llamada
  // 25: Fecha 2da Llamada
  // 26: Calidad Lead
  // 27: Ingreso Total
  // 28: Comentario
  // 29-33: Día, Semana, Mes, Año, MesAño

  const dataRows = rows.slice(1);

  // Deduplicate by email (keep last occurrence)
  const seenEmails = new Map<string, number>();
  const deduped: string[][] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const email = (row[8] || "").toLowerCase().trim();
    if (email && seenEmails.has(email)) {
      const prevIdx = seenEmails.get(email)!;
      deduped[prevIdx] = row;
      console.log(`   ⚠️  Duplicate email: ${email} — keeping latest entry`);
    } else {
      seenEmails.set(email, deduped.length);
      deduped.push(row);
    }
  }

  console.log(`   Total CSV rows: ${dataRows.length}`);
  console.log(`   After dedup: ${deduped.length}\n`);

  const leads: Record<string, unknown>[] = [];
  let skipped = 0;
  let dateErrors = 0;

  for (const row of deduped) {
    const name = (row[2] || "").trim();
    if (!name) {
      skipped++;
      continue;
    }

    const scheduledDateRaw = row[5] || row[0] || "";  // Prefer col 5 (Spanish date), fallback to col 0
    const entryDateRaw = row[1] || "";
    const email = (row[8] || "").trim();
    const phone = (row[9] || "").trim();
    const country = (row[6] || "").trim();
    const calendarType = (row[3] || "").trim();
    const closer = (row[4] || "").trim();
    const confirmationStatus = (row[13] || "").trim();

    const utmSource = (row[15] || "").trim();
    const utmCampaign = (row[16] || "").trim();
    const utmMedium = (row[17] || "").trim();
    const utmContent = (row[18] || "").trim();
    const utmTerm = (row[19] || "").trim();

    // Worker-specific column offsets (+2 from Shallpass)
    const qualification = mapQualification(row[20] || "");
    const attendance = parseAttendance(row[23] || "");     // col 23 (was 21)
    const postCallStatus = mapPostCallStatus(row[24] || ""); // col 24 (was 22)
    const qualityScore = mapQualityScore(row[26] || "");    // col 26 (was 24)
    const revenue = parseRevenue(row[27] || "");            // col 27 (was 25)
    const comment = (row[28] || "").trim();                 // col 28 (was 27)

    const scheduledDate = parseDate(scheduledDateRaw);
    const createdAt = parseDate(entryDateRaw) || scheduledDate || new Date().toISOString();

    if (!parseDate(entryDateRaw) && !scheduledDate) {
      dateErrors++;
    }

    const now = new Date().toISOString();

    const utm: Record<string, string> = {};
    if (utmSource) utm.source = utmSource;
    if (utmCampaign) utm.campaign = utmCampaign;
    if (utmMedium) utm.medium = utmMedium;
    if (utmContent) utm.content = utmContent;
    if (utmTerm) utm.term = utmTerm;

    const lead: Record<string, unknown> = {
      clientId: CLIENT_ID,
      name,
      email: email || undefined,
      phone: phone || undefined,
      country: country || undefined,
      calendarType: calendarType || undefined,
      scheduledDate: scheduledDate || undefined,
      confirmationStatus: confirmationStatus || undefined,
      closerAssigned: closer || undefined,
      utm: Object.keys(utm).length > 0 ? utm : undefined,
      qualification,
      qualityScore,
      attendance,
      postCallStatus,
      revenue,
      closerComments: comment || undefined,
      source: "csv_import" as const,
      createdAt,
      updatedAt: now,
      qualifiedAt: qualification !== "pending" ? createdAt : undefined,
    };

    // Remove undefined fields
    for (const key of Object.keys(lead)) {
      if (lead[key] === undefined) delete lead[key];
    }

    leads.push(lead);
  }

  console.log(`   Leads to import: ${leads.length}`);
  console.log(`   Skipped (no name): ${skipped}`);
  if (dateErrors > 0) console.log(`   ⚠️  Date parse issues: ${dateErrors}`);
  console.log();

  // Stats
  const closerStats = new Map<string, number>();
  for (const l of leads) {
    const c = (l.closerAssigned as string) || "Sin asignar";
    closerStats.set(c, (closerStats.get(c) || 0) + 1);
  }

  const stats = {
    calificado: leads.filter((l) => l.qualification === "calificado").length,
    no_calificado: leads.filter((l) => l.qualification === "no_calificado").length,
    spam: leads.filter((l) => l.qualification === "spam").length,
    no_responde: leads.filter((l) => l.qualification === "no_responde").length,
    pending: leads.filter((l) => l.qualification === "pending").length,
    attended: leads.filter((l) => l.attendance === true).length,
    nuevo_cliente: leads.filter((l) => l.postCallStatus === "nuevo_cliente").length,
    no_compro: leads.filter((l) => l.postCallStatus === "no_compro").length,
    totalRevenue: leads.reduce((sum, l) => sum + (l.revenue as number || 0), 0),
  };

  console.log("   📊 Breakdown:");
  console.log(`      Calificados: ${stats.calificado}`);
  console.log(`      No Calificados: ${stats.no_calificado}`);
  console.log(`      Spam: ${stats.spam}`);
  console.log(`      No Responde: ${stats.no_responde}`);
  console.log(`      Pendientes: ${stats.pending}`);
  console.log(`      Asistieron: ${stats.attended}`);
  console.log(`      Nuevos Clientes: ${stats.nuevo_cliente}`);
  console.log(`      No Compraron: ${stats.no_compro}`);
  console.log(`      Revenue Total: $${stats.totalRevenue.toLocaleString()}`);
  console.log();
  console.log("   👥 Por Closer:");
  for (const [closer, count] of closerStats) {
    console.log(`      ${closer}: ${count}`);
  }
  console.log();

  if (DRY_RUN) {
    console.log("   🏁 Dry run complete. No data written.\n");
    console.log("   Sample leads:");
    for (const lead of leads.slice(0, 5)) {
      console.log(`     - ${lead.name} | ${lead.closerAssigned} | ${lead.qualification} | ${lead.postCallStatus} | $${lead.revenue}`);
    }
    return;
  }

  // Write to Firestore in batches of 500
  const BATCH_SIZE = 500;
  let written = 0;

  for (let i = 0; i < leads.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = leads.slice(i, i + BATCH_SIZE);

    for (const lead of chunk) {
      const docRef = db.collection("leads").doc();
      batch.set(docRef, lead);
    }

    await batch.commit();
    written += chunk.length;
    console.log(`   ✅ Batch written: ${written}/${leads.length}`);
  }

  console.log(`\n   🎉 Import complete! ${written} leads written to Firestore.\n`);
}

main().catch((err) => {
  console.error("❌ Import failed:", err);
  process.exit(1);
});
