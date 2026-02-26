/**
 * TEST: ClientSnapshotService with MetaBrain
 *
 * Tests the integration of MetaBrain with ClientSnapshotService
 */

import { NextRequest, NextResponse } from 'next/server';
import { ClientSnapshotService } from '@/lib/client-snapshot-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json(
        { error: 'Missing clientId parameter' },
        { status: 400 }
      );
    }

    // Temporarily enable MetaBrain
    const originalValue = process.env.USE_METABRAIN_ALERTS;
    process.env.USE_METABRAIN_ALERTS = 'true';

    console.log('[TEST] Running ClientSnapshotService with MetaBrain enabled');
    const startTime = Date.now();

    const result = await ClientSnapshotService.computeAndStore(clientId);

    const duration = Date.now() - startTime;

    // Restore original value
    process.env.USE_METABRAIN_ALERTS = originalValue;

    return NextResponse.json({
      success: true,
      test: 'ClientSnapshotService with MetaBrain',
      clientId,
      duration: `${duration}ms`,
      result: {
        mainDocSize: result.main.meta.docSizeKB,
        adsDocSize: result.ads.meta.docSizeKB,
        alertsCount: result.main.alerts.length,
        alertTypes: result.main.alerts.map(a => a.type),
        entityCounts: result.main.meta.entityCounts,
        sampleAlerts: result.main.alerts.slice(0, 3).map(a => ({
          type: a.type,
          severity: a.severity,
          title: a.title
        }))
      }
    });

  } catch (error: any) {
    console.error('[TEST] Error:', error);

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
