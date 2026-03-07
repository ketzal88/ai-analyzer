/**
 * Funnel Calculator API — Leads Channel
 *
 * GET /api/leads/funnel-calculator?clientId=X&months=3
 *
 * Computes historical funnel rates from the `leads` collection
 * and cross-references META spend for cost metrics.
 * Used by the FunnelCalculator component for reverse funnel projections.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { Lead } from "@/types/leads";

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const clientId = url.searchParams.get("clientId");
    const months = parseInt(url.searchParams.get("months") || "3", 10);

    if (!clientId) {
        return NextResponse.json({ error: "clientId required" }, { status: 400 });
    }

    // Compute date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    const startStr = startDate.toISOString().split("T")[0];

    // Fetch leads for this client in date range
    const leadsSnap = await db.collection("leads")
        .where("clientId", "==", clientId)
        .where("createdAt", ">=", startStr)
        .orderBy("createdAt", "desc")
        .get();

    const leads = leadsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Lead);

    if (leads.length === 0) {
        return NextResponse.json({
            totalLeads: 0,
            avgDealSize: 0,
            qualificationRate: 0,
            attendanceRate: 0,
            closeRate: 0,
            avgCpl: 0,
            totalMetaSpend: 0,
            months,
        });
    }

    // Compute funnel metrics
    const qualified = leads.filter(l => l.qualification === "calificado");
    const attended = leads.filter(l => l.attendance === true);
    const noShows = leads.filter(l => l.attendance === false && l.qualification === "calificado");
    const newClients = leads.filter(l => l.postCallStatus === "nuevo_cliente");
    const totalRevenue = leads.reduce((sum, l) => sum + (l.revenue || 0), 0);

    const qualificationRate = leads.length > 0 ? qualified.length / leads.length : 0;
    const scheduled = attended.length + noShows.length;
    const attendanceRate = scheduled > 0 ? attended.length / scheduled : 0;
    const closeRate = attended.length > 0 ? newClients.length / attended.length : 0;
    const avgDealSize = newClients.length > 0 ? totalRevenue / newClients.length : 0;

    // Cross-reference META spend for cost metrics
    const metaSnap = await db.collection("channel_snapshots")
        .where("clientId", "==", clientId)
        .where("channel", "==", "META")
        .where("date", ">=", startStr)
        .get();

    const totalMetaSpend = metaSnap.docs.reduce((sum, doc) => {
        const metrics = doc.data().metrics || {};
        return sum + (metrics.spend || 0);
    }, 0);

    const avgCpl = leads.length > 0 ? totalMetaSpend / leads.length : 0;

    // META performance averages for projection
    const totalImpressions = metaSnap.docs.reduce((sum, doc) => sum + (doc.data().metrics?.impressions || 0), 0);
    const totalClicks = metaSnap.docs.reduce((sum, doc) => sum + (doc.data().metrics?.clicks || 0), 0);
    const avgCpc = totalClicks > 0 ? totalMetaSpend / totalClicks : 0;
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    return NextResponse.json({
        totalLeads: leads.length,
        qualifiedLeads: qualified.length,
        attendedLeads: attended.length,
        newClients: newClients.length,
        totalRevenue,
        avgDealSize: Math.round(avgDealSize),
        qualificationRate: Math.round(qualificationRate * 1000) / 10,  // e.g. 35.2%
        attendanceRate: Math.round(attendanceRate * 1000) / 10,
        closeRate: Math.round(closeRate * 1000) / 10,
        avgCpl: Math.round(avgCpl),
        avgCpc: Math.round(avgCpc * 100) / 100,
        avgCtr: Math.round(avgCtr * 100) / 100,
        totalMetaSpend: Math.round(totalMetaSpend),
        months,
    });
}
