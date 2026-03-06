import { db } from "@/lib/firebase-admin";
import { getAdminStatus } from "@/lib/server-utils";
import { NextRequest, NextResponse } from "next/server";

// GET /api/admin/winning-ads?angle=curiosity&format=VIDEO
export async function GET(request: NextRequest) {
    const { isAdmin } = await getAdminStatus(request);
    if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        let query: FirebaseFirestore.Query = db.collection("winning_ads_library");

        const angle = request.nextUrl.searchParams.get("angle");
        if (angle) query = query.where("angle", "==", angle);

        const format = request.nextUrl.searchParams.get("format");
        if (format) query = query.where("format", "==", format);

        const activeOnly = request.nextUrl.searchParams.get("active") !== "false";
        if (activeOnly) query = query.where("active", "==", true);

        const snapshot = await query.get();
        const ads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        return NextResponse.json(ads);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST /api/admin/winning-ads
export async function POST(request: NextRequest) {
    const { isAdmin, uid } = await getAdminStatus(request);
    if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await request.json();
        const {
            angle,
            format,
            description,
            whyItWorked,
            keyElements,
            visualStyle,
            metrics,
        } = body;

        if (!angle || !format || !description || !whyItWorked) {
            return NextResponse.json(
                { error: "angle, format, description, and whyItWorked are required" },
                { status: 400 }
            );
        }

        const doc = {
            angle,
            format,
            description,
            whyItWorked,
            keyElements: keyElements || [],
            visualStyle: visualStyle || '',
            metrics: metrics || null,
            addedBy: uid || 'unknown',
            addedAt: new Date().toISOString(),
            active: true,
        };

        const ref = await db.collection("winning_ads_library").add(doc);

        return NextResponse.json({ id: ref.id, ...doc }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE /api/admin/winning-ads?id=xxx
export async function DELETE(request: NextRequest) {
    const { isAdmin } = await getAdminStatus(request);
    if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    try {
        await db.collection("winning_ads_library").doc(id).delete();
        return NextResponse.json({ deleted: id });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
