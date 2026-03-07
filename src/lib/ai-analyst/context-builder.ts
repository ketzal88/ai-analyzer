/**
 * Context Builder — AI Analyst
 *
 * Assembles structured AnalystContext from Firestore data.
 * This runs server-side in the API route and produces the data
 * that gets formatted as XML for Claude's system prompt.
 *
 * Data sources:
 * - clients/{clientId} — Client config, targets, business profile
 * - channel_snapshots — Daily metrics per channel (unified collection)
 * - daily_entity_snapshots — Meta campaign/adset/ad level data
 * - entity_rolling_metrics — Pre-computed rolling windows
 * - creative_dna — AI-analyzed creative attributes
 */

import { db } from "@/lib/firebase-admin";
import { ChannelType } from "@/lib/channel-brain-interface";
import { ChannelDailySnapshot } from "@/types/channel-snapshots";
import { Client } from "@/types";
import { formatDate } from "@/lib/date-utils";
import type {
  ChannelId,
  AnalystContext,
  AnalystDateRange,
  AnalystChannelData,
  ChannelDetails,
  CampaignSummary,
  CreativeSummary,
  ProductSummary,
  CrossChannelInsights,
  WinningAngleGroup,
  WinningAdReference,
  DiversityScoreSummary,
  LeadsFunnelStageSummary,
  LeadsCloserSummary,
  LeadsUtmSummary,
} from "./types";
import { CHANNEL_TO_FIRESTORE } from "./types";

// ── Constants ──────────────────────────────────────────

const MAX_CAMPAIGNS = 15;
const MAX_CREATIVES = 10;
const MAX_PRODUCTS = 10;
const MAX_EMAIL_CAMPAIGNS = 10;
const MAX_AUTOMATIONS = 10;

/** Metrics that should be summed across daily snapshots */
const ADDITIVE_METRICS = [
  'spend', 'revenue', 'conversions', 'impressions', 'clicks', 'reach',
  'orders', 'grossRevenue', 'netRevenue', 'totalDiscounts', 'totalShipping',
  'cancelledOrders', 'fulfilledOrders', 'newCustomers', 'returningCustomers',
  'abandonedCheckouts', 'abandonedCheckoutValue', 'refunds', 'totalRefundAmount',
  'sent', 'delivered', 'opens', 'emailClicks', 'bounces', 'unsubscribes', 'emailRevenue',
  'totalLeads', 'qualifiedLeads', 'unqualifiedLeads', 'spamLeads',
  'attendedCalls', 'noShows', 'newClients', 'followUps', 'leadRevenue',
  'inlineLinkClicks', 'uniqueClicks', 'outboundClicks',
  'addToCart', 'initiateCheckout', 'viewContent',
  'videoPlays', 'videoP25', 'videoP50', 'videoP75', 'videoP100', 'video30sViews',
  'allConversions', 'allConversionsValue', 'viewThroughConversions',
  'postEngagement', 'postReactions', 'postComments', 'postShares',
  'spamComplaints',
] as const;

// ── Main Builder ────────────────────────────────────────

export async function buildAnalystContext(
  clientId: string,
  channelId: ChannelId,
  dateRange: AnalystDateRange,
): Promise<AnalystContext> {
  // 1. Load client config
  const clientDoc = await db.collection('clients').doc(clientId).get();
  if (!clientDoc.exists) {
    throw new Error(`Client ${clientId} not found`);
  }
  const client = { id: clientDoc.id, ...clientDoc.data() } as Client;

  // 2. Compute periods
  const currentDays = daysBetween(dateRange.start, dateRange.end);
  const prevEnd = subtractDays(dateRange.start, 1);
  const prevStart = subtractDays(dateRange.start, currentDays);
  const previousPeriod = { start: prevStart, end: prevEnd };

  // 3. Build channel data
  let channelData: AnalystChannelData;
  let crossChannelInsights: CrossChannelInsights | undefined;

  if (channelId === 'cross_channel') {
    const result = await buildCrossChannelData(clientId, dateRange, previousPeriod);
    channelData = result.channelData;
    crossChannelInsights = result.insights;
  } else {
    channelData = await buildSingleChannelData(clientId, channelId, dateRange, previousPeriod);
  }

  // 4. Assemble context
  return {
    _meta: {
      clientId: client.id,
      clientName: client.name,
      businessType: client.businessType || 'ecommerce',
      currency: client.currency || 'USD',
      timezone: client.timezone || 'America/Argentina/Buenos_Aires',
      growthMode: client.growthMode,
      funnelPriority: client.funnelPriority,
      period: {
        start: dateRange.start,
        end: dateRange.end,
        days: currentDays,
      },
      previousPeriod,
      targets: {
        targetCpa: client.targetCpa,
        targetRoas: client.targetRoas,
        cpa_meta: client.targets?.cpa_meta,
        cpa_google: client.targets?.cpa_google,
        roas_meta: client.targets?.roas_meta,
        roas_google: client.targets?.roas_google,
        blended_roas_target: client.targets?.blended_roas_target,
      },
    },
    channel: channelData,
    cross_channel_insights: crossChannelInsights,
  };
}

