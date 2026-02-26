/**
 * Pilot Migration Script — Worker Brain V2
 *
 * Migra UN SOLO CLIENTE de daily_entity_snapshots → dashbo_snapshots
 * para validar la nueva estructura antes de migrar toda la DB.
 *
 * Cliente Piloto: Almacén de Colchones
 * Días a migrar: 7-14 días (configurable)
 *
 * Seguridad:
 * - NO destructivo: mantiene daily_entity_snapshots intacto
 * - Solo escribe a dashbo_snapshots (nueva estructura)
 * - Incluye validación automática
 * - Puede ejecutarse múltiples veces (idempotente)
 *
 * Uso:
 * ```bash
 * # Migrar 7 días para Almacén de Colchones
 * npx ts-node scripts/migrate-pilot-client.ts --clientId=<ID> --days=7
 *
 * # Migrar 14 días con modo dry-run (no escribe)
 * npx ts-node scripts/migrate-pilot-client.ts --clientId=<ID> --days=14 --dry-run
 *
 * # Validar migración existente
 * npx ts-node scripts/migrate-pilot-client.ts --clientId=<ID> --validate-only
 * ```
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { DailyEntitySnapshot } from '../src/types/performance-snapshots';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Inicializar Firebase Admin
if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    })
  });
}

const db = admin.firestore();

interface MigrationConfig {
  clientId: string;
  clientName: string;
  days: number;
  dryRun: boolean;
  validateOnly: boolean;
}

interface MigrationStats {
  totalSnapshots: number;
  datesProcessed: string[];
  snapshotsPerDate: Record<string, number>;
  snapshotsPerLevel: Record<string, number>;
  errors: string[];
  startTime: number;
  endTime?: number;
}

/**
 * Script principal de migración
 */
async function migratePilotClient(config: MigrationConfig): Promise<void> {
  console.log('\n🚀 Worker Brain V2 — Pilot Migration');
  console.log('═'.repeat(60));
  console.log(`Cliente: ${config.clientName}`);
  console.log(`ClientId: ${config.clientId}`);
  console.log(`Días a migrar: ${config.days}`);
  console.log(`Modo: ${config.dryRun ? 'DRY RUN (no escribe)' : 'PRODUCCIÓN'}`);
  console.log('═'.repeat(60) + '\n');

  if (config.validateOnly) {
    await validateMigration(config);
    return;
  }

  const stats: MigrationStats = {
    totalSnapshots: 0,
    datesProcessed: [],
    snapshotsPerDate: {},
    snapshotsPerLevel: { account: 0, campaign: 0, adset: 0, ad: 0 },
    errors: [],
    startTime: Date.now()
  };

  try {
    // 1. Obtener las fechas a migrar
    const dates = getLastNDays(config.days);
    console.log(`📅 Fechas a migrar: ${dates[0]} → ${dates[dates.length - 1]}\n`);

    // 2. Migrar cada fecha
    for (const date of dates) {
      console.log(`\n📦 Procesando fecha: ${date}`);
      await migrateDate(config.clientId, date, stats, config.dryRun);
    }

    stats.endTime = Date.now();

    // 3. Mostrar resumen
    printSummary(stats, config);

    // 4. Validar migración (si no es dry-run)
    if (!config.dryRun && stats.errors.length === 0) {
      console.log('\n\n🔍 Validando migración...\n');
      await validateMigration(config);
    }

  } catch (error) {
    console.error('\n❌ Error fatal en migración:', error);
    stats.errors.push(`Error fatal: ${error}`);
  }
}

/**
 * Migrar una fecha específica
 */
