/**
 * Admin Public Tokens API
 *
 * GET  /api/admin/public-tokens?clientId=X  — List tokens for a client
 * POST /api/admin/public-tokens             — Create a new token
 */

import { NextRequest, NextResponse } from "next/server";
import { auth, db } from "@/lib/firebase-admin";
import { randomBytes } from "crypto";
import { PublicToken } from "@/types";

function isAdmin(uid: string): boolean {
  const adminUids = (process.env.ADMIN_UIDS || "").split(",");
  return adminUids.includes(uid);
}

export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get("session")?.value;
  if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const decoded = await auth.verifySessionCookie(sessionCookie, true);
    if (!isAdmin(decoded.uid)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");

  try {
    let query: FirebaseFirestore.Query = db.collection("public_tokens");
    if (clientId) {
      query = query.where("clientId", "==", clientId);
    }
    const snap = await query.get();
    const tokens = snap.docs.map(doc => ({ ...doc.data(), token: doc.id } as PublicToken));
    return NextResponse.json({ tokens });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const sessionCookie = request.cookies.get("session")?.value;
  if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let uid: string;
  try {
    const decoded = await auth.verifySessionCookie(sessionCookie, true);
    if (!isAdmin(decoded.uid)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const body = await request.json();
  const { clientId, label, expiresAt } = body as { clientId: string; label?: string; expiresAt?: string };

  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  try {
    const token = randomBytes(12).toString("hex"); // 24-char hex
    const data: PublicToken = {
      token,
      clientId,
      label: label || undefined,
      createdAt: new Date().toISOString(),
      createdByUid: uid,
      expiresAt: expiresAt || undefined,
      active: true,
      accessCount: 0,
    };

    await db.collection("public_tokens").doc(token).set(data);
    return NextResponse.json({ token: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
