/**
 * Quick Dashbo Sync Script
 *
 * Uses real Dashbo data fetched via MCP to populate integrations in Firestore.
 * This is a one-time sync to demonstrate the feature working.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { db } from '../src/lib/firebase-admin';

// Real data from Dashbo MCP calls
const dashboIntegrations = {
  5839: {  // Accuracy Solutions
    name: "Accuracy Solutions",
    dataSources: ["SOURCE_FACEBOOK_ADS", "SOURCE_GA4"]
  },
  7350: {  // Aires
    name: "Aires",
    dataSources: ["SOURCE_FACEBOOK_ADS", "SOURCE_GOOGLE_ADS"]
  },
  5844: {  // Blackhorn
    name: "Blackhorn",
    dataSources: ["SOURCE_FACEBOOK_ADS", "SOURCE_GOOGLE_ADS", "SOURCE_TIENDA_NUBE"]
  },
  7334: {  // Almacen de Colchones
    name: "Almacen de Colchones",
    dataSources: ["SOURCE_FACEBOOK_ADS", "SOURCE_GA4", "SOURCE_GOOGLE_ADS", "SOURCE_TIENDA_NUBE"]
  }
};

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function mapDataSourcesToIntegrations(dataSources: string[]) {
  return {
    meta: dataSources.includes('SOURCE_FACEBOOK_ADS'),
    google: dataSources.includes('SOURCE_GOOGLE_ADS'),
    ga4: dataSources.includes('SOURCE_GA4'),
    ecommerce:
      dataSources.includes('SOURCE_TIENDA_NUBE') ? 'tiendanube' :
      dataSources.includes('SOURCE_SHOPIFY') ? 'shopify' : null,
    email:
      dataSources.includes('SOURCE_KLAVIYO') ? 'klaviyo' :
      dataSources.includes('SOURCE_PERFIT') ? 'perfit' : null
  };
}

async function quickDashboSync() {
  console.log('\n🔄 QUICK DASHBO SYNC');
  console.log('═'.repeat(80));

  // Get all local clients
  const localClientsSnap = await db.collection('clients').get();
  const localClientsMap = new Map<string, any>();

  localClientsSnap.forEach(doc => {
    const data = doc.data();
    const normalizedName = normalizeName(data.name);
    localClientsMap.set(normalizedName, { id: doc.id, ...data });
  });

  console.log(`\n📂 Found ${localClientsMap.size} local clients`);
  console.log(`📊 Syncing ${Object.keys(dashboIntegrations).length} Dashbo clients\n`);

  const results = {
    synced: 0,
    noMatch: 0,
    errors: 0
  };

  // Sync each Dashbo client
  for (const [dashboClientId, dashboData] of Object.entries(dashboIntegrations)) {
    try {
      const normalizedName = normalizeName(dashboData.name);
      const localClient = localClientsMap.get(normalizedName);

      if (!localClient) {
        results.noMatch++;
        console.log(`⚠️  NO MATCH: "${dashboData.name}" (Dashbo ID: ${dashboClientId})`);
        continue;
      }

      const integrations = mapDataSourcesToIntegrations(dashboData.dataSources);

      // Update Firestore
      await db.collection('clients').doc(localClient.id).update({
        integraciones: integrations,
        dashboClientId: parseInt(dashboClientId),
        dashboClientName: dashboData.name,
        lastDashboSync: new Date().toISOString()
      });

      results.synced++;
      console.log(`✅ SYNCED: "${dashboData.name}"`);
      console.log(`   Firestore ID: ${localClient.id}`);
      console.log(`   → Meta: ${integrations.meta}, Google: ${integrations.google}, GA4: ${integrations.ga4}, Ecommerce: ${integrations.ecommerce || 'none'}`);

    } catch (error: any) {
      results.errors++;
      console.error(`❌ ERROR: "${dashboData.name}" - ${error.message}`);
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log(`✅ Synced: ${results.synced}`);
  console.log(`⚠️  No match: ${results.noMatch}`);
  console.log(`❌ Errors: ${results.errors}`);
  console.log('═'.repeat(80) + '\n');

  return results;
}

// Run if called directly
if (require.main === module) {
  quickDashboSync()
    .then(() => {
      console.log('✅ Quick sync completed\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Quick sync failed:', error.message);
      process.exit(1);
    });
}

export { quickDashboSync };
