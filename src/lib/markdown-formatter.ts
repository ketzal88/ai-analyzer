/**
 * Markdown Formatter — Export for LLM
 *
 * Converts AnalystContext into structured markdown tables
 * optimized for pasting into ChatGPT/Claude for analysis.
 * Mirrors the xml-formatter.ts structure but outputs markdown.
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
  GA4TrafficSourceSummary,
  GA4LandingPageSummary,
  GA4DeviceSummary,
} from './ai-analyst/types';

// ── Main Formatter ──────────────────────────────────────

export function formatContextAsMarkdown(context: AnalystContext): string {
  const lines: string[] = [];

  // Header
  const m = context._meta;
  lines.push(`# Reporte: ${m.clientName} | ${m.period.start} → ${m.period.end} (${m.period.days} dias)`);
  lines.push('');

  // Business context
  lines.push('## Contexto del Negocio');
  const contextItems = [
    `Tipo: ${m.businessType}`,
    `Moneda: ${m.currency}`,
    m.growthMode ? `Modo de crecimiento: ${m.growthMode}` : null,
    m.funnelPriority ? `Prioridad funnel: ${m.funnelPriority}` : null,
  ].filter(Boolean);

  const targetItems = Object.entries(m.targets)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}: ${formatNum(v!)}`);

  lines.push(`- ${contextItems.join(' | ')}`);
  if (targetItems.length > 0) {
    lines.push(`- Targets: ${targetItems.join(', ')}`);
  }
  lines.push(`- Periodo anterior: ${m.previousPeriod.start} → ${m.previousPeriod.end}`);
  lines.push('');

  // Channel data
  lines.push(formatChannel(context.channel));

  // Cross-channel insights
  if (context.cross_channel_insights) {
    lines.push(formatCrossChannel(context.cross_channel_insights));
  }

  // Footer
  lines.push('---');
  lines.push('_Datos exportados desde Worker Brain. Pega este texto en ChatGPT o Claude para analisis._');

  return lines.join('\n');
}

// ── Channel Formatter ──────────────────────────────────

function formatChannel(ch: AnalystChannelData): string {
  const lines: string[] = [];
  const title = channelTitle(ch.id);
  lines.push(`## ${title}`);
  lines.push('');

  // Summary KPIs
  const summaryEntries = Object.entries(ch.summary)
    .filter(([, v]) => v != null && v !== '' && isFinite(Number(v)));
  if (summaryEntries.length > 0) {
    lines.push('### KPIs del Periodo');
    lines.push('| Metrica | Valor | Cambio vs Anterior |');
    lines.push('|---------|-------|--------------------|');
    for (const [key, val] of summaryEntries) {
      const delta = ch.vs_previous[key];
      const deltaStr = delta != null && isFinite(delta) ? formatDelta(delta) : '—';
      lines.push(`| ${formatKey(key)} | ${formatMetricValue(key, Number(val))} | ${deltaStr} |`);
    }
    lines.push('');
  }

  // Campaigns
  const d = ch.details;
  if (d.campaigns && d.campaigns.length > 0) {
    lines.push('### Campanas');
    lines.push('| Campana | Spend | Conv | CPA | ROAS | CTR | Impresiones |');
    lines.push('|---------|-------|------|-----|------|-----|-------------|');
    for (const c of d.campaigns) {
      lines.push(`| ${c.name} | ${fCur(c.spend)} | ${c.conversions ?? '—'} | ${c.cpa != null ? fCur(c.cpa) : '—'} | ${c.roas != null ? formatNum(c.roas) + 'x' : '—'} | ${c.ctr != null ? fPct(c.ctr) : '—'} | ${fNum(c.impressions)} |`);
    }
    lines.push('');
  }

  // Top creatives (Meta)
  if (d.topCreatives && d.topCreatives.length > 0) {
    lines.push('### Top Creativos (7d)');
    lines.push('| Formato | Spend | Hook Rate | Hold Rate | CTR | DNA |');
    lines.push('|---------|-------|-----------|-----------|-----|-----|');
    for (const c of d.topCreatives) {
      lines.push(`| ${c.format} | ${fCur(c.spend)} | ${c.hookRate != null ? fPct(c.hookRate) : '—'} | ${c.holdRate != null ? fPct(c.holdRate) : '—'} | ${c.ctr != null ? fPct(c.ctr) : '—'} | ${c.dna || '—'} |`);
    }
    lines.push('');
  }

  // Top products (Ecommerce)
  if (d.topProducts && d.topProducts.length > 0) {
    lines.push('### Top Productos');
    lines.push('| Producto | Ordenes | Revenue |');
    lines.push('|----------|---------|---------|');
    for (const p of d.topProducts) {
      lines.push(`| ${p.name} | ${p.orders} | ${fCur(p.revenue)} |`);
    }
    lines.push('');
  }

  // Attribution (Ecommerce)
  if (d.attribution && Object.keys(d.attribution).length > 0) {
    lines.push('### Atribucion');
    lines.push('| Fuente | Ordenes | Revenue | % |');
    lines.push('|--------|---------|---------|---|');
    for (const [source, data] of Object.entries(d.attribution)) {
      lines.push(`| ${source} | ${data.orders} | ${fCur(data.revenue)} | ${data.percentage != null ? fPct(data.percentage) : '—'} |`);
    }
    lines.push('');
  }

  // Email campaigns
  if (d.topCampaigns && d.topCampaigns.length > 0) {
    lines.push('### Campanas de Email');
    lines.push('| Campana | Enviados | Open Rate | Click Rate | Revenue |');
    lines.push('|---------|----------|-----------|------------|---------|');
    for (const c of d.topCampaigns) {
      lines.push(`| ${c.name} | ${fNum(c.sent)} | ${c.openRate != null ? fPct(c.openRate) : '—'} | ${c.clickRate != null ? fPct(c.clickRate) : '—'} | ${c.revenue != null ? fCur(c.revenue) : '—'} |`);
    }
    lines.push('');
  }

  // Automations
  if (d.automations && d.automations.length > 0) {
    lines.push('### Automaciones / Flows');
    lines.push('| Nombre | Enviados | Open Rate | Click Rate | Revenue |');
    lines.push('|--------|----------|-----------|------------|---------|');
    for (const a of d.automations) {
      lines.push(`| ${a.name} | ${fNum(a.sent)} | ${a.openRate != null ? fPct(a.openRate) : '—'} | ${a.clickRate != null ? fPct(a.clickRate) : '—'} | ${a.revenue != null ? fCur(a.revenue) : '—'} |`);
    }
    lines.push('');
  }

  // GA4: traffic sources
  if (d.trafficSources && d.trafficSources.length > 0) {
    lines.push('### Fuentes de Trafico');
    lines.push('| Fuente | Sesiones | Conversiones | Revenue | Bounce Rate |');
    lines.push('|--------|----------|--------------|---------|-------------|');
    for (const src of d.trafficSources) {
      lines.push(`| ${src.name} | ${fNum(src.sessions)} | ${fNum(src.conversions)} | ${fCur(src.revenue)} | ${fPct(src.bounceRate)} |`);
    }
    lines.push('');
  }

  // GA4: landing pages
  if (d.topLandingPages && d.topLandingPages.length > 0) {
    lines.push('### Top Landing Pages');
    lines.push('| Pagina | Sesiones | Conversiones | Bounce Rate |');
    lines.push('|--------|----------|--------------|-------------|');
    for (const p of d.topLandingPages) {
      lines.push(`| ${p.path} | ${fNum(p.sessions)} | ${fNum(p.conversions)} | ${fPct(p.bounceRate)} |`);
    }
    lines.push('');
  }

  // GA4: devices
  if (d.deviceBreakdown && d.deviceBreakdown.length > 0) {
    lines.push('### Dispositivos');
    lines.push('| Dispositivo | Sesiones | Conversiones | Bounce Rate |');
    lines.push('|-------------|----------|--------------|-------------|');
    for (const dev of d.deviceBreakdown) {
      lines.push(`| ${dev.category} | ${fNum(dev.sessions)} | ${fNum(dev.conversions)} | ${fPct(dev.bounceRate)} |`);
    }
    lines.push('');
  }

  // Cross-channel: per-channel summaries
  if (d.channelSummaries) {
    for (const [chName, summary] of Object.entries(d.channelSummaries)) {
      const entries = Object.entries(summary).filter(([, v]) => v != null && isFinite(v as number));
      if (entries.length > 0) {
        lines.push(`### ${chName.charAt(0).toUpperCase() + chName.slice(1)} - Resumen`);
        lines.push('| Metrica | Valor |');
        lines.push('|---------|-------|');
        for (const [key, val] of entries) {
          lines.push(`| ${formatKey(key)} | ${formatMetricValue(key, val as number)} |`);
        }
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

// ── Cross-Channel Insights ─────────────────────────────

function formatCrossChannel(insights: CrossChannelInsights): string {
  const lines: string[] = [];
  lines.push('## Insights Cross-Channel');
  lines.push('');

  if (insights.attribution_gap) {
    const g = insights.attribution_gap;
    lines.push('### Gap de Atribucion');
    lines.push(`- Revenue reportado Meta: ${fCur(g.meta_reported)}`);
    if (g.google_reported != null) {
      lines.push(`- Revenue reportado Google: ${fCur(g.google_reported)}`);
    }
    lines.push(`- Revenue real (Ecommerce): ${fCur(g.ecommerce_real)}`);
    lines.push(`- Gap: ${fPct(g.gap_pct)}`);
    lines.push('');
  }

  if (insights.spend_distribution) {
    lines.push('### Distribucion de Inversion');
    for (const [ch, pct] of Object.entries(insights.spend_distribution)) {
      lines.push(`- ${ch}: ${fPct(pct)}`);
    }
    lines.push('');
  }

  if (insights.email_vs_paid) {
    const e = insights.email_vs_paid;
    lines.push('### Email vs Paid');
    if (e.email_revenue != null) lines.push(`- Revenue Email: ${fCur(e.email_revenue)}`);
    if (e.paid_spend != null) lines.push(`- Inversion Paid: ${fCur(e.paid_spend)}`);
    if (e.paid_revenue != null) lines.push(`- Revenue Paid: ${fCur(e.paid_revenue)}`);
    lines.push('');
  }

  return lines.join('\n');
}

// ── Utility Functions ──────────────────────────────────

function channelTitle(id: string): string {
  const titles: Record<string, string> = {
    meta_ads: 'Meta Ads',
    google_ads: 'Google Ads',
    ga4: 'Google Analytics 4',
    ecommerce: 'Ecommerce',
    email: 'Email Marketing',
    cross_channel: 'Cross-Channel',
    creative_briefs: 'Bajadas Creativas',
  };
  return titles[id] || id;
}

function formatKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

function formatMetricValue(key: string, val: number): string {
  const k = key.toLowerCase();
  if (k.includes('rate') || k === 'ctr' || k.includes('pct') || k.includes('percentage')) {
    return fPct(val);
  }
  if (k === 'roas' || k.includes('roas')) {
    return formatNum(val) + 'x';
  }
  if (k.includes('spend') || k.includes('revenue') || k === 'cpa' || k === 'cpc' || k === 'cpm' || k.includes('value') || k === 'avgordervvalue' || k.includes('shipping') || k.includes('discount') || k.includes('tax') || k.includes('refund')) {
    return fCur(val);
  }
  return fNum(val);
}

function formatDelta(delta: number): string {
  const sign = delta > 0 ? '+' : '';
  return `${sign}${round(delta)}%`;
}

function fCur(val: number | undefined): string {
  if (val == null) return '—';
  return `$${round(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fPct(val: number | undefined): string {
  if (val == null) return '—';
  return `${round(val)}%`;
}

function fNum(val: number | undefined): string {
  if (val == null) return '—';
  return Math.round(val).toLocaleString('en-US');
}

function formatNum(val: number): string {
  return round(val).toString();
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}