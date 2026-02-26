/**
 * Dashbo Sync API
 *
 * POST /api/admin/sync-dashbo
 *
 * Syncs client integrations from Dashbo to local Firestore.
 * Dashbo is the single source of truth for which data sources each client has.
 *
 * Query params:
 * - clientId: (optional) sync a single client by Firebase ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

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

interface SyncDetail {
  clientId: string;
  clientName: string;
  status: 'synced' | 'error' | 'no_match' | 'skipped';
  integrations?: any;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const singleClientId = searchParams.get('clientId');

    console.log('[DashboSync] Starting sync...');

    // Single client sync
    if (singleClientId) {
      return await syncSingleClient(singleClientId);
    }

    // Full sync
    return await syncAllClients();

  } catch (error: any) {
    console.error('[DashboSync] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Sync all clients
 */
async function syncAllClients() {
  const result = {
    success: true,
    synced: 0,
    errors: 0,
    noMatch: 0,
    details: [] as SyncDetail[]
  };

  try {
    // 1. Get all clients from Dashbo (via MCP tool)
    const dashboResponse = await fetch('http://localhost:3000/api/dashbo/list-clients', {
      method: 'GET'
    });

    if (!dashboResponse.ok) {
      throw new Error(`Failed to fetch Dashbo clients: ${dashboResponse.statusText}`);
    }

    const dashboData = await dashboResponse.json();
    const dashboClients: DashboClient[] = dashboData.clients;

    console.log(`[DashboSync] Found ${dashboClients.length} Dashbo clients`);

    // 2. Get all local clients
    const localClientsSnap = await db.collection('clients').get();
    const localClientsMap = new Map<string, any>();

    localClientsSnap.forEach(doc => {
      const data = doc.data();
      const normalizedName = normalizeName(data.name);
      localClientsMap.set(normalizedName, { id: doc.id, ...data });
    });

    console.log(`[DashboSync] Found ${localClientsMap.size} local clients`);

    // 3. For each Dashbo client, sync integrations
    for (const dashboClient of dashboClients) {
      try {
        const normalizedName = normalizeName(dashboClient.name);
        const localClient = localClientsMap.get(normalizedName);

        if (!localClient) {
          result.noMatch++;
          result.details.push({
            clientId: `dashbo_${dashboClient.id}`,
            clientName: dashboClient.name,
            status: 'no_match'
          });
          console.log(`[DashboSync] ⚠️  No local match for "${dashboClient.name}"`);
          continue;
        }

        // Skip inactive clients
        if (!dashboClient.active) {
          result.details.push({
            clientId: localClient.id,
            clientName: dashboClient.name,
            status: 'skipped'
          });
          console.log(`[DashboSync] ⏭️  Skipped inactive client "${dashboClient.name}"`);
          continue;
        }

        // Get data sources for this client (via MCP tool)
        const fieldsResponse = await fetch(
          `http://localhost:3000/api/dashbo/client-fields?clientId=${dashboClient.id}`,
          { method: 'GET' }
        );

        if (!fieldsResponse.ok) {
          throw new Error(`Failed to fetch fields for ${dashboClient.name}`);
        }

        const fieldsData: DashboClientFields = await fieldsResponse.json();

        // Map data sources to integrations
        const integrations = mapDataSourcesToIntegrations(fieldsData.client_data_sources);

        // Update Firestore
        await db.collection('clients').doc(localClient.id).update({
          integraciones: integrations,
          dashboClientId: dashboClient.id,
          dashboClientName: dashboClient.name,
          lastDashboSync: new Date().toISOString()
        });

        result.synced++;
        result.details.push({
          clientId: localClient.id,
          clientName: dashboClient.name,
          status: 'synced',
          integrations
        });

        console.log(`[DashboSync] ✅ Synced "${dashboClient.name}" → ${JSON.stringify(integrations)}`);

      } catch (error: any) {
        result.errors++;
        result.details.push({
          clientId: `dashbo_${dashboClient.id}`,
          clientName: dashboClient.name,
          status: 'error',
          error: error.message
        });
        console.error(`[DashboSync] ❌ Error syncing "${dashboClient.name}":`, error);
      }
    }

    console.log(`[DashboSync] Complete: ${result.synced} synced, ${result.noMatch} no match, ${result.errors} errors`);

    return NextResponse.json({
      success: true,
      message: 'Dashbo sync completed',
      ...result
    });

  } catch (error: any) {
    console.error('[DashboSync] Fatal error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Sync single client
 */
async function syncSingleClient(clientId: string) {
  try {
    const clientDoc = await db.collection('clients').doc(clientId).get();

    if (!clientDoc.exists) {
      return NextResponse.json(
        { error: `Client ${clientId} not found` },
        { status: 404 }
      );
    }

    const clientData = clientDoc.data();
    const dashboClientId = clientData?.dashboClientId;

    if (!dashboClientId) {
      return NextResponse.json(
        { error: `Client ${clientId} has no dashboClientId mapping. Run full sync first.` },
        { status: 400 }
      );
    }

    // Get data sources from Dashbo
    const fieldsResponse = await fetch(
      `http://localhost:3000/api/dashbo/client-fields?clientId=${dashboClientId}`,
      { method: 'GET' }
    );

    if (!fieldsResponse.ok) {
      throw new Error(`Failed to fetch Dashbo fields: ${fieldsResponse.statusText}`);
    }

    const fieldsData: DashboClientFields = await fieldsResponse.json();

    // Map to integrations
    const integrations = mapDataSourcesToIntegrations(fieldsData.client_data_sources);

    // Update Firestore
    await db.collection('clients').doc(clientId).update({
      integraciones: integrations,
      lastDashboSync: new Date().toISOString()
    });

    console.log(`[DashboSync] ✅ Synced single client "${clientData.name}"`);

    return NextResponse.json({
      success: true,
      message: `Synced ${clientData.name}`,
      clientId,
      integrations
    });

  } catch (error: any) {
    console.error(`[DashboSync] Error syncing client ${clientId}:`, error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Map Dashbo data sources to our integrations schema
 */
function mapDataSourcesToIntegrations(dataSources: string[]) {
  return {
    meta: dataSources.includes('SOURCE_FACEBOOK_ADS'),
    google: dataSources.includes('SOURCE_GOOGLE_ADS'),
    ga4: dataSources.includes('SOURCE_GA4'),
    ecommerce: detectEcommerceProvider(dataSources),
    email: detectEmailProvider(dataSources)
  };
}

function detectEcommerceProvider(dataSources: string[]): 'tiendanube' | 'shopify' | null {
  if (dataSources.includes('SOURCE_TIENDA_NUBE')) return 'tiendanube';
  if (dataSources.includes('SOURCE_SHOPIFY')) return 'shopify';
  return null;
}

function detectEmailProvider(dataSources: string[]): 'klaviyo' | 'perfit' | null {
  if (dataSources.includes('SOURCE_KLAVIYO')) return 'klaviyo';
  if (dataSources.includes('SOURCE_PERFIT')) return 'perfit';
  return null;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .trim();
}