// ── Single Channel Builder ──────────────────────────────

async function buildSingleChannelData(
  clientId: string,
  channelId: ChannelId,
  dateRange: AnalystDateRange,
  previousPeriod: { start: string; end: string },
): Promise<AnalystChannelData> {
  const firestoreChannel = CHANNEL_TO_FIRESTORE[channelId]!;

  // Fetch current + previous snapshots in parallel
  const [currentSnaps, prevSnaps] = await Promise.all([
    fetchSnapshots(clientId, firestoreChannel, dateRange.start, dateRange.end),
    fetchSnapshots(clientId, firestoreChannel, previousPeriod.start, previousPeriod.end),
  ]);

  const summary = aggregateSnapshots(currentSnaps);
  const prevSummary = aggregateSnapshots(prevSnaps);
  const vs_previous = computeDeltas(summary, prevSummary);

  // Compute derived metrics
  addDerivedMetrics(summary);

  // Load channel-specific details
  let details: ChannelDetails = {};
  switch (channelId) {
    case 'meta_ads':
      details = await loadMetaDetails(clientId, dateRange, currentSnaps);
      break;
    case 'google_ads':
      details = loadGoogleDetails(currentSnaps);
      break;
    case 'ga4':
      details = loadGA4Details(currentSnaps);
      break;
    case 'ecommerce':
      details = loadEcommerceDetails(currentSnaps);
      break;
    case 'email':
      details = loadEmailDetails(currentSnaps);
      break;
    case 'leads':
      details = loadLeadsDetails(currentSnaps);
      break;
    case 'creative_briefs':
      details = await loadCreativeBriefDetails(clientId);
      break;
  }

  return { id: channelId, summary, vs_previous, details };
}

// ── Cross-Channel Builder ───────────────────────────────

