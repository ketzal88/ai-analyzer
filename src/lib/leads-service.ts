/**
 * Leads Service — Aggregates individual lead records into channel_snapshots
 *
 * Reads from `leads` collection, groups by date, computes funnel metrics,
 * cross-references META spend, and writes to `channel_snapshots` with channel: 'LEADS'.
 */

import { db } from "@/lib/firebase-admin";
import { Lead, LeadsFunnelStage, LeadsCloserBreakdown, LeadsUtmBreakdown } from "@/types/leads";
import { ChannelDailySnapshot, UnifiedChannelMetrics, buildChannelSnapshotId } from "@/types/channel-snapshots";

export class LeadsService {

    /**
     * Sync lead data to channel_snapshots for a date range.
     * Aggregates individual leads into daily funnel snapshots.
     */
    static async syncToChannelSnapshots(
        clientId: string,
        startDate: string,
        endDate: string
    ): Promise<{ daysWritten: number; totalLeads: number }> {
        // 1. Fetch all leads in date range
        const leadsSnap = await db.collection("leads")
            .where("clientId", "==", clientId)
            .where("createdAt", ">=", `${startDate}T00:00:00.000Z`)
            .where("createdAt", "<=", `${endDate}T23:59:59.999Z`)
            .orderBy("createdAt", "asc")
            .get();

        if (leadsSnap.empty) {
            return { daysWritten: 0, totalLeads: 0 };
        }

        const allLeads: Lead[] = leadsSnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as Lead[];

        // 2. Group by date (YYYY-MM-DD from createdAt)
        const byDate = new Map<string, Lead[]>();
        for (const lead of allLeads) {
            const date = lead.createdAt.slice(0, 10); // YYYY-MM-DD
            if (!byDate.has(date)) byDate.set(date, []);
            byDate.get(date)!.push(lead);
        }

        // 3. For each date, compute aggregates and write snapshot
        let daysWritten = 0;

        for (const [date, leads] of byDate) {
            const metrics = this.computeMetrics(leads);

            // Cross-reference META metrics for cost + ads KPIs
            const metaDocId = buildChannelSnapshotId(clientId, "META", date);
            const metaDoc = await db.collection("channel_snapshots").doc(metaDocId).get();
            const metaData = metaDoc.exists ? metaDoc.data()?.metrics : null;
            const metaSpend = metaData?.spend || 0;
            const metaImpressions = metaData?.impressions || 0;
            const metaClicks = metaData?.clicks || 0;

            if (metaSpend > 0) {
                metrics.cpl = metrics.totalLeads! > 0 ? metaSpend / metrics.totalLeads! : undefined;
                metrics.cpql = metrics.qualifiedLeads! > 0 ? metaSpend / metrics.qualifiedLeads! : undefined;
                metrics.customerAcquisitionCost = metrics.newClients! > 0 ? metaSpend / metrics.newClients! : undefined;
            }

            // Build rawData with breakdowns + META ads metrics
            const rawData = this.buildRawData(leads, metaSpend, metaImpressions, metaClicks);

            const snapshot: ChannelDailySnapshot = {
                clientId,
                channel: "LEADS",
                date,
                metrics,
                rawData,
                syncedAt: new Date().toISOString(),
            };

            const docId = buildChannelSnapshotId(clientId, "LEADS", date);
            await db.collection("channel_snapshots").doc(docId).set(snapshot);
            daysWritten++;
        }

        return { daysWritten, totalLeads: allLeads.length };
    }

    /**
     * Compute funnel metrics from a set of leads (single day or period).
     */
    static computeMetrics(leads: Lead[]): UnifiedChannelMetrics {
        const total = leads.length;
        const qualified = leads.filter((l) => l.qualification === "calificado").length;
        const unqualified = leads.filter((l) => l.qualification === "no_calificado").length;
        const spam = leads.filter((l) => l.qualification === "spam").length;
        const attended = leads.filter((l) => l.attendance === true).length;
        const noShows = leads.filter((l) => l.attendance === false).length;
        const newClients = leads.filter((l) => l.postCallStatus === "nuevo_cliente").length;
        const followUps = leads.filter((l) => l.postCallStatus === "seguimiento").length;
        const revenue = leads.reduce((sum, l) => sum + (l.revenue || 0), 0);

        // Quality scores (only non-null)
        const qualityScores = leads
            .map((l) => l.qualityScore)
            .filter((s): s is 1 | 2 | 3 => s !== null && s !== undefined);
        const avgQuality = qualityScores.length > 0
            ? qualityScores.reduce((a: number, b: number) => a + b, 0) / qualityScores.length
            : undefined;

        // Conversion rates
        const qualificationRate = total > 0 ? (qualified / total) * 100 : 0;
        const scheduledForCall = attended + noShows;
        const attendanceRate = scheduledForCall > 0 ? (attended / scheduledForCall) * 100 : 0;
        const closeRate = attended > 0 ? (newClients / attended) * 100 : 0;

        return {
            totalLeads: total,
            qualifiedLeads: qualified,
            unqualifiedLeads: unqualified,
            spamLeads: spam,
            attendedCalls: attended,
            noShows,
            newClients,
            followUps,
            qualificationRate,
            attendanceRate,
            closeRate,
            leadRevenue: revenue,
            avgQualityScore: avgQuality,
            // Map to standard fields for cross-channel compatibility
            conversions: newClients,
            revenue,
        };
    }

