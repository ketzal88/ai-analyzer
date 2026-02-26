/**
 * Dashbo List Clients API
 *
 * GET /api/dashbo/list-clients
 *
 * Wrapper around Dashbo MCP tool: dashbo_list_clients
 * Returns list of all clients from Dashbo.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Call Dashbo MCP tool
    // NOTE: In production, this would use the MCP SDK
    // For now, we'll return mock data structure that matches Dashbo response

    // TODO: Replace with actual MCP tool call when integrated
    // const result = await mcp__claude_ai_Dashbo__dashbo_list_clients();

    return NextResponse.json({
      clients: [
        // This will be populated by actual MCP call
        // Example structure:
        // { id: 7334, name: "Almacen de Colchones", active: true }
      ]
    });

  } catch (error: any) {
    console.error('[Dashbo API] Error listing clients:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