async function buildCrossChannelData(
  clientId: string,
  dateRange: AnalystDateRange,
  previousPeriod: { start: string; end: string },
): Promise<{ channelData: AnalystChannelData; insights: CrossChannelInsights }> {
  const channels: ChannelType[] = ['META', 'GOOGLE', 'ECOMMERCE', 'EMAIL', 'LEADS'];

  // Fetch all channels in parallel (current + previous)
  const results = await Promise.all(
    channels.map(async (ch) => {
      const [current, prev] = await Promise.all([
        fetchSnapshots(clientId, ch, dateRange.start, dateRange.end),
        fetchSnapshots(clientId, ch, previousPeriod.start, previousPeriod.end),
      ]);
      const summary = aggregateSnapshots(current);
      addDerivedMetrics(summary);
      const prevSummary = aggregateSnapshots(prev);
      return { channel: ch, summary, prevSummary, currentSnaps: current };
    }),
  );

  const channelSummaries: Record<string, Record<string, number | undefined>> = {};
  for (const r of results) {
    const key = r.channel.toLowerCase();
    channelSummaries[key] = r.summary;
  }

  // Compute total summary (spend + revenue across all paid channels)
  const metaS = channelSummaries['meta'] || {};
  const googleS = channelSummaries['google'] || {};
  const ecomS = channelSummaries['ecommerce'] || {};
  const emailS = channelSummaries['email'] || {};

  const totalSpend = (metaS.spend || 0) + (googleS.spend || 0);
  const totalRevenue = (ecomS.revenue || 0);

  const summary: Record<string, number | undefined> = {
    total_paid_spend: totalSpend,
    total_ecommerce_revenue: totalRevenue,
    blended_roas: totalSpend > 0 ? totalRevenue / totalSpend : undefined,
  };

  // Compute attribution gap
  const metaReported = metaS.revenue || 0;
  const googleReported = googleS.revenue || 0;
  const ecomReal = ecomS.revenue || 0;
  const totalReported = metaReported + googleReported;
  const gapPct = ecomReal > 0 ? ((totalReported - ecomReal) / ecomReal) * 100 : 0;

  // Spend distribution
  const spend_distribution: Record<string, number> = {};
  if (totalSpend > 0) {
    if (metaS.spend) spend_distribution.meta = (metaS.spend / totalSpend) * 100;
    if (googleS.spend) spend_distribution.google = (googleS.spend / totalSpend) * 100;
  }

  const insights: CrossChannelInsights = {
    attribution_gap: {
      meta_reported: metaReported,
      google_reported: googleReported > 0 ? googleReported : undefined,
      ecommerce_real: ecomReal,
      gap_pct: gapPct,
    },
    spend_distribution,
    email_vs_paid: {
      email_revenue: emailS.emailRevenue,
      paid_spend: totalSpend > 0 ? totalSpend : undefined,
      paid_revenue: totalReported > 0 ? totalReported : undefined,
    },
  };

  // Compute vs_previous for the blended view
  const prevMeta = results.find(r => r.channel === 'META')?.prevSummary || {};
  const prevGoogle = results.find(r => r.channel === 'GOOGLE')?.prevSummary || {};
  const prevEcom = results.find(r => r.channel === 'ECOMMERCE')?.prevSummary || {};
  const prevTotalSpend = (prevMeta.spend || 0) + (prevGoogle.spend || 0);
  const prevTotalRevenue = (prevEcom.revenue || 0);

  const vs_previous: Record<string, number | undefined> = {
    total_paid_spend: delta(totalSpend, prevTotalSpend),
    total_ecommerce_revenue: delta(totalRevenue, prevTotalRevenue),
    blended_roas: delta(
      totalSpend > 0 ? totalRevenue / totalSpend : 0,
      prevTotalSpend > 0 ? prevTotalRevenue / prevTotalSpend : 0,
    ),
  };

  return {
    channelData: {
      id: 'cross_channel',
      summary,
      vs_previous,
      details: { channelSummaries },
    },
    insights,
  };
}

// ── Channel-specific detail loaders ─────────────────────

