/**
 * Update Client Integrations API
 *
 * POST /api/admin/update-client-integrations
 *
 * Body: {
 *   updates: [{
 *     dashboClientId: number,
 *     dashboClientName: string,
 *     integrations: {
 *       meta: boolean,
 *       google: boolean,
 *       ga4: boolean,
 *       ecommerce: 'tiendanube' | 'shopify' | null,
 *       email: 'klaviyo' | 'perfit' | null
 *     }
 *   }]
 * }
 *
 * Matches Dashbo clients to local clients by name and updates integrations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

interface ClientUpdate {
  dashboClientId: number;
  dashboClientName: string;
  integrations: {
    meta: boolean;
    google: boolean;
    ga4: boolean;
    ecommerce: 'tiendanube' | 'shopify' | null;
    email: 'klaviyo' | 'perfit' | null;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const updates: ClientUpdate[] = body.updates || [];

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: 'Missing or empty updates array' },
        { status: 400 }
      );
    }

    console.log(`[UpdateIntegrations] Processing ${updates.length} updates...`);

    // Get all local clients
    const localClientsSnap = await db.collection('clients').get();
    const localClientsMap = new Map<string, any>();

    localClientsSnap.forEach(doc => {
      const data = doc.data();
      const normalizedName = normalizeName(data.name);
      localClientsMap.set(normalizedName, { id: doc.id, ...data });
    });

    const results = {
      synced: 0,
      noMatch: 0,
      errors: 0,
      details: [] as any[]
    };

    // Process each update
    for (const update of updates) {
      try {
        const normalizedName = normalizeName(update.dashboClientName);
        const localClient = localClientsMap.get(normalizedName);

        if (!localClient) {
          results.noMatch++;
          results.details.push({
            clientName: update.dashboClientName,
            status: 'no_match'
          });
          console.log(`⚠️  No local match: "${update.dashboClientName}"`);
          continue;
        }

        // Update Firestore
        await db.collection('clients').doc(localClient.id).update({
          integraciones: update.integrations,
          dashboClientId: update.dashboClientId,
          dashboClientName: update.dashboClientName,
          lastDashboSync: new Date().toISOString()
        });

        results.synced++;
        results.details.push({
          clientId: localClient.id,
          clientName: update.dashboClientName,
          status: 'synced',
          integrations: update.integrations
        });

        console.log(`✅ Synced: "${update.dashboClientName}" → ${JSON.stringify(update.integrations)}`);

      } catch (error: any) {
        results.errors++;
        results.details.push({
          clientName: update.dashboClientName,
          status: 'error',
          error: error.message
        });
        console.error(`❌ Error: "${update.dashboClientName}" - ${error.message}`);
      }
    }

    console.log(`[UpdateIntegrations] Complete: ${results.synced} synced, ${results.noMatch} no match, ${results.errors} errors`);

    return NextResponse.json({
      success: true,
      message: `Synced ${results.synced} clients`,
      ...results
    });

  } catch (error: any) {
    console.error('[UpdateIntegrations] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}
