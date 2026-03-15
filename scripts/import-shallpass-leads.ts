/**
 * Import Shallpass leads from CSV into Firestore `leads` collection.
 *
 * Usage:
 *   npx tsx --require ./scripts/load-env.cjs scripts/import-shallpass-leads.ts
 *   npx tsx --require ./scripts/load-env.cjs scripts/import-shallpass-leads.ts --dry-run
 */

import * as fs from "fs";
import * as path from "path";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp, cert, getApps } from "firebase-admin/app";

// ── Config ───────────────────────────────────────────────
const CLIENT_ID = "0gHtT6hFp1VxgefXUdru";
const CSV_PATH = path.resolve(__dirname, "../docs/CRM Shallpass - 📅 EOD Closer 2.0.csv");
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
        i++; // skip escaped quote
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
        if (ch === "\r") i++; // skip \n after \r
      } else {
        currentField += ch;
      }
    }
  }
  // Last row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.length > 1) rows.push(currentRow);
  }

  return rows;
}

// ── Mappers ──────────────────────────────────────────────

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
    // Excel date serial: days since 1900-01-01 (with the 1900 leap year bug)
    const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
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
  console.log(`\n📋 Shallpass Lead Import`);
  console.log(`   Client: ${CLIENT_ID}`);
  console.log(`   CSV: ${CSV_PATH}`);
  console.log(`   Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

  const content = fs.readFileSync(CSV_PATH, "utf-8");
  const rows = parseCSV(content);

  // The header spans multiple lines due to quoted newlines — find actual header fields
  // Based on the CSV structure, the columns are:
  // 0: Fecha de Agenda
  // 1: Fecha ingreso
  // 2: Nombre
  // 3: Calendario
  // 4: Closer
  // 5: Fecha Agenda (repeat)
  // 6: Pais
  // 7: GRUPO Respuestas de Formulario
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
  // 21: Asistencia
  // 22: Estado Post Llamada
  // 23: Fecha 2da Llamada
  // 24: Calidad Lead
  // 25: Ingreso Total
  // 26: COBRO
  // 27: Comentario
  // 28-32: Día, Semana, Mes, Año, MesAño

  // Skip header row (first row parsed)
  const dataRows = rows.slice(1);

  // Deduplicate by email (keep last occurrence — most recent data)
  const seenEmails = new Map<string, number>();
  const deduped: string[][] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const email = (row[8] || "").toLowerCase().trim();
    if (email && seenEmails.has(email)) {
      // Replace previous occurrence with this one (keep latest)
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

  for (const row of deduped) {
    const name = (row[2] || "").trim();
    if (!name) {
      skipped++;
      continue;
    }

    const scheduledDateRaw = row[0] || "";
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

    const qualification = mapQualification(row[20] || "");
    const attendance = parseAttendance(row[21] || "");
    const postCallStatus = mapPostCallStatus(row[22] || "");
    const qualityScore = mapQualityScore(row[24] || "");
    const revenue = parseRevenue(row[25] || "");
    const cobro = (row[26] || "").trim();
    const comment = (row[27] || "").trim();

    const scheduledDate = parseDate(scheduledDateRaw);
    const createdAt = parseDate(entryDateRaw) || scheduledDate || new Date().toISOString();
    const now = new Date().toISOString();

    const closerComments = [comment, cobro ? `Cobro: ${cobro}` : ""]
      .filter(Boolean)
      .join(" | ") || undefined;

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
      closerComments,
      source: "csv_import" as const,
      createdAt,
      updatedAt: now,
      qualifiedAt: qualification !== "pending" ? createdAt : undefined,
    };

    // Remove undefined fields (Firestore doesn't like explicit undefined)
    for (const key of Object.keys(lead)) {
      if (lead[key] === undefined) delete lead[key];
    }

    leads.push(lead);
  }

  console.log(`   Leads to import: ${leads.length}`);
  console.log(`   Skipped (no name): ${skipped}\n`);

  // Stats
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
  console.log(`      Revenue Total: $${stats.totalRevenue.toLocaleString()}\n`);

  if (DRY_RUN) {
    console.log("   🏁 Dry run complete. No data written.\n");
    // Print first 3 leads as sample
    console.log("   Sample leads:");
    for (const lead of leads.slice(0, 3)) {
      console.log(`     - ${lead.name} | ${lead.qualification} | ${lead.postCallStatus} | $${lead.revenue}`);
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
      const docRef = db.collection("leads").doc(); // auto-ID
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