    /**
     * Build rawData with breakdowns for the channel page.
     */
    static buildRawData(leads: Lead[], metaSpend: number, metaImpressions = 0, metaClicks = 0): Record<string, unknown> {
        // Funnel stages
        const total = leads.length;
        const qualified = leads.filter((l) => l.qualification === "calificado").length;
        const attended = leads.filter((l) => l.attendance === true).length;
        const newClients = leads.filter((l) => l.postCallStatus === "nuevo_cliente").length;

        const funnelStages: LeadsFunnelStage[] = [
            { stage: "leads", count: total },
            { stage: "calificados", count: qualified, conversionRate: total > 0 ? (qualified / total) * 100 : 0 },
            { stage: "asistieron", count: attended, conversionRate: qualified > 0 ? (attended / qualified) * 100 : 0 },
            { stage: "nuevos_clientes", count: newClients, conversionRate: attended > 0 ? (newClients / attended) * 100 : 0 },
        ];

        // By closer
        const closerMap = new Map<string, Lead[]>();
        for (const lead of leads) {
            const closer = lead.closerAssigned || "Sin asignar";
            if (!closerMap.has(closer)) closerMap.set(closer, []);
            closerMap.get(closer)!.push(lead);
        }

        const byCloser: LeadsCloserBreakdown[] = Array.from(closerMap.entries()).map(([closer, cls]) => {
            const q = cls.filter((l) => l.qualification === "calificado").length;
            const a = cls.filter((l) => l.attendance === true).length;
            const ns = cls.filter((l) => l.attendance === false).length;
            const nc = cls.filter((l) => l.postCallStatus === "nuevo_cliente").length;
            const rev = cls.reduce((sum, l) => sum + (l.revenue || 0), 0);
            return {
                closer,
                totalLeads: cls.length,
                qualified: q,
                attended: a,
                newClients: nc,
                revenue: rev,
                qualificationRate: cls.length > 0 ? (q / cls.length) * 100 : 0,
                attendanceRate: (a + ns) > 0 ? (a / (a + ns)) * 100 : 0,
                closeRate: a > 0 ? (nc / a) * 100 : 0,
            };
        });

        // By UTM campaign
        const utmMap = new Map<string, Lead[]>();
        for (const lead of leads) {
            const campaign = lead.utm?.campaign || "Sin UTM";
            if (!utmMap.has(campaign)) utmMap.set(campaign, []);
            utmMap.get(campaign)!.push(lead);
        }

        const byUtmCampaign: LeadsUtmBreakdown[] = Array.from(utmMap.entries())
            .map(([campaign, cls]) => {
                const q = cls.filter((l) => l.qualification === "calificado").length;
                const rev = cls.reduce((sum, l) => sum + (l.revenue || 0), 0);
                return {
                    campaign,
                    content: cls[0]?.utm?.content,
                    totalLeads: cls.length,
                    qualified: q,
                    qualificationRate: cls.length > 0 ? (q / cls.length) * 100 : 0,
                    revenue: rev,
                };
            })
            .sort((a, b) => b.totalLeads - a.totalLeads);

        return {
            source: "ghl",
            metaSpend,
            metaImpressions,
            metaClicks,
            metaCpm: metaImpressions > 0 ? (metaSpend / metaImpressions) * 1000 : 0,
            metaCpc: metaClicks > 0 ? metaSpend / metaClicks : 0,
            metaCtr: metaImpressions > 0 ? (metaClicks / metaImpressions) * 100 : 0,
            impressionsPerMeeting: total > 0 && metaImpressions > 0 ? metaImpressions / total : 0,
            costPerAttendance: attended > 0 && metaSpend > 0 ? metaSpend / attended : 0,
            costPerClose: newClients > 0 && metaSpend > 0 ? metaSpend / newClients : 0,
            funnelStages,
            byCloser,
            byUtmCampaign,
        };
    }
}