async function migrateDate(
  clientId: string,
  date: string,
  stats: MigrationStats,
  dryRun: boolean
): Promise<void> {
  // Leer snapshots de daily_entity_snapshots para esta fecha
  const snapshot = await db.collection('daily_entity_snapshots')
    .where('clientId', '==', clientId)
    .where('date', '==', date)
    .get();

  if (snapshot.empty) {
    console.log(`  ⚠️  Sin datos para ${date}`);
    return;
  }

  const snapshots = snapshot.docs.map(d => d.data() as DailyEntitySnapshot);
  console.log(`  ✓ Leídos: ${snapshots.length} snapshots`);

  // Agrupar por nivel
  const grouped = {
    account: snapshots.filter(s => s.level === 'account'),
    campaign: snapshots.filter(s => s.level === 'campaign'),
    adset: snapshots.filter(s => s.level === 'adset'),
    ad: snapshots.filter(s => s.level === 'ad')
  };

  console.log(`    - Account: ${grouped.account.length}`);
  console.log(`    - Campaign: ${grouped.campaign.length}`);
  console.log(`    - Adset: ${grouped.adset.length}`);
  console.log(`    - Ad: ${grouped.ad.length}`);

  // Escribir a nueva estructura
  if (!dryRun) {
    const docRef = db.doc(`dashbo_snapshots/${clientId}/${date}/meta`);

    await docRef.set({
      account: grouped.account,
      campaign: grouped.campaign,
      adset: grouped.adset,
      ad: grouped.ad,
      migratedAt: new Date().toISOString(),
      migratedBy: 'migrate-pilot-client.ts',
      sourceCollection: 'daily_entity_snapshots'
    });

    console.log(`  ✅ Escrito a: dashbo_snapshots/${clientId}/${date}/meta`);
  } else {
    console.log(`  🔄 DRY RUN: Se escribiría a dashbo_snapshots/${clientId}/${date}/meta`);
  }

  // Actualizar stats
  stats.totalSnapshots += snapshots.length;
  stats.datesProcessed.push(date);
  stats.snapshotsPerDate[date] = snapshots.length;
  stats.snapshotsPerLevel.account += grouped.account.length;
  stats.snapshotsPerLevel.campaign += grouped.campaign.length;
  stats.snapshotsPerLevel.adset += grouped.adset.length;
  stats.snapshotsPerLevel.ad += grouped.ad.length;
}

/**
 * Validar que la migración fue exitosa
 */
async function validateMigration(config: MigrationConfig): Promise<void> {
  console.log('\n🔍 VALIDACIÓN DE MIGRACIÓN');
  console.log('═'.repeat(60));

  const dates = getLastNDays(config.days);
  let allValid = true;

  for (const date of dates) {
    // Leer de estructura antigua
    const oldSnapshot = await db.collection('daily_entity_snapshots')
      .where('clientId', '==', config.clientId)
      .where('date', '==', date)
      .get();

    const oldCount = oldSnapshot.size;

    // Leer de estructura nueva
    const newDoc = await db.doc(`dashbo_snapshots/${config.clientId}/${date}/meta`).get();

    if (!newDoc.exists) {
      console.log(`❌ ${date}: Documento nuevo NO existe (esperado: ${oldCount} snapshots)`);
      allValid = false;
      continue;
    }

    const newData = newDoc.data();
    const newCount =
      (newData?.account?.length || 0) +
      (newData?.campaign?.length || 0) +
      (newData?.adset?.length || 0) +
      (newData?.ad?.length || 0);

    if (oldCount === newCount) {
      console.log(`✅ ${date}: ${oldCount} snapshots → ${newCount} snapshots (OK)`);
    } else {
      console.log(`❌ ${date}: ${oldCount} snapshots → ${newCount} snapshots (DIFERENCIA!)`);
      allValid = false;
    }
  }

  console.log('═'.repeat(60));
  if (allValid) {
    console.log('✅ VALIDACIÓN EXITOSA: Todos los datos migrados correctamente\n');
  } else {
    console.log('❌ VALIDACIÓN FALLIDA: Hay diferencias en los datos\n');
  }
}

/**
 * Obtener los últimos N días (YYYY-MM-DD)
 */
function getLastNDays(n: number): string[] {
  const dates: string[] = [];
  const today = new Date();

  for (let i = 0; i < n; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    dates.push(`${year}-${month}-${day}`);
  }

  return dates.reverse(); // Más antiguo primero
}

