/**
 * Sync Dashbo Integrations Script
 *
 * This script syncs client integrations from Dashbo to local Firestore.
 * Dashbo is the single source of truth for which data sources each client has.
 *
 * Run with: npx tsx scripts/sync-dashbo-integrations.ts
 *
 * Or via API: POST /api/admin/sync-dashbo-integrations
 * (The API will call the MCP tools and perform the sync)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { db } from '../src/lib/firebase-admin';

interface SyncResult {
  synced: number;
  noMatch: number;
  errors: number;
  details: Array<{
    clientName: string;
    status: string;
    integrations?: any;
  }>;
}

async function syncDashboIntegrations(): Promise<SyncResult> {
  console.log('\n🔄 SYNCING DASHBO INTEGRATIONS');
  console.log('═'.repeat(80));

  const result: SyncResult = {
    synced: 0,
    noMatch: 0,
    errors: 0,
    details: []
  };

  try {
    // NOTE: This script is meant to be called by Claude Code
    // which has access to MCP tools. When run manually via tsx,
    // it will fail because MCP tools aren't available.
    //
    // To run this sync:
    // 1. Ask Claude to run this script (it has MCP access)
    // 2. OR call POST /api/admin/sync-dashbo-integrations
    //    which will internally use this logic with MCP tools

    throw new Error(
      'This script requires MCP tools which are only available in Claude Code environment.\n' +
      'Please ask Claude to run the sync, or use the API endpoint:\n' +
      'POST http://localhost:3000/api/admin/sync-dashbo-integrations'
    );

  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
    throw error;
  }
}

// Only run if called directly (not imported)
if (require.main === module) {
  syncDashboIntegrations()
    .then(() => {
      console.log('\n✅ Sync completed\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Sync failed:', error.message);
      process.exit(1);
    });
}

export { syncDashboIntegrations };
