/**
 * Check Rolling Metrics — Debug Script
 *
 * Verifica si existen entity_rolling_metrics para el cliente piloto
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { db } from '../src/lib/firebase-admin';

const PILOT_CLIENT_ID = 'zPIorY5SDvoUQ1zTEFqi';

async function checkRollingMetrics() {
  console.log('\n🔍 CHECKING ENTITY_ROLLING_METRICS');
  console.log('═'.repeat(80));
  console.log(`Cliente: ${PILOT_CLIENT_ID}\n`);

  try {
    // Check account-level rolling metrics
    const accountSnapshot = await db.collection('entity_rolling_metrics')
      .where('clientId', '==', PILOT_CLIENT_ID)
      .where('level', '==', 'account')
      .limit(1)
      .get();

    if (accountSnapshot.empty) {
      console.log('❌ No account-level rolling metrics found');
      console.log('   This means ClientSnapshotService has not computed metrics yet.\n');
      return;
    }

    const accountDoc = accountSnapshot.docs[0];
    const accountData = accountDoc.data();

    console.log('✅ Account-level rolling metrics found');
    console.log(`   Entity ID: ${accountData.entityId}`);
    console.log(`   Updated: ${accountData.updatedAt}\n`);

    console.log('📊 Rolling Metrics (7 days):');
    const r = accountData.rolling || {};
    console.log(`   - Spend: $${r.spend_7d?.toFixed(2) || 'N/A'}`);
    console.log(`   - Revenue: $${r.purchase_value_7d?.toFixed(2) || 'N/A'}`);
    console.log(`   - ROAS: ${r.roas_7d?.toFixed(2) || 'N/A'}x`);
    console.log(`   - CPA: $${r.cpa_7d?.toFixed(2) || 'N/A'}`);
    console.log(`   - Purchases: ${r.purchases_7d || 'N/A'}`);
    console.log(`   - Leads: ${r.leads_7d || 'N/A'}`);
    console.log(`   - WhatsApp: ${r.whatsapp_7d || 'N/A'}`);
    console.log(`   - Clicks: ${r.link_clicks_7d || 'N/A'}`);
    console.log(`   - Impressions: ${r.impressions_7d || 'N/A'}`);
    console.log(`   - CTR: ${r.ctr_7d?.toFixed(2) || 'N/A'}%`);
    console.log(`   - Frequency: ${r.frequency_7d?.toFixed(2) || 'N/A'}x`);

    // Count all rolling metrics
    const allSnapshot = await db.collection('entity_rolling_metrics')
      .where('clientId', '==', PILOT_CLIENT_ID)
      .get();

    const byLevel = {
      account: 0,
      campaign: 0,
      adset: 0,
      ad: 0
    };

    allSnapshot.docs.forEach(doc => {
      const level = doc.data().level as keyof typeof byLevel;
      if (level in byLevel) byLevel[level]++;
    });

    console.log(`\n📈 Total rolling metrics: ${allSnapshot.size}`);
    console.log(`   - Account: ${byLevel.account}`);
    console.log(`   - Campaign: ${byLevel.campaign}`);
    console.log(`   - Adset: ${byLevel.adset}`);
    console.log(`   - Ad: ${byLevel.ad}`);

    console.log('\n═'.repeat(80));
    console.log('✅ Rolling metrics exist and are populated\n');

  } catch (error) {
    console.error('❌ Error checking rolling metrics:', error);
  }
}

checkRollingMetrics()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