/**
 * Imprimir resumen de la migración
 */
function printSummary(stats: MigrationStats, config: MigrationConfig): void {
  const duration = stats.endTime ? (stats.endTime - stats.startTime) / 1000 : 0;

  console.log('\n\n📊 RESUMEN DE MIGRACIÓN');
  console.log('═'.repeat(60));
  console.log(`Cliente: ${config.clientName} (${config.clientId})`);
  console.log(`Duración: ${duration.toFixed(2)}s`);
  console.log(`\nSnapshots Totales: ${stats.totalSnapshots}`);
  console.log(`Fechas Procesadas: ${stats.datesProcessed.length}`);
  console.log(`\nPor Nivel:`);
  console.log(`  - Account: ${stats.snapshotsPerLevel.account}`);
  console.log(`  - Campaign: ${stats.snapshotsPerLevel.campaign}`);
  console.log(`  - Adset: ${stats.snapshotsPerLevel.adset}`);
  console.log(`  - Ad: ${stats.snapshotsPerLevel.ad}`);

  console.log(`\nPor Fecha:`);
  for (const date of stats.datesProcessed) {
    console.log(`  - ${date}: ${stats.snapshotsPerDate[date]} snapshots`);
  }

  if (stats.errors.length > 0) {
    console.log(`\n⚠️  Errores (${stats.errors.length}):`);
    stats.errors.forEach(err => console.log(`  - ${err}`));
  }

  console.log('═'.repeat(60) + '\n');
}

/**
 * Parsear argumentos de línea de comando
 */
function parseArgs(): MigrationConfig | null {
  const args = process.argv.slice(2);

  const config: MigrationConfig = {
    clientId: '',
    clientName: 'Almacén de Colchones',
    days: 7,
    dryRun: false,
    validateOnly: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--clientId=')) {
      config.clientId = arg.split('=')[1];
    } else if (arg === '--clientId' && args[i + 1]) {
      config.clientId = args[i + 1];
      i++;
    } else if (arg.startsWith('--clientName=')) {
      config.clientName = arg.split('=')[1].replace(/"/g, '');
    } else if (arg === '--clientName' && args[i + 1]) {
      config.clientName = args[i + 1].replace(/"/g, '');
      i++;
    } else if (arg.startsWith('--days=')) {
      config.days = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--days' && args[i + 1]) {
      config.days = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === '--dry-run') {
      config.dryRun = true;
    } else if (arg === '--validate-only') {
      config.validateOnly = true;
    }
  }

  if (!config.clientId) {
    console.error('❌ Error: --clientId es requerido\n');
    printUsage();
    return null;
  }

  return config;
}

/**
 * Imprimir instrucciones de uso
 */
function printUsage(): void {
  console.log('Uso:');
  console.log('  npx ts-node scripts/migrate-pilot-client.ts \\');
  console.log('    --clientId=<ID> \\');
  console.log('    [--clientName="Nombre del Cliente"] \\');
  console.log('    [--days=7] \\');
  console.log('    [--dry-run] \\');
  console.log('    [--validate-only]');
  console.log('\nEjemplos:');
  console.log('  # Migrar 7 días (producción)');
  console.log('  npx ts-node scripts/migrate-pilot-client.ts --clientId=abc123 --days=7');
  console.log('\n  # Dry run (no escribe)');
  console.log('  npx ts-node scripts/migrate-pilot-client.ts --clientId=abc123 --days=7 --dry-run');
  console.log('\n  # Solo validar');
  console.log('  npx ts-node scripts/migrate-pilot-client.ts --clientId=abc123 --validate-only');
}

/**
 * Punto de entrada
 */
async function main() {
  const config = parseArgs();

  if (!config) {
    process.exit(1);
  }

  await migratePilotClient(config);
}

// Ejecutar script
main()
  .then(() => {
    console.log('✅ Script finalizado\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
