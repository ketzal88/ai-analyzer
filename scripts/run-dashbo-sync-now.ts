/**
 * Run Dashbo Sync NOW
 *
 * This script uses MCP tools to sync integrations from Dashbo to Firestore.
 * It's designed to be run by Claude Code which has access to MCP tools.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { db } from '../src/lib/firebase-admin';

interface DashboClient {
  id: number;
  name: string;
  active: boolean;
}

interface DashboClientFields {
  client_id: number;
  client_name: string;
  client_data_sources: string[];
}

interface LocalClient {
  id: string;
  name: string;
  slug: string;
  [key: string]: any;
}

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

export async function runDashboSync(
  dashboClients: DashboClient[],
  getDashboFields: (clientId: number) => Promise<DashboClientFields>
) {
  console.log('\n🔄 SYNCING DASHBO INTEGRATIONS');
  console.log('═'.repeat(80));
  console.log(`\n📊 Found ${dashboClients.length} Dashbo clients`);

  // Get all local clients
  const localClientsSnap = await db.collection('clients').get();
  const localClientsMap = new Map<string, LocalClient>();

  localClientsSnap.forEach(doc => {
    const data = doc.data() as LocalClient;
    data.id = doc.id;
    const normalizedName = normalizeName(data.name);
    localClientsMap.set(normalizedName, data);
  });

  console.log(`📂 Found ${localClientsMap.size} local clients\n`);

  const results = {
    synced: 0,
    noMatch: 0,
    skipped: 0,
    errors: 0
  };

  // Sync each Dashbo client
  for (const dashboClient of dashboClients) {
    try {
      const normalizedName = normalizeName(dashboClient.name);
      const localClient = localClientsMap.get(normalizedName);

      // No local match
      if (!localClient) {
        results.noMatch++;
        console.log(`⚠️  NO MATCH: "${dashboClient.name}" (Dashbo ID: ${dashboClient.id})`);
        continue;
      }

      // Skip inactive
      if (!dashboClient.active) {
        results.skipped++;
        console.log(`⏭️  SKIPPED: "${dashboClient.name}" (inactive)`);
        continue;
      }

      // Get data sources
      const fieldsData = await getDashboFields(dashboClient.id);
      const integrations = mapDataSourcesToIntegrations(fieldsData.client_data_sources);

      // Update Firestore
      await db.collection('clients').doc(localClient.id).update({
        integraciones: integrations,
        dashboClientId: dashboClient.id,
        dashboClientName: dashboClient.name,
        lastDashboSync: new Date().toISOString()
      });

      results.synced++;
      console.log(`✅ SYNCED: "${dashboClient.name}"`);
      console.log(`   → Meta: ${integrations.meta}, Google: ${integrations.google}, GA4: ${integrations.ga4}, Ecommerce: ${integrations.ecommerce || 'none'}`);

    } catch (error: any) {
      results.errors++;
      console.error(`❌ ERROR: "${dashboClient.name}" - ${error.message}`);
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log(`✅ Synced: ${results.synced}`);
  console.log(`⚠️  No match: ${results.noMatch}`);
  console.log(`⏭️  Skipped: ${results.skipped}`);
  console.log(`❌ Errors: ${results.errors}`);
  console.log('═'.repeat(80) + '\n');

  return results;
}
