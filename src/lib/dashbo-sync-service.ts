/**
 * Dashbo Sync Service
 *
 * Automatically syncs client integrations from Dashbo (single source of truth)
 * to local Firebase clients collection.
 *
 * Detects which data sources each client has configured in Dashbo:
 * - Meta Ads (Facebook/Instagram)
 * - Google Ads
 * - GA4 (Google Analytics 4)
 * - Ecommerce (TiendaNube/Shopify)
 * - Email (Klaviyo/Perfit) - future
 *
 * This eliminates manual checkbox management in admin UI.
 */

import { db } from '@/lib/firebase-admin';

// Dashbo MCP tool types (inferred from tool responses)
interface DashboClient {
  id: number;
  name: string;
  active: boolean;
}

interface DashboClientFields {
  client_id: number;
  client_name: string;
  client_data_sources: string[];
  fields: any[];
  business_units: any[];
}

interface SyncResult {
  success: boolean;
  synced: number;
  errors: number;
  details: Array<{
    clientId: string;
    clientName: string;
    status: 'synced' | 'error' | 'no_match';
    integrations?: any;
    error?: string;
  }>;
}

export class DashboSyncService {
  /**
   * Sync all clients from Dashbo to local Firestore
   */
  static async syncAllClients(): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      synced: 0,
      errors: 0,
      details: []
    };

    try {
      console.log('[DashboSync] Starting sync...');

      // 1. Get all clients from Dashbo
      const dashboClients = await this.getDashboClients();
      console.log(`[DashboSync] Found ${dashboClients.length} Dashbo clients`);

      // 2. Get all local clients
      const localClientsSnap = await db.collection('clients').get();
      const localClientsMap = new Map<string, any>();

      localClientsSnap.forEach(doc => {
        const data = doc.data();
        // Map by name (normalized for matching)
        const normalizedName = this.normalizeName(data.name);
        localClientsMap.set(normalizedName, { id: doc.id, ...data });
      });

      console.log(`[DashboSync] Found ${localClientsMap.size} local clients`);

      // 3. For each Dashbo client, detect integrations and update local client
      for (const dashboClient of dashboClients) {
        try {
          const normalizedName = this.normalizeName(dashboClient.name);
          const localClient = localClientsMap.get(normalizedName);

          if (!localClient) {
            result.details.push({
              clientId: `dashbo_${dashboClient.id}`,
              clientName: dashboClient.name,
              status: 'no_match'
            });
            continue;
          }

          // Get data sources for this client
          const clientFields = await this.getDashboClientFields(dashboClient.id);

          // Map data sources to integrations
          const integrations = this.mapDataSourcesToIntegrations(
            clientFields.client_data_sources
          );

          // Update Firestore
          await db.collection('clients').doc(localClient.id).update({
            integraciones: integrations,
            dashboClientId: dashboClient.id, // Store for future reference
            lastDashboSync: new Date().toISOString()
          });

          result.synced++;
          result.details.push({
            clientId: localClient.id,
            clientName: dashboClient.name,
            status: 'synced',
            integrations
          });

          console.log(`[DashboSync] ✅ Synced ${dashboClient.name} → ${integrations}`);

        } catch (error: any) {
          result.errors++;
          result.details.push({
            clientId: `dashbo_${dashboClient.id}`,
            clientName: dashboClient.name,
            status: 'error',
            error: error.message
          });
          console.error(`[DashboSync] ❌ Error syncing ${dashboClient.name}:`, error);
        }
      }

      console.log(`[DashboSync] Sync complete: ${result.synced} synced, ${result.errors} errors`);

      return result;

    } catch (error: any) {
      console.error('[DashboSync] Fatal error:', error);
      return {
        success: false,
        synced: 0,
        errors: 1,
        details: [{
          clientId: 'unknown',
          clientName: 'unknown',
          status: 'error',
          error: error.message
        }]
      };
    }
  }

  /**
   * Sync a single client by ID
   */
  static async syncSingleClient(clientId: string): Promise<boolean> {
    try {
      const clientDoc = await db.collection('clients').doc(clientId).get();

      if (!clientDoc.exists) {
        throw new Error(`Client ${clientId} not found`);
      }

      const clientData = clientDoc.data();
      const dashboClientId = clientData?.dashboClientId;

      if (!dashboClientId) {
        throw new Error(`Client ${clientId} has no dashboClientId mapping`);
      }

      // Get data sources from Dashbo
      const clientFields = await this.getDashboClientFields(dashboClientId);

      // Map to integrations
      const integrations = this.mapDataSourcesToIntegrations(
        clientFields.client_data_sources
      );

      // Update Firestore
      await db.collection('clients').doc(clientId).update({
        integraciones: integrations,
        lastDashboSync: new Date().toISOString()
      });

      console.log(`[DashboSync] ✅ Synced single client ${clientData.name}`);
      return true;

    } catch (error: any) {
      console.error(`[DashboSync] Error syncing client ${clientId}:`, error);
      return false;
    }
  }

  /**
   * Map Dashbo data sources to our integrations schema
   */
  private static mapDataSourcesToIntegrations(dataSources: string[]): any {
    return {
      meta: dataSources.includes('SOURCE_FACEBOOK_ADS'),
      google: dataSources.includes('SOURCE_GOOGLE_ADS'),
      ga4: dataSources.includes('SOURCE_GA4'),
      ecommerce: this.detectEcommerceProvider(dataSources),
      email: this.detectEmailProvider(dataSources)
    };
  }

  /**
   * Detect ecommerce platform from data sources
   */
  private static detectEcommerceProvider(dataSources: string[]): 'tiendanube' | 'shopify' | null {
    if (dataSources.includes('SOURCE_TIENDA_NUBE')) {
      return 'tiendanube';
    }
    if (dataSources.includes('SOURCE_SHOPIFY')) {
      return 'shopify';
    }
    return null;
  }

  /**
   * Detect email platform from data sources (future)
   */
  private static detectEmailProvider(dataSources: string[]): 'klaviyo' | 'perfit' | null {
    if (dataSources.includes('SOURCE_KLAVIYO')) {
      return 'klaviyo';
    }
    if (dataSources.includes('SOURCE_PERFIT')) {
      return 'perfit';
    }
    return null;
  }

  /**
   * Normalize client name for matching (lowercase, remove accents, trim)
   */
  private static normalizeName(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9\s]/g, '') // Remove special chars
      .trim();
  }

  /**
   * Get all clients from Dashbo via MCP
   */
  private static async getDashboClients(): Promise<DashboClient[]> {
    // This will be called via MCP tool in the API route
    // For now, return type definition
    throw new Error('getDashboClients must be called via MCP tool');
  }

  /**
   * Get client data sources from Dashbo via MCP
   */
  private static async getDashboClientFields(clientId: number): Promise<DashboClientFields> {
    // This will be called via MCP tool in the API route
    // For now, return type definition
    throw new Error('getDashboClientFields must be called via MCP tool');
  }
}
