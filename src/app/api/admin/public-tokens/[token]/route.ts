/**
 * Admin Public Token — Single Token Operations
 *
 * PATCH  /api/admin/public-tokens/:token — Toggle active status
 * DELETE /api/admin/public-tokens/:token — Delete token
 */

import { NextRequest, NextResponse } from "next/server";
import { auth, db } from "@/lib/firebase-admin";

function isAdmin(uid: string): boolean {
  const adminUids = (process.env.ADMIN_UIDS || "").split(",");
  return adminUids.includes(uid);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const sessionCookie = request.cookies.get("session")?.value;
  if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const decoded = await auth.verifySessionCookie(sessionCookie, true);
    if (!isAdmin(decoded.uid)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { token } = await params;
  const body = await request.json();

  try {
    const ref = db.collection("public_tokens").doc(token);
    const doc = await ref.get();
    if (!doc.exists) return NextResponse.json({ error: "Token not found" }, { status: 404 });

    const updates: Record<string, any> = {};
    if (body.active !== undefined) updates.active = body.active;
    if (body.label !== undefined) updates.label = body.label;

    await ref.update(updates);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const sessionCookie = request.cookies.get("session")?.value;
  if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const decoded = await auth.verifySessionCookie(sessionCookie, true);
    if (!isAdmin(decoded.uid)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { token } = await params;

  try {
    await db.collection("public_tokens").doc(token).delete();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
