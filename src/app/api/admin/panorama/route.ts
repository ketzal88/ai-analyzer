import { auth, db } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";
import { withErrorReporting } from "@/lib/error-reporter";
import { resolvePreset, getComparisonRange, DatePreset } from "@/lib/date-utils";
import { Client } from "@/types";
import {
    PanoramaResponse,
    PanoramaTeamGroup,
    PanoramaClientRow,
    PanoramaKPICell,
    PanoramaAdsKPIs,
    PanoramaEcommerceKPIs,
    PanoramaEmailKPIs,
    SemaforoColor,
} from "@/types/panorama";
import { ChannelDailySnapshot } from "@/types/channel-snapshots";

// ── Helpers ─────────────────────────────────────────

function computeCellStatus(
    current: number,
    previous: number,
    target: number | undefined,
    isInverse: boolean
): SemaforoColor {
    if (target !== undefined && target > 0) {
        if (isInverse) {
            if (current <= target) return "green";
            if (current <= target * 1.2) return "yellow";
            return "red";
        } else {
            if (current >= target) return "green";
            if (current >= target * 0.8) return "yellow";
            return "red";
        }
    }

    if (previous === 0) return "green";
    const momPct = ((current - previous) / previous) * 100;

    if (isInverse) {
        if (momPct <= -5) return "green";
        if (momPct <= 10) return "yellow";
        return "red";
    } else {
        if (momPct >= 5) return "green";
        if (momPct >= -10) return "yellow";
        return "red";
    }
}

function buildCell(
    current: number,
    previous: number,
    target: number | undefined,
    isInverse: boolean
): PanoramaKPICell {
    const momPct = previous > 0 ? ((current - previous) / previous) * 100 : null;
    return {
        value: Math.round(current * 100) / 100,
        previousValue: Math.round(previous * 100) / 100,
        momPct: momPct !== null ? Math.round(momPct * 10) / 10 : null,
        status: computeCellStatus(current, previous, target, isInverse),
    };
}

function sumField(snapshots: ChannelDailySnapshot[], field: string): number {
    return snapshots.reduce((s, x) => s + ((x.metrics as Record<string, number>)[field] || 0), 0);
}

function buildAdsKPIs(
    currentSnaps: ChannelDailySnapshot[] | undefined,
    prevSnaps: ChannelDailySnapshot[] | undefined,
    cpaTarget: number | undefined,
    roasTarget: number | undefined
): PanoramaAdsKPIs | undefined {
    if (!currentSnaps || currentSnaps.length === 0) return undefined;

    const prev = prevSnaps || [];

    const spendCur = sumField(currentSnaps, "spend");
    const spendPrev = sumField(prev, "spend");
    const convCur = sumField(currentSnaps, "conversions");
    const convPrev = sumField(prev, "conversions");
    const revCur = sumField(currentSnaps, "revenue");
    const revPrev = sumField(prev, "revenue");

    const cpaCur = convCur > 0 ? spendCur / convCur : 0;
    const cpaPrev = convPrev > 0 ? spendPrev / convPrev : 0;
    const roasCur = spendCur > 0 ? revCur / spendCur : 0;
    const roasPrev = spendPrev > 0 ? revPrev / spendPrev : 0;

    return {
        spend: buildCell(spendCur, spendPrev, undefined, false),
        cpa: buildCell(cpaCur, cpaPrev, cpaTarget, true),
        roas: buildCell(roasCur, roasPrev, roasTarget, false),
    };
}

function buildEcommerceKPIs(
    currentSnaps: ChannelDailySnapshot[] | undefined,
    prevSnaps: ChannelDailySnapshot[] | undefined
): PanoramaEcommerceKPIs | undefined {
    if (!currentSnaps || currentSnaps.length === 0) return undefined;

    const prev = prevSnaps || [];

    const revCur = sumField(currentSnaps, "revenue");
    const revPrev = sumField(prev, "revenue");
    const ordCur = sumField(currentSnaps, "orders");
    const ordPrev = sumField(prev, "orders");
    const aovCur = ordCur > 0 ? revCur / ordCur : 0;
    const aovPrev = ordPrev > 0 ? revPrev / ordPrev : 0;

    return {
        revenue: buildCell(revCur, revPrev, undefined, false),
        orders: buildCell(ordCur, ordPrev, undefined, false),
        aov: buildCell(aovCur, aovPrev, undefined, false),
    };
}

function buildEmailKPIs(
    currentSnaps: ChannelDailySnapshot[] | undefined,
    prevSnaps: ChannelDailySnapshot[] | undefined
): PanoramaEmailKPIs | undefined {
    if (!currentSnaps || currentSnaps.length === 0) return undefined;

    const prev = prevSnaps || [];

    const sentCur = sumField(currentSnaps, "sent");
    const sentPrev = sumField(prev, "sent");
    const delCur = sumField(currentSnaps, "delivered");
    const delPrev = sumField(prev, "delivered");
    const opensCur = sumField(currentSnaps, "opens");
    const opensPrev = sumField(prev, "opens");
    const clicksCur = sumField(currentSnaps, "emailClicks");
    const clicksPrev = sumField(prev, "emailClicks");

    const orCur = delCur > 0 ? (opensCur / delCur) * 100 : 0;
    const orPrev = delPrev > 0 ? (opensPrev / delPrev) * 100 : 0;
    const crCur = delCur > 0 ? (clicksCur / delCur) * 100 : 0;
    const crPrev = delPrev > 0 ? (clicksPrev / delPrev) * 100 : 0;

    return {
        sent: buildCell(sentCur, sentPrev, undefined, false),
        openRate: buildCell(orCur, orPrev, undefined, false),
        clickRate: buildCell(crCur, crPrev, undefined, false),
    };
}

