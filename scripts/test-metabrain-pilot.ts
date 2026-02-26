/**
 * Test MetaBrain with Pilot Client
 *
 * Valida que MetaBrain puede leer correctamente de la nueva estructura
 * dashbo_snapshots y generar ChannelSignals.
 */

// CRITICAL: Load env vars FIRST before any Firebase imports
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables synchronously
const envPath = path.join(__dirname, '../.env.local');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('❌ Error loading .env.local:', result.error);
  process.exit(1);
}

// Verify critical Firebase vars are loaded
if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
  console.error('❌ Missing Firebase credentials in .env.local');
  console.error('Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
  process.exit(1);
}

console.log('✅ Environment variables loaded');
console.log(`   Project ID: ${process.env.FIREBASE_PROJECT_ID}\n`);

// NOW safe to import modules that use Firebase
import { MetaBrain } from '../src/lib/meta-brain';
import { buildDateRanges } from '../src/lib/date-utils';
import type { Client } from '../src/types';

const PILOT_CLIENT_ID = 'zPIorY5SDvoUQ1zTEFqi';
const PILOT_CLIENT_NAME = 'Alma Colchones';

async function testMetaBrain() {
  console.log('\n🧪 TESTING METABRAIN CON CLIENTE PILOTO');
  console.log('═'.repeat(80));
  console.log(`Cliente: ${PILOT_CLIENT_NAME}`);
  console.log(`ID: ${PILOT_CLIENT_ID}`);
  console.log('═'.repeat(80) + '\n');

  try {
    // 1. Crear instancia de MetaBrain
    const metaBrain = new MetaBrain();
    console.log('✅ MetaBrain instanciado\n');

    // 2. Construir date range (yesterday = 2026-02-24 si hoy es 2026-02-25)
    const dateRanges = buildDateRanges();
    console.log(`📅 Date Range: ${dateRanges.yesterday.startDate} → ${dateRanges.yesterday.endDate}\n`);

    // 3. Mock client config (mínimo requerido)
    const mockClient: Partial<Client> = {
      id: PILOT_CLIENT_ID,
      name: PILOT_CLIENT_NAME,
      slug: 'alma-colchones',
      active: true,
      businessType: 'ecommerce',
      isEcommerce: true,
      isGoogle: false,
      targetCpa: 50,
      targetRoas: 3,
      timezone: 'America/Argentina/Buenos_Aires'
    };

    // 4. Ejecutar análisis
    console.log('🔄 Ejecutando MetaBrain.analyze()...\n');
    const signals = await metaBrain.analyze(
      PILOT_CLIENT_ID,
      dateRanges.yesterday,
      mockClient as Client
    );

    // 5. Mostrar resultados
    console.log('✅ ANÁLISIS COMPLETADO\n');
    console.log('═'.repeat(80));
    console.log('📊 CHANNEL SIGNALS');
    console.log('═'.repeat(80));
    console.log(`Canal: ${signals.canal}`);
    console.log(`Date Range: ${signals.dateRange.start} → ${signals.dateRange.end}`);
    console.log(`\n💰 KPIs:`);
    console.log(`  - Costo: $${signals.kpis.costo?.toFixed(2) || 'N/A'}`);
    console.log(`  - Ingresos: $${signals.kpis.ingresos?.toFixed(2) || 'N/A'}`);
    console.log(`  - ROAS: ${signals.kpis.roas?.toFixed(2)}x` || 'N/A');
    console.log(`  - CPA: $${signals.kpis.cpa?.toFixed(2) || 'N/A'}`);
    console.log(`  - Conversiones: ${signals.kpis.conversiones || 'N/A'}`);
    console.log(`  - Clicks: ${signals.kpis.clicks || 'N/A'}`);
    console.log(`  - Impresiones: ${signals.kpis.impresiones || 'N/A'}`);
    console.log(`  - CTR: ${signals.kpis.ctr?.toFixed(2)}%` || 'N/A');

    console.log(`\n🚨 Alertas: ${signals.alerts.length}`);
    if (signals.alerts.length > 0) {
      signals.alerts.forEach((alert, i) => {
        console.log(`  ${i + 1}. [${alert.severity}] ${alert.type}`);
        console.log(`     ${alert.message}`);
      });
    } else {
      console.log('  (Sin alertas)');
    }

    console.log(`\n📡 Signals para Master Brain:`);
    console.log(`  - meta_roas: ${signals.signals.meta_roas}`);
    console.log(`  - meta_cpa: ${signals.signals.meta_cpa}`);
    console.log(`  - meta_frecuencia_promedio: ${signals.signals.meta_frecuencia_promedio}`);
    console.log(`  - meta_pixel_purchases: ${signals.signals.meta_pixel_purchases}`);
    console.log(`  - meta_has_bleeding_campaigns: ${signals.signals.meta_has_bleeding_campaigns}`);
    console.log(`  - meta_has_scaling_opportunities: ${signals.signals.meta_has_scaling_opportunities}`);

    console.log(`\n🔍 Data Quality:`);
    console.log(`  - Confidence: ${signals.dataQuality.confidence}`);
    console.log(`  - Fields with null: ${signals.dataQuality.fieldsWithNull.join(', ') || 'Ninguno'}`);

    console.log('\n═'.repeat(80));
    console.log('✅ TEST EXITOSO: MetaBrain lee correctamente de dashbo_snapshots\n');

    return true;

  } catch (error) {
    console.error('\n❌ ERROR EN TEST:');
    console.error(error);
    return false;
  }
}

// Ejecutar test
testMetaBrain()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Error fatal:', error);
    process.exit(1);
  });
