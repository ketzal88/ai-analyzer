import { auth, db } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        // 1. Authenticate user from session cookie
        const sessionCookie = request.cookies.get("session")?.value;
        if (!sessionCookie) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const decodedToken = await auth.verifySessionCookie(sessionCookie);
        const uid = decodedToken.uid;

        // 2. Fetch accounts where ownerUid == uid
        const snapshot = await db.collection("accounts")
            .where("ownerUid", "==", uid)
            .orderBy("createdAt", "desc")
            .get();

        const accounts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return NextResponse.json(accounts);
    } catch (error: any) {
        console.error("Error fetching accounts:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const sessionCookie = request.cookies.get("session")?.value;
        if (!sessionCookie) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const decodedToken = await auth.verifySessionCookie(sessionCookie);
        const uid = decodedToken.uid;

        const body = await request.json();
        const { name, metaAdAccountId, targetCpa, goal } = body;

        // Validation
        if (!name || !metaAdAccountId || targetCpa === undefined || !goal) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const newAccount = {
            ownerUid: uid,
            name,
            metaAdAccountId,
            targetCpa: Number(targetCpa),
            goal,
            status: "sync-required",
            currency: "USD", // Default
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const docRef = await db.collection("accounts").add(newAccount);

        return NextResponse.json({ id: docRef.id, ...newAccount }, { status: 201 });
    } catch (error: any) {
        console.error("Error creating account:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
