/**
 * XML Formatter — AI Analyst
 *
 * Converts AnalystContext to semantic XML that Claude interprets
 * better than JSON. XML tags provide clear boundaries and Claude
 * was specifically trained to recognize XML as a prompt organizing mechanism.
 *
 * Rules:
 * - Only include attributes with values (omit null/undefined)
 * - Round numbers to 2 decimal places
 * - Percentages with sign (+/-) in vs_previous
 * - Monetary values as raw numbers (Claude knows the currency from client config)
 */

import type {
  AnalystContext,
  AnalystChannelData,
  CampaignSummary,
  CreativeSummary,
  ProductSummary,
  AttributionSource,
  AutomationSummary,
  EmailCampaignSummary,
  CrossChannelInsights,
  WinningAngleGroup,
  WinningAdReference,
  DiversityScoreSummary,
} from './types';

/**
 * Format the full AnalystContext as XML for Claude's system prompt.
 */
export function formatContextAsXml(context: AnalystContext): string {
  const lines: string[] = [];
  lines.push('<business_data schema_version="1.0">');

  // ── Client config ──
  lines.push(formatClient(context));

  // ── Period ──
  lines.push(formatPeriod(context));

  // ── Channel data ──
  lines.push(formatChannel(context.channel));

  // ── Cross-channel insights (if present) ──
  if (context.cross_channel_insights) {
    lines.push(formatCrossChannel(context.cross_channel_insights));
  }

  lines.push('</business_data>');
  return lines.join('\n');
}

// ── Helpers ──────────────────────────────────────────────

function formatClient(ctx: AnalystContext): string {
  const m = ctx._meta;
  const attrs = buildAttrs({
    name: m.clientName,
    business_type: m.businessType,
    currency: m.currency,
    timezone: m.timezone,
    growth_mode: m.growthMode,
    funnel_priority: m.funnelPriority,
  });

  const targetAttrs = buildAttrs(m.targets);
  const targetLine = targetAttrs ? `\n    <targets ${targetAttrs} />` : '';

  return `  <client ${attrs}>${targetLine}\n  </client>`;
}

function formatPeriod(ctx: AnalystContext): string {
  const p = ctx._meta.period;
  const prev = ctx._meta.previousPeriod;
  return [
    `  <period current_start="${p.start}" current_end="${p.end}" days="${p.days}">`,
    `    <previous start="${prev.start}" end="${prev.end}" />`,
    `  </period>`,
  ].join('\n');
}

