/**
 * Dashbo Integration Sync API
 *
 * GET /api/admin/sync-dashbo-integrations
 *
 * Syncs client integrations from Dashbo to Firestore using real MCP data.
 * This endpoint executes the sync using Next.js server credentials.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

// Real Dashbo data from MCP calls (8 clients verified)
const dashboIntegrations: Record<number, { name: string; aliases?: string[]; dataSources: string[] }> = {
  5839: {
    name: "Accuracy Solutions",
    dataSources: ["SOURCE_FACEBOOK_ADS", "SOURCE_GA4"]
  },
  7350: {
    name: "Aires",
    dataSources: ["SOURCE_FACEBOOK_ADS", "SOURCE_GOOGLE_ADS"]
  },
  5844: {
    name: "Blackhorn",
    dataSources: ["SOURCE_FACEBOOK_ADS", "SOURCE_GOOGLE_ADS", "SOURCE_TIENDA_NUBE"]
  },
  7334: {
    name: "Almacen de Colchones",
    aliases: ["Alma Colchones"],
    dataSources: ["SOURCE_FACEBOOK_ADS", "SOURCE_GA4", "SOURCE_GOOGLE_ADS", "SOURCE_TIENDA_NUBE"]
  },
  5858: {
    name: "Cambre",
    dataSources: ["SOURCE_FACEBOOK_ADS", "SOURCE_GA4", "SOURCE_GOOGLE_ADS"]
  },
  7337: {
    name: "CocoNude",
    aliases: ["Coconude"],
    dataSources: ["SOURCE_FACEBOOK_ADS", "SOURCE_GOOGLE_ADS"]
  },
  2847: {
    name: "Simonetta",
    dataSources: ["SOURCE_FACEBOOK_ADS"]
  },
  7335: {
    name: "Luvee",
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

export async function GET(request: NextRequest) {
  try {
    console.log('\n🔄 SYNCING DASHBO INTEGRATIONS');
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
      errors: 0,
      details: [] as any[]
    };

    // Sync each Dashbo client
    for (const [dashboClientId, dashboData] of Object.entries(dashboIntegrations)) {
      try {
        const normalizedName = normalizeName(dashboData.name);
        let localClient = localClientsMap.get(normalizedName);

        // Try aliases if primary name didn't match
        if (!localClient && dashboData.aliases) {
          for (const alias of dashboData.aliases) {
            localClient = localClientsMap.get(normalizeName(alias));
            if (localClient) break;
          }
        }

        if (!localClient) {
          results.noMatch++;
          results.details.push({
            dashboClientId,
            dashboClientName: dashboData.name,
            status: 'no_match'
          });
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
        results.details.push({
          firestoreId: localClient.id,
          dashboClientId,
          dashboClientName: dashboData.name,
          status: 'synced',
          integrations
        });

        console.log(`✅ SYNCED: "${dashboData.name}"`);
        console.log(`   Firestore ID: ${localClient.id}`);
        console.log(`   → Meta: ${integrations.meta}, Google: ${integrations.google}, GA4: ${integrations.ga4}, Ecommerce: ${integrations.ecommerce || 'none'}`);

      } catch (error: any) {
        results.errors++;
        results.details.push({
          dashboClientId,
          dashboClientName: dashboData.name,
          status: 'error',
          error: error.message
        });
        console.error(`❌ ERROR: "${dashboData.name}" - ${error.message}`);
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log(`✅ Synced: ${results.synced}`);
    console.log(`⚠️  No match: ${results.noMatch}`);
    console.log(`❌ Errors: ${results.errors}`);
    console.log('═'.repeat(80) + '\n');

    return NextResponse.json({
      success: true,
      message: `Synced ${results.synced} clients`,
      ...results
    });

  } catch (error: any) {
    console.error('[DashboSync] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
