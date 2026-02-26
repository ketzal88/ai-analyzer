/**
 * Dashbo Client Fields API
 *
 * GET /api/dashbo/client-fields?clientId=123
 *
 * Wrapper around Dashbo MCP tool: dashbo_list_client_available_fields
 * Returns data sources and fields available for a specific client.
 */

import { NextRequest, NextResponse } from 'next/server';

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

    // Call Dashbo MCP tool
    // NOTE: In production, this would use the MCP SDK
    // For now, we'll return mock data structure that matches Dashbo response

    // TODO: Replace with actual MCP tool call when integrated
    // const result = await mcp__claude_ai_Dashbo__dashbo_list_client_available_fields({ client_id: clientId });

    return NextResponse.json({
      client_id: parseInt(clientId),
      client_name: 'Example Client',
      client_data_sources: [
        // This will be populated by actual MCP call
        // Example: ["SOURCE_FACEBOOK_ADS", "SOURCE_GA4", "SOURCE_GOOGLE_ADS", "SOURCE_TIENDA_NUBE"]
      ],
      fields: [],
      business_units: []
    });

  } catch (error: any) {
    console.error('[Dashbo API] Error getting client fields:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