function formatChannel(ch: AnalystChannelData): string {
  const tag = channelTag(ch.id);
  const lines: string[] = [];
  lines.push(`  <${tag}>`);

  // Summary
  const summaryAttrs = buildAttrs(ch.summary);
  if (summaryAttrs) {
    lines.push(`    <summary ${summaryAttrs} />`);
  }

  // vs_previous
  const deltaAttrs = buildDeltaAttrs(ch.vs_previous);
  if (deltaAttrs) {
    lines.push(`    <vs_previous ${deltaAttrs} />`);
  }

  // Channel-specific details
  const d = ch.details;

  if (d.campaigns && d.campaigns.length > 0) {
    lines.push('    <campaigns>');
    for (const c of d.campaigns) {
      lines.push(`      <campaign ${formatCampaign(c)} />`);
    }
    lines.push('    </campaigns>');
  }

  if (d.topCreatives && d.topCreatives.length > 0) {
    lines.push('    <top_creatives>');
    for (const c of d.topCreatives) {
      lines.push(`      <creative ${formatCreative(c)} />`);
    }
    lines.push('    </top_creatives>');
  }

  if (d.topProducts && d.topProducts.length > 0) {
    lines.push('    <top_products>');
    for (const p of d.topProducts) {
      lines.push(`      <product ${buildAttrs({ name: p.name, orders: p.orders, revenue: round(p.revenue) })} />`);
    }
    lines.push('    </top_products>');
  }

  if (d.attribution && Object.keys(d.attribution).length > 0) {
    lines.push('    <attribution>');
    for (const [source, data] of Object.entries(d.attribution)) {
      lines.push(`      <source ${formatAttribution(source, data)} />`);
    }
    lines.push('    </attribution>');
  }

  if (d.topCampaigns && d.topCampaigns.length > 0) {
    lines.push('    <email_campaigns>');
    for (const c of d.topCampaigns) {
      lines.push(`      <campaign ${formatEmailCampaign(c)} />`);
    }
    lines.push('    </email_campaigns>');
  }

  if (d.automations && d.automations.length > 0) {
    lines.push('    <automations>');
    for (const a of d.automations) {
      lines.push(`      <automation ${formatAutomation(a)} />`);
    }
    lines.push('    </automations>');
  }

  // Creative Briefs: winning patterns by angle
  if (d.winningByAngle && d.winningByAngle.length > 0) {
    lines.push('    <winning_patterns>');
    for (const group of d.winningByAngle) {
      lines.push(`      <by_angle name="${escapeXml(group.angle)}" count="${group.ads.length}">`);
      for (const ad of group.ads) {
        lines.push(`        <ad ${formatCreative(ad)} />`);
      }
      lines.push('      </by_angle>');
    }
    lines.push('    </winning_patterns>');
  }

  // Creative Briefs: library references (cross-client)
  if (d.libraryReferences && d.libraryReferences.length > 0) {
    lines.push('    <library_references>');
    for (const ref of d.libraryReferences) {
      const attrs = buildAttrs({
        angle: ref.angle,
        format: ref.format,
        visual_style: ref.visualStyle,
        description: ref.description,
        why_it_worked: ref.whyItWorked,
        key_elements: ref.keyElements.join(', '),
        hook_rate: ref.metrics?.hookRate != null ? formatPct(ref.metrics.hookRate) : undefined,
        ctr: ref.metrics?.ctr != null ? formatPct(ref.metrics.ctr) : undefined,
        cpa: ref.metrics?.cpa != null ? round(ref.metrics.cpa) : undefined,
      });
      lines.push(`      <reference ${attrs} />`);
    }
    lines.push('    </library_references>');
  }

  // Creative Briefs: diversity score
  if (d.diversityScore) {
    const ds = d.diversityScore;
    const attrs = buildAttrs({
      score: round(ds.score),
      dominant_style: ds.dominantStyle,
      dominant_hook: ds.dominantHook,
    });
    let formatDist = '';
    if (ds.formatDistribution) {
      formatDist = ' ' + Object.entries(ds.formatDistribution)
        .map(([k, v]) => `${k.toLowerCase()}="${v}"`)
        .join(' ');
    }
    lines.push(`    <diversity_score ${attrs}${formatDist} />`);
  }

  // GA4: traffic sources
  if (d.trafficSources && d.trafficSources.length > 0) {
    lines.push('    <traffic_sources>');
    for (const src of d.trafficSources) {
      lines.push(`      <source ${buildAttrs({ name: src.name, sessions: src.sessions, conversions: src.conversions, revenue: round(src.revenue), bounce_rate: formatPct(src.bounceRate) })} />`);
    }
    lines.push('    </traffic_sources>');
  }

  // GA4: landing pages
  if (d.topLandingPages && d.topLandingPages.length > 0) {
    lines.push('    <top_landing_pages>');
    for (const p of d.topLandingPages) {
      lines.push(`      <page ${buildAttrs({ path: p.path, sessions: p.sessions, bounce_rate: formatPct(p.bounceRate), conversions: p.conversions })} />`);
    }
    lines.push('    </top_landing_pages>');
  }

  // GA4: device breakdown
  if (d.deviceBreakdown && d.deviceBreakdown.length > 0) {
    lines.push('    <devices>');
    for (const dev of d.deviceBreakdown) {
      lines.push(`      <device ${buildAttrs({ category: dev.category, sessions: dev.sessions, bounce_rate: formatPct(dev.bounceRate), conversions: dev.conversions })} />`);
    }
    lines.push('    </devices>');
  }

  // Cross-channel: per-channel summaries
  if (d.channelSummaries) {
    for (const [chName, summary] of Object.entries(d.channelSummaries)) {
      const attrs = buildAttrs(summary);
      if (attrs) {
        lines.push(`    <${chName}_summary ${attrs} />`);
      }
    }
  }

  lines.push(`  </${tag}>`);
  return lines.join('\n');
}