// ── Fetch all snapshots for a client in a date range ──

type ChannelSnapMap = Record<string, ChannelDailySnapshot[]>;

async function fetchClientSnapshots(
    clientId: string,
    dateStart: string,
    dateEnd: string
): Promise<ChannelSnapMap> {
    // Uses existing composite index: clientId ASC + date ASC
    const snap = await db
        .collection("channel_snapshots")
        .where("clientId", "==", clientId)
        .where("date", ">=", dateStart)
        .where("date", "<=", dateEnd)
        .get();

    const map: ChannelSnapMap = {};
    for (const doc of snap.docs) {
        const data = doc.data() as ChannelDailySnapshot;
        const ch = data.channel;
        if (!map[ch]) map[ch] = [];
        map[ch].push(data);
    }
    return map;
}

// ── Main Handler ────────────────────────────────────

export const GET = withErrorReporting("API Panorama GET", async (request: NextRequest) => {
    const sessionCookie = request.cookies.get("session")?.value;
    if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await auth.verifySessionCookie(sessionCookie);

    const preset = (request.nextUrl.searchParams.get("preset") || "mtd") as DatePreset;
    const currentRange = resolvePreset(preset);
    const compRange = getComparisonRange(currentRange);

    // Fetch clients + teams in parallel
    const [clientsSnap, teamsSnap] = await Promise.all([
        db.collection("clients").orderBy("name", "asc").get(),
        db.collection("teams").orderBy("name", "asc").get(),
    ]);

    const clients = clientsSnap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as Client))
        .filter((c) => c.active && !(c as unknown as Record<string, unknown>).archived);

    const teamsMap = new Map<string, string>();
    teamsSnap.docs.forEach((doc) => teamsMap.set(doc.id, doc.data().name as string));

    // Fetch snapshots per client — 2 queries per client (current + previous)
    // Uses existing Firestore index: clientId + date ASC
    const clientSnapshotResults = await Promise.all(
        clients.map(async (client) => {
            const [cur, prev] = await Promise.all([
                fetchClientSnapshots(client.id, currentRange.start, currentRange.end),
                fetchClientSnapshots(client.id, compRange.start, compRange.end),
            ]);
            return { clientId: client.id, cur, prev };
        })
    );

    // Index results by clientId
    const snapsByClient = new Map<string, { cur: ChannelSnapMap; prev: ChannelSnapMap }>();
    for (const r of clientSnapshotResults) {
        snapsByClient.set(r.clientId, { cur: r.cur, prev: r.prev });
    }

    // Build rows
    const rows: PanoramaClientRow[] = clients.map((client) => {
        const snaps = snapsByClient.get(client.id);
        const cur = snaps?.cur || {};
        const prev = snaps?.prev || {};

        const metaCpaTarget = client.targets?.cpa_meta ?? client.targetCpa;
        const metaRoasTarget = client.targets?.roas_meta ?? client.targetRoas;
        const googleCpaTarget = client.targets?.cpa_google ?? client.targetCpa;
        const googleRoasTarget = client.targets?.roas_google ?? client.targetRoas;

        return {
            clientId: client.id,
            clientName: client.name,
            clientSlug: client.slug,
            teamId: client.team || null,
            meta: buildAdsKPIs(cur["META"], prev["META"], metaCpaTarget, metaRoasTarget),
            google: buildAdsKPIs(cur["GOOGLE"], prev["GOOGLE"], googleCpaTarget, googleRoasTarget),
            ecommerce: buildEcommerceKPIs(cur["ECOMMERCE"], prev["ECOMMERCE"]),
            email: buildEmailKPIs(cur["EMAIL"], prev["EMAIL"]),
        };
    });

    // Group by team
    const teamGroups = new Map<string | null, PanoramaClientRow[]>();
    for (const row of rows) {
        const key = row.teamId;
        const arr = teamGroups.get(key) || [];
        arr.push(row);
        teamGroups.set(key, arr);
    }

    const teams: PanoramaTeamGroup[] = [];
    // Named teams first (alphabetical)
    const sortedTeamIds = [...teamGroups.keys()]
        .filter((k) => k !== null)
        .sort((a, b) => (teamsMap.get(a!) || "").localeCompare(teamsMap.get(b!) || ""));

    for (const teamId of sortedTeamIds) {
        teams.push({
            teamId,
            teamName: teamsMap.get(teamId!) || "Equipo desconocido",
            clients: teamGroups.get(teamId) || [],
        });
    }

    // "Sin equipo" last
    if (teamGroups.has(null)) {
        teams.push({
            teamId: null,
            teamName: "Sin equipo",
            clients: teamGroups.get(null) || [],
        });
    }

    const response: PanoramaResponse = {
        teams,
        period: { start: currentRange.start, end: currentRange.end, label: currentRange.label },
        comparisonPeriod: { start: compRange.start, end: compRange.end, label: compRange.label },
    };

    return NextResponse.json(response);
});
