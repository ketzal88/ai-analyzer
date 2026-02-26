/**
 * TEST API Route — MetaBrain Worker Brain V2
 *
 * Prueba end-to-end del flujo completo:
 * 1. MetaBrain lee de dashbo_snapshots
 * 2. Genera ChannelSignals
 * 3. Retorna JSON para inspección
 *
 * Usage: GET /api/test/metabrain?clientId=zPIorY5SDvoUQ1zTEFqi
 */

import { NextRequest, NextResponse } from 'next/server';
import { MetaBrain } from '@/lib/meta-brain';
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

    // 2. Build date range
    const dateRanges = buildDateRanges();
    let dateRange = dateRanges.yesterday;

    if (dateOverride) {
      dateRange = { start: dateOverride, end: dateOverride };
    }

    // 3. Execute MetaBrain analysis
    console.log(`[TEST] Running MetaBrain for ${client.name} (${clientId})`);
    console.log(`[TEST] Date range: ${dateRange.start} → ${dateRange.end}`);

    const metaBrain = new MetaBrain();
    const startTime = Date.now();

    const signals = await metaBrain.analyze(clientId, dateRange, client);

    const duration = Date.now() - startTime;

    // 4. Build response
    return NextResponse.json({
      success: true,
      test: 'MetaBrain Worker Brain V2',
      client: {
        id: client.id,
        name: client.name,
        slug: client.slug
      },
      dateRange,
      duration: `${duration}ms`,
      channelSignals: signals,
      summary: {
        canal: signals.canal,
        kpisAvailable: Object.keys(signals.kpis).filter(k => signals.kpis[k as keyof typeof signals.kpis] !== undefined),
        alertsCount: signals.alerts.length,
        signalsCount: Object.keys(signals.signals).length,
        dataQuality: signals.dataQuality.confidence,
        fieldsWithNull: signals.dataQuality.fieldsWithNull
      }
    });

  } catch (error: any) {
    console.error('[TEST] MetaBrain error:', error);

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