function formatCrossChannel(insights: CrossChannelInsights): string {
  const lines: string[] = [];
  lines.push('  <cross_channel_insights>');

  if (insights.attribution_gap) {
    const g = insights.attribution_gap;
    lines.push(`    <attribution_gap ${buildAttrs({
      meta_reported: round(g.meta_reported),
      google_reported: g.google_reported != null ? round(g.google_reported) : undefined,
      ecommerce_real: round(g.ecommerce_real),
      gap_pct: formatPct(g.gap_pct),
    })} />`);
  }

  if (insights.spend_distribution) {
    const attrs = Object.entries(insights.spend_distribution)
      .map(([k, v]) => `${k}="${formatPct(v)}"`)
      .join(' ');
    lines.push(`    <spend_distribution ${attrs} />`);
  }

  if (insights.email_vs_paid) {
    lines.push(`    <email_vs_paid ${buildAttrs({
      email_revenue: insights.email_vs_paid.email_revenue != null ? round(insights.email_vs_paid.email_revenue) : undefined,
      paid_spend: insights.email_vs_paid.paid_spend != null ? round(insights.email_vs_paid.paid_spend) : undefined,
      paid_revenue: insights.email_vs_paid.paid_revenue != null ? round(insights.email_vs_paid.paid_revenue) : undefined,
    })} />`);
  }

  lines.push('  </cross_channel_insights>');
  return lines.join('\n');
}

// ── Item formatters ──────────────────────────────────────

function formatCampaign(c: CampaignSummary): string {
  return buildAttrs({
    id: c.id,
    name: c.name,
    status: c.status,
    objective: c.objective,
    type: c.type,
    spend: round(c.spend),
    conversions: c.conversions,
    revenue: c.revenue != null ? round(c.revenue) : undefined,
    roas: c.roas != null ? round(c.roas) : undefined,
    cpa: c.cpa != null ? round(c.cpa) : undefined,
    ctr: c.ctr != null ? formatPct(c.ctr) : undefined,
    impressions: c.impressions,
    clicks: c.clicks,
    quality_score: c.qualityScore,
    impression_share: c.impressionShare != null ? formatPct(c.impressionShare) : undefined,
    hook_rate: c.hookRate != null ? formatPct(c.hookRate) : undefined,
    hold_rate: c.holdRate != null ? formatPct(c.holdRate) : undefined,
  });
}

function formatCreative(c: CreativeSummary): string {
  return buildAttrs({
    ad_id: c.adId,
    format: c.format,
    spend: round(c.spend),
    impressions: c.impressions,
    hook_rate: c.hookRate != null ? formatPct(c.hookRate) : undefined,
    hold_rate: c.holdRate != null ? formatPct(c.holdRate) : undefined,
    ctr: c.ctr != null ? formatPct(c.ctr) : undefined,
    dna: c.dna,
  });
}

function formatAttribution(source: string, data: AttributionSource): string {
  return buildAttrs({
    name: source,
    orders: data.orders,
    revenue: round(data.revenue),
    pct: data.percentage != null ? formatPct(data.percentage) : undefined,
  });
}

function formatEmailCampaign(c: EmailCampaignSummary): string {
  return buildAttrs({
    name: c.name,
    sent: c.sent,
    open_rate: c.openRate != null ? formatPct(c.openRate) : undefined,
    click_rate: c.clickRate != null ? formatPct(c.clickRate) : undefined,
    revenue: c.revenue != null ? round(c.revenue) : undefined,
  });
}

function formatAutomation(a: AutomationSummary): string {
  return buildAttrs({
    name: a.name,
    sent: a.sent,
    open_rate: a.openRate != null ? formatPct(a.openRate) : undefined,
    click_rate: a.clickRate != null ? formatPct(a.clickRate) : undefined,
    revenue: a.revenue != null ? round(a.revenue) : undefined,
  });
}

// ── Utility functions ────────────────────────────────────

/** Build XML attribute string from a record, omitting null/undefined values */
function buildAttrs(obj: Record<string, unknown>): string {
  return Object.entries(obj)
    .filter(([, v]) => v != null && v !== '' && v !== undefined)
    .map(([k, v]) => `${k}="${escapeXml(String(v))}"`)
    .join(' ');
}

/** Build delta attributes with +/- sign prefix for percentages */
function buildDeltaAttrs(deltas: Record<string, number | undefined>): string {
  return Object.entries(deltas)
    .filter(([, v]) => v != null && isFinite(v as number))
    .map(([k, v]) => {
      const val = round(v as number);
      const sign = val > 0 ? '+' : '';
      return `${k}="${sign}${val}%"`;
    })
    .join(' ');
}

/** Map ChannelId to XML tag name */
function channelTag(id: string): string {
  const tags: Record<string, string> = {
    meta_ads: 'meta_channel',
    google_ads: 'google_channel',
    ecommerce: 'ecommerce_channel',
    email: 'email_channel',
    cross_channel: 'cross_channel',
    creative_briefs: 'creative_briefs_channel',
  };
  return tags[id] || id;
}

/** Round to 2 decimal places */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Format number as percentage string */
function formatPct(n: number): string {
  return `${round(n)}%`;
}

/** Escape XML special characters in attribute values */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