async function loadMetaDetails(
  clientId: string,
  dateRange: AnalystDateRange,
  snapshots: ChannelDailySnapshot[],
): Promise<ChannelDetails> {
  // Load campaign-level entity snapshots
  const entitySnap = await db.collection('daily_entity_snapshots')
    .where('clientId', '==', clientId)
    .where('level', '==', 'campaign')
    .where('date', '>=', dateRange.start)
    .where('date', '<=', dateRange.end)
    .get();

  // Aggregate campaign data across days
  const campaignMap = new Map<string, CampaignSummary>();
  for (const doc of entitySnap.docs) {
    const d = doc.data();
    const id = d.entityId as string;
    const existing = campaignMap.get(id);
    const perf = d.performance || {};

    if (existing) {
      existing.spend += perf.spend || 0;
      existing.conversions = (existing.conversions || 0) + (perf.purchases || 0);
      existing.revenue = (existing.revenue || 0) + (perf.purchaseValue || 0);
      existing.impressions = (existing.impressions || 0) + (perf.impressions || 0);
      existing.clicks = (existing.clicks || 0) + (perf.clicks || 0);
    } else {
      campaignMap.set(id, {
        id,
        name: d.name || d.meta?.name || id,
        status: d.meta?.status,
        objective: d.meta?.objective,
        spend: perf.spend || 0,
        conversions: perf.purchases || 0,
        revenue: perf.purchaseValue || 0,
        impressions: perf.impressions || 0,
        clicks: perf.clicks || 0,
      });
    }
  }

  // Compute derived metrics per campaign and sort by spend
  const campaigns = Array.from(campaignMap.values())
    .map(c => ({
      ...c,
      roas: c.spend > 0 && c.revenue ? c.revenue / c.spend : undefined,
      cpa: c.conversions && c.conversions > 0 ? c.spend / c.conversions : undefined,
      ctr: c.impressions && c.impressions > 0 ? ((c.clicks || 0) / c.impressions) * 100 : undefined,
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, MAX_CAMPAIGNS);

  // Load top ads with rolling metrics + creative DNA
  const topCreatives = await loadTopCreatives(clientId);

  return { campaigns, topCreatives };
}

async function loadTopCreatives(clientId: string): Promise<CreativeSummary[]> {
  // Get top ads by spend from rolling metrics
  const rollingSnap = await db.collection('entity_rolling_metrics')
    .where('clientId', '==', clientId)
    .where('level', '==', 'ad')
    .orderBy('spend_7d', 'desc')
    .limit(MAX_CREATIVES)
    .get();

  if (rollingSnap.empty) return [];

  const adIds = rollingSnap.docs.map(d => d.data().entityId as string);

  // Batch load creative DNA
  const dnaMap = new Map<string, string>();
  const dnaDocs = await Promise.all(
    adIds.map(adId =>
      db.collection('creative_dna').doc(`${clientId}__${adId}`).get()
    )
  );
  for (const doc of dnaDocs) {
    if (doc.exists) {
      const data = doc.data()!;
      const vision = data.vision || {};
      const copy = data.copy || {};
      // Compact DNA string
      const parts = [
        vision.visualStyle,
        vision.hookType ? `${vision.hookType} hook` : null,
        vision.hasFace ? 'face' : null,
        vision.hasProduct ? 'product' : null,
        copy.messageType ? `${copy.messageType} copy` : null,
        data.format?.toLowerCase(),
      ].filter(Boolean);
      dnaMap.set(doc.id.replace(`${clientId}__`, ''), parts.join(' + '));
    }
  }

  return rollingSnap.docs.map(doc => {
    const d = doc.data();
    const adId = d.entityId as string;
    return {
      adId,
      format: d.format || 'UNKNOWN',
      spend: d.spend_7d || 0,
      impressions: d.impressions_7d,
      hookRate: d.hook_rate_7d,
      holdRate: d.hold_rate_7d,
      ctr: d.ctr_7d,
      dna: dnaMap.get(adId),
    };
  });
}

function loadGoogleDetails(snapshots: ChannelDailySnapshot[]): ChannelDetails {
  // Extract campaign breakdown from rawData
  const campaignMap = new Map<string, CampaignSummary>();

  for (const snap of snapshots) {
    const campaigns = (snap.rawData?.campaigns as any[]) || [];
    for (const c of campaigns) {
      const id = String(c.id || c.campaignId || c.name);
      const existing = campaignMap.get(id);
      if (existing) {
        existing.spend += c.spend || 0;
        existing.conversions = (existing.conversions || 0) + (c.conversions || 0);
        existing.revenue = (existing.revenue || 0) + (c.revenue || 0);
        existing.impressions = (existing.impressions || 0) + (c.impressions || 0);
        existing.clicks = (existing.clicks || 0) + (c.clicks || 0);
      } else {
        campaignMap.set(id, {
          id,
          name: c.name || id,
          type: c.type || c.campaignType,
          status: c.status,
          spend: c.spend || 0,
          conversions: c.conversions || 0,
          revenue: c.revenue || 0,
          impressions: c.impressions || 0,
          clicks: c.clicks || 0,
          qualityScore: c.qualityScore,
          impressionShare: c.impressionShare,
        });
      }
    }
  }

  const campaigns = Array.from(campaignMap.values())
    .map(c => ({
      ...c,
      roas: c.spend > 0 && c.revenue ? c.revenue / c.spend : undefined,
      cpa: c.conversions && c.conversions > 0 ? c.spend / c.conversions : undefined,
      ctr: c.impressions && c.impressions > 0 ? ((c.clicks || 0) / c.impressions) * 100 : undefined,
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, MAX_CAMPAIGNS);

  return { campaigns };
}

function loadGA4Details(snapshots: ChannelDailySnapshot[]): ChannelDetails {
  // Aggregate traffic sources across snapshots
  const sourceMap = new Map<string, { sessions: number; conversions: number; revenue: number; wBounce: number }>();
  const pageMap = new Map<string, { sessions: number; conversions: number; wBounce: number }>();
  const deviceMap = new Map<string, { sessions: number; conversions: number; wBounce: number }>();

  for (const snap of snapshots) {
    for (const src of ((snap.rawData?.trafficSources as any[]) || [])) {
      const key = `${src.source} / ${src.medium}`;
      const ex = sourceMap.get(key);
      if (ex) {
        ex.sessions += src.sessions || 0;
        ex.conversions += src.conversions || 0;
        ex.revenue += src.revenue || 0;
        ex.wBounce += (src.bounceRate || 0) * (src.sessions || 0);
      } else {
        sourceMap.set(key, { sessions: src.sessions || 0, conversions: src.conversions || 0, revenue: src.revenue || 0, wBounce: (src.bounceRate || 0) * (src.sessions || 0) });
      }
    }
    for (const p of ((snap.rawData?.topLandingPages as any[]) || [])) {
      const key = p.pagePath;
      const ex = pageMap.get(key);
      if (ex) {
        ex.sessions += p.sessions || 0;
        ex.conversions += p.conversions || 0;
        ex.wBounce += (p.bounceRate || 0) * (p.sessions || 0);
      } else {
        pageMap.set(key, { sessions: p.sessions || 0, conversions: p.conversions || 0, wBounce: (p.bounceRate || 0) * (p.sessions || 0) });
      }
    }
    for (const d of ((snap.rawData?.deviceBreakdown as any[]) || [])) {
      const key = d.category;
      const ex = deviceMap.get(key);
      if (ex) {
        ex.sessions += d.sessions || 0;
        ex.conversions += d.conversions || 0;
        ex.wBounce += (d.bounceRate || 0) * (d.sessions || 0);
      } else {
        deviceMap.set(key, { sessions: d.sessions || 0, conversions: d.conversions || 0, wBounce: (d.bounceRate || 0) * (d.sessions || 0) });
      }
    }
  }

  const trafficSources = Array.from(sourceMap.entries())
    .map(([name, d]) => ({ name, sessions: d.sessions, conversions: d.conversions, revenue: d.revenue, bounceRate: d.sessions > 0 ? d.wBounce / d.sessions : 0 }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 15);

  const topLandingPages = Array.from(pageMap.entries())
    .map(([path, d]) => ({ path, sessions: d.sessions, conversions: d.conversions, bounceRate: d.sessions > 0 ? d.wBounce / d.sessions : 0 }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 10);

  const deviceBreakdown = Array.from(deviceMap.entries())
    .map(([category, d]) => ({ category, sessions: d.sessions, conversions: d.conversions, bounceRate: d.sessions > 0 ? d.wBounce / d.sessions : 0 }))
    .sort((a, b) => b.sessions - a.sessions);

  return { trafficSources, topLandingPages, deviceBreakdown };
}

function loadEcommerceDetails(snapshots: ChannelDailySnapshot[]): ChannelDetails {
  // Top products aggregated across period
  const productMap = new Map<string, ProductSummary>();
  // Attribution sources aggregated
  const attrMap = new Map<string, { orders: number; revenue: number }>();

  for (const snap of snapshots) {
    // Products
    const products = (snap.rawData?.topProducts as any[]) || [];
    for (const p of products) {
      const name = p.name || p.title || 'Unknown';
      const existing = productMap.get(name);
      if (existing) {
        existing.orders += p.orders || p.quantity || 0;
        existing.revenue += p.revenue || p.totalRevenue || 0;
      } else {
        productMap.set(name, {
          name,
          orders: p.orders || p.quantity || 0,
          revenue: p.revenue || p.totalRevenue || 0,
        });
      }
    }

    // Attribution
    const attribution = (snap.rawData?.attributionBreakdown as Record<string, any>) || {};
    for (const [source, data] of Object.entries(attribution)) {
      const existing = attrMap.get(source);
      if (existing) {
        existing.orders += data.orders || 0;
        existing.revenue += data.revenue || 0;
      } else {
        attrMap.set(source, {
          orders: data.orders || 0,
          revenue: data.revenue || 0,
        });
      }
    }
  }

  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, MAX_PRODUCTS);

  // Compute attribution percentages
  const totalAttrOrders = Array.from(attrMap.values()).reduce((s, v) => s + v.orders, 0);
  const attribution: Record<string, { orders: number; revenue: number; percentage?: number }> = {};
  for (const [source, data] of attrMap.entries()) {
    attribution[source] = {
      ...data,
      percentage: totalAttrOrders > 0 ? (data.orders / totalAttrOrders) * 100 : undefined,
    };
  }

  return { topProducts, attribution };
}

function loadEmailDetails(snapshots: ChannelDailySnapshot[]): ChannelDetails {
  const campaignMap = new Map<string, { name: string; sent: number; opens: number; clicks: number; revenue: number }>();
  const automationMap = new Map<string, { name: string; sent: number; opens: number; clicks: number; revenue: number }>();

  for (const snap of snapshots) {
    // Campaigns from rawData
    const campaigns = (snap.rawData?.campaigns as any[]) || [];
    for (const c of campaigns) {
      const name = c.name || c.subject || 'Unknown';
      const existing = campaignMap.get(name);
      if (existing) {
        existing.sent += c.sent || c.recipients || 0;
        existing.opens += c.opens || 0;
        existing.clicks += c.clicks || c.emailClicks || 0;
        existing.revenue += c.revenue || c.emailRevenue || 0;
      } else {
        campaignMap.set(name, {
          name,
          sent: c.sent || c.recipients || 0,
          opens: c.opens || 0,
          clicks: c.clicks || c.emailClicks || 0,
          revenue: c.revenue || c.emailRevenue || 0,
        });
      }
    }

    // Automations/flows from rawData
    const automations = (snap.rawData?.automations as any[]) || (snap.rawData?.flows as any[]) || [];
    for (const a of automations) {
      const name = a.name || 'Unknown';
      const existing = automationMap.get(name);
      if (existing) {
        existing.sent += a.sent || a.recipients || 0;
        existing.opens += a.opens || 0;
        existing.clicks += a.clicks || a.emailClicks || 0;
        existing.revenue += a.revenue || a.emailRevenue || 0;
      } else {
        automationMap.set(name, {
          name,
          sent: a.sent || a.recipients || 0,
          opens: a.opens || 0,
          clicks: a.clicks || a.emailClicks || 0,
          revenue: a.revenue || a.emailRevenue || 0,
        });
      }
    }
  }

  const topCampaigns = Array.from(campaignMap.values())
    .map(c => ({
      name: c.name,
      sent: c.sent,
      openRate: c.sent > 0 ? (c.opens / c.sent) * 100 : undefined,
      clickRate: c.sent > 0 ? (c.clicks / c.sent) * 100 : undefined,
      revenue: c.revenue > 0 ? c.revenue : undefined,
    }))
    .sort((a, b) => b.sent - a.sent)
    .slice(0, MAX_EMAIL_CAMPAIGNS);

  const automations = Array.from(automationMap.values())
    .map(a => ({
      name: a.name,
      sent: a.sent,
      openRate: a.sent > 0 ? (a.opens / a.sent) * 100 : undefined,
      clickRate: a.sent > 0 ? (a.clicks / a.sent) * 100 : undefined,
      revenue: a.revenue > 0 ? a.revenue : undefined,
    }))
    .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
    .slice(0, MAX_AUTOMATIONS);

  return { topCampaigns, automations };
}

// ── Creative Briefs Detail Loader ────────────────────────

const MAX_ADS_PER_ANGLE = 3;
const MAX_LIBRARY_REFS = 10;

async function loadCreativeBriefDetails(clientId: string): Promise<ChannelDetails> {
  // Load top creatives with DNA (reuse existing function)
  const topCreatives = await loadTopCreatives(clientId);

  // Load full DNA records for angle grouping
  const dnaSnap = await db.collection('creative_dna')
    .where('clientId', '==', clientId)
    .get();

  // Build hookType → adIds mapping from DNA
  const angleMap = new Map<string, CreativeSummary[]>();
  const dnaByAdId = new Map<string, any>();

  for (const doc of dnaSnap.docs) {
    const data = doc.data();
    const adId = data.adId as string;
    dnaByAdId.set(adId, data);
    const hookType = data.vision?.hookType as string;
    if (hookType) {
      if (!angleMap.has(hookType)) angleMap.set(hookType, []);
    }
  }

  // Place top creatives into angle groups
  for (const creative of topCreatives) {
    const dna = dnaByAdId.get(creative.adId);
    const hookType = dna?.vision?.hookType as string;
    if (hookType && angleMap.has(hookType)) {
      const group = angleMap.get(hookType)!;
      if (group.length < MAX_ADS_PER_ANGLE) {
        group.push(creative);
      }
    }
  }

  // Build winning angle groups (only those with ads)
  const winningByAngle: WinningAngleGroup[] = [];
  for (const [angle, ads] of angleMap.entries()) {
    if (ads.length > 0) {
      winningByAngle.push({ angle, ads });
    }
  }

  // Load diversity score for client
  let diversityScore: DiversityScoreSummary | undefined;
  try {
    const divDoc = await db.collection('creative_diversity_scores').doc(clientId).get();
    if (divDoc.exists) {
      const d = divDoc.data()!;
      diversityScore = {
        score: d.score || 0,
        dominantStyle: d.dominantStyle,
        dominantHook: d.dominantHookType,
        formatDistribution: d.formatDistribution,
      };
    }
  } catch (_e) { /* optional data */ }

  // Load winning ads library (cross-client references)
  let libraryReferences: WinningAdReference[] = [];
  try {
    const libSnap = await db.collection('winning_ads_library')
      .where('active', '==', true)
      .limit(MAX_LIBRARY_REFS)
      .get();

    libraryReferences = libSnap.docs.map(doc => {
      const d = doc.data();
      return {
        angle: d.angle || '',
        format: d.format || '',
        description: d.description || '',
        whyItWorked: d.whyItWorked || '',
        keyElements: d.keyElements || [],
        visualStyle: d.visualStyle || '',
        metrics: d.metrics,
      };
    });
  } catch (_e) { /* collection may not exist yet */ }

  return {
    topCreatives,
    winningByAngle,
    libraryReferences,
    diversityScore,
  };
}

// ── Leads Details ──────────────────────────────────────

const MAX_CLOSERS = 10;
const MAX_UTM_CAMPAIGNS = 10;

function loadLeadsDetails(snapshots: ChannelDailySnapshot[]): ChannelDetails {
  // Aggregate funnel stages
  let totalLeads = 0, qualified = 0, attended = 0, noShows = 0, newClients = 0;
  const closerMap = new Map<string, LeadsCloserSummary>();
  const utmMap = new Map<string, LeadsUtmSummary>();

  for (const snap of snapshots) {
    totalLeads += snap.metrics.totalLeads || 0;
    qualified += snap.metrics.qualifiedLeads || 0;
    attended += snap.metrics.attendedCalls || 0;
    noShows += snap.metrics.noShows || 0;
    newClients += snap.metrics.newClients || 0;

    // Closer breakdown from rawData
    const closers = (snap.rawData?.byCloser as any[]) || [];
    for (const c of closers) {
      const key = c.closer || 'Sin asignar';
      const ex = closerMap.get(key);
      if (ex) {
        ex.totalLeads += c.totalLeads || 0;
        ex.qualified += c.qualified || 0;
        ex.attended += c.attended || 0;
        ex.newClients += c.newClients || 0;
        ex.revenue += c.revenue || 0;
      } else {
        closerMap.set(key, {
          closer: key,
          totalLeads: c.totalLeads || 0,
          qualified: c.qualified || 0,
          attended: c.attended || 0,
          newClients: c.newClients || 0,
          revenue: c.revenue || 0,
          closeRate: 0,
        });
      }
    }

    // UTM breakdown from rawData
    const utms = (snap.rawData?.byUtmCampaign as any[]) || [];
    for (const u of utms) {
      const key = u.campaign || 'Sin UTM';
      const ex = utmMap.get(key);
      if (ex) {
        ex.totalLeads += u.totalLeads || 0;
        ex.qualified += u.qualified || 0;
        ex.revenue += u.revenue || 0;
      } else {
        utmMap.set(key, {
          campaign: key,
          totalLeads: u.totalLeads || 0,
          qualified: u.qualified || 0,
          qualificationRate: 0,
          revenue: u.revenue || 0,
        });
      }
    }
  }

  // Build funnel stages
  const funnelStages: LeadsFunnelStageSummary[] = [
    { stage: 'Leads', count: totalLeads, pct: 100 },
    { stage: 'Calificados', count: qualified, pct: totalLeads > 0 ? (qualified / totalLeads) * 100 : 0 },
    { stage: 'Asistieron', count: attended, pct: totalLeads > 0 ? (attended / totalLeads) * 100 : 0 },
    { stage: 'Nuevos Clientes', count: newClients, pct: totalLeads > 0 ? (newClients / totalLeads) * 100 : 0 },
  ];

  // Recompute rates for closers
  const closerPerformance = Array.from(closerMap.values())
    .map(c => ({ ...c, closeRate: c.attended > 0 ? (c.newClients / c.attended) * 100 : 0 }))
    .sort((a, b) => b.newClients - a.newClients)
    .slice(0, MAX_CLOSERS);

  // Recompute rates for UTM
  const utmAttribution = Array.from(utmMap.values())
    .map(u => ({ ...u, qualificationRate: u.totalLeads > 0 ? (u.qualified / u.totalLeads) * 100 : 0 }))
    .sort((a, b) => b.totalLeads - a.totalLeads)
    .slice(0, MAX_UTM_CAMPAIGNS);

  return { funnelStages, closerPerformance, utmAttribution };
}

// ── Aggregation Utilities ───────────────────────────────

function fetchSnapshots(
  clientId: string,
  channel: ChannelType,
  startDate: string,
  endDate: string,
): Promise<ChannelDailySnapshot[]> {
  return db.collection('channel_snapshots')
    .where('clientId', '==', clientId)
    .where('channel', '==', channel)
    .where('date', '>=', startDate)
    .where('date', '<=', endDate)
    .orderBy('date', 'desc')
    .get()
    .then(snap => snap.docs.map(doc => doc.data() as ChannelDailySnapshot));
}

/** Sum additive metrics across daily snapshots */
function aggregateSnapshots(snapshots: ChannelDailySnapshot[]): Record<string, number | undefined> {
  const result: Record<string, number> = {};

  for (const snap of snapshots) {
    for (const key of ADDITIVE_METRICS) {
      const val = (snap.metrics as Record<string, number | undefined>)[key];
      if (val != null && isFinite(val)) {
        result[key] = (result[key] || 0) + val;
      }
    }
  }

  return result;
}

/** Add derived metrics (ROAS, CPA, CTR, etc.) to an aggregated summary */
function addDerivedMetrics(summary: Record<string, number | undefined>): void {
  const spend = summary.spend || 0;
  const revenue = summary.revenue || 0;
  const conversions = summary.conversions || 0;
  const impressions = summary.impressions || 0;
  const clicks = summary.clicks || 0;
  const orders = summary.orders || 0;
  const sent = summary.sent || 0;
  const opens = summary.opens || 0;
  const emailClicks = summary.emailClicks || 0;

  // Ads derived
  if (spend > 0 && revenue > 0) summary.roas = revenue / spend;
  if (spend > 0 && conversions > 0) summary.cpa = spend / conversions;
  if (impressions > 0 && clicks > 0) summary.ctr = (clicks / impressions) * 100;
  if (clicks > 0) summary.cpc = spend / clicks;
  if (impressions > 0) summary.cpm = (spend / impressions) * 1000;

  // Ecommerce derived
  if (orders > 0 && revenue > 0) summary.avgOrderValue = revenue / orders;

  // Email derived
  if (sent > 0 && opens > 0) summary.openRate = (opens / sent) * 100;
  if (sent > 0 && emailClicks > 0) summary.clickRate = (emailClicks / sent) * 100;
  if (sent > 0 && summary.emailRevenue) summary.revenuePerRecipient = summary.emailRevenue / sent;

  // Leads derived
  const totalLeads = summary.totalLeads || 0;
  const qualifiedLeads = summary.qualifiedLeads || 0;
  const attendedCalls = summary.attendedCalls || 0;
  const noShows = summary.noShows || 0;
  const newClients = summary.newClients || 0;
  if (totalLeads > 0 && qualifiedLeads > 0) summary.qualificationRate = (qualifiedLeads / totalLeads) * 100;
  const scheduled = attendedCalls + noShows;
  if (scheduled > 0) summary.attendanceRate = (attendedCalls / scheduled) * 100;
  if (attendedCalls > 0 && newClients > 0) summary.closeRate = (newClients / attendedCalls) * 100;
}

/** Compute % delta between current and previous period metrics */
function computeDeltas(
  current: Record<string, number | undefined>,
  previous: Record<string, number | undefined>,
): Record<string, number | undefined> {
  const result: Record<string, number | undefined> = {};
  const keys = new Set([...Object.keys(current), ...Object.keys(previous)]);

  for (const key of keys) {
    const curr = current[key];
    const prev = previous[key];
    if (curr != null && prev != null && prev !== 0) {
      result[key] = ((curr - prev) / Math.abs(prev)) * 100;
    }
  }

  return result;
}

/** Single metric delta helper */
function delta(current: number, previous: number): number | undefined {
  if (previous === 0) return current > 0 ? 100 : undefined;
  return ((current - previous) / Math.abs(previous)) * 100;
}

// ── Date Utilities ──────────────────────────────────────

function daysBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - days);
  return formatDate(d);
}
