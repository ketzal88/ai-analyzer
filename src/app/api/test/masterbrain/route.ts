/**
 * TEST API Route — MasterBrain Worker Brain V2
 *
 * Prueba end-to-end del flujo completo multi-canal:
 * 1. MasterBrain ejecuta los 4 Channel Brains
 * 2. Correlaciona señales cross-channel
 * 3. Genera análisis unificado
 * 4. Retorna JSON para inspección
 *
 * Usage: GET /api/test/masterbrain?clientId=zPIorY5SDvoUQ1zTEFqi
 */

import { NextRequest, NextResponse } from 'next/server';
import { MasterBrain } from '@/lib/master-brain';
import { buildDateRanges } from '@/lib/date-utils';
import { db } from '@/lib/firebase-admin';
import type { Client } from '@/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get('clientId');
    const dateOverride = searchParams.get('date'); // Optional: YYYY-MM-DD

    if (!clientId) {
      return NextResponse.json(
        { error: 'Missing clientId parameter' },
        { status: 400 }
      );
    }

    // 1. Fetch client from Firestore
    const clientDoc = await db.collection('clients').doc(clientId).get();
    if (!clientDoc.exists) {
      return NextResponse.json(
        { error: `Client not found: ${clientId}` },
        { status: 404 }
      );
    }

    const client = { id: clientDoc.id, ...clientDoc.data() } as Client;

    // Mock: Enable all integrations for testing
    const testClient = {
      ...client,
      integraciones: {
        meta: true,
        google: true,
        ga4: true,
        ecommerce: 'tiendanube' as const
      }
    };

    // 2. Build date range
    const dateRanges = buildDateRanges();
    let dateRange = dateRanges.yesterday;

    if (dateOverride) {
      dateRange = { start: dateOverride, end: dateOverride };
    }

    // 3. Execute MasterBrain analysis
    console.log(`[TEST] Running MasterBrain for ${client.name} (${clientId})`);
    console.log(`[TEST] Date range: ${dateRange.start} → ${dateRange.end}`);

    const masterBrain = new MasterBrain();
    const startTime = Date.now();

    const analysis = await masterBrain.analyze(clientId, dateRange, testClient);

    const duration = Date.now() - startTime;

    // 4. Build response
    return NextResponse.json({
      success: true,
      test: 'MasterBrain Worker Brain V2',
      client: {
        id: client.id,
        name: client.name,
        slug: client.slug
      },
      dateRange,
      duration: `${duration}ms`,
      analysis,
      summary: {
        channelsAnalyzed: Object.keys(analysis.channels),
        blendedRoas: analysis.unified.blendedRoas,
        totalRevenue: analysis.unified.totalRevenue,
        crossChannelAlertsCount: analysis.crossChannelAlerts.length,
        insightsCount: analysis.insights.length,
        funnelBottleneck: analysis.funnelDiagnostic.bottleneck
      }
    });

  } catch (error: any) {
    console.error('[TEST] MasterBrain error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack
      },
      { status: 500 }
    );
  }
}
