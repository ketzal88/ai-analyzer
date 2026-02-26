/**
 * MasterBrain — Worker Brain V2 Phase 4
 *
 * Orchestrates all Channel Brains and performs cross-channel correlation.
 *
 * Responsibilities:
 * 1. Run all enabled Channel Brains (Meta, Google, GA4, Ecommerce)
 * 2. Correlate signals across channels
 * 3. Detect cross-channel patterns and anomalies
 * 4. Generate unified strategic recommendations
 * 5. Calculate true Blended ROAS using ecommerce data
 *
 * Output: MasterBrainAnalysis with unified insights
 */

import { MetaBrain } from "./meta-brain";
import { GoogleBrain } from "./google-brain";
import { GA4Brain } from "./ga4-brain";
import { EcommerceBrain } from "./ecommerce-brain";
import { ChannelSignals, ChannelAlert, ClientConfigV2 } from "./channel-brain-interface";

export interface MasterBrainAnalysis {
  clientId: string;
  dateRange: { start: string; end: string };
  executionTime: number;

  // Individual channel results
  channels: {
    meta?: ChannelSignals;
    google?: ChannelSignals;
    ga4?: ChannelSignals;
    ecommerce?: ChannelSignals;
  };

  // Unified KPIs
  unified: {
    totalAdSpend: number;
    totalRevenue: number; // From ecommerce (source of truth)
    blendedRoas: number;
    totalConversions: number;
    avgCpa: number;
  };

  // Cross-channel alerts
  crossChannelAlerts: CrossChannelAlert[];

  // Strategic insights
  insights: StrategicInsight[];

  // Funnel analysis
  funnelDiagnostic: FunnelDiagnostic;
}

export interface CrossChannelAlert {
  type: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  affectedChannels: string[];
  correlations: Record<string, any>;
  recommendation: string;
}

export interface StrategicInsight {
  category: 'SCALING' | 'OPTIMIZATION' | 'TROUBLESHOOTING' | 'ATTRIBUTION';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  insight: string;
  evidence: string[];
  actions: string[];
}

export interface FunnelDiagnostic {
  stages: {
    name: string;
    metric: number;
    dropoff?: number;
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  }[];
  bottleneck?: string;
  recommendation?: string;
}

export class MasterBrain {
  /**
   * Run complete multi-channel analysis
   */
  async analyze(
    clientId: string,
    dateRange: { start: string; end: string },
    clientConfig: ClientConfigV2
  ): Promise<MasterBrainAnalysis> {
    const startTime = Date.now();

    // 1. Run all Channel Brains in parallel
    const channelResults = await this.runChannelBrains(clientId, dateRange, clientConfig);

    // 2. Calculate unified KPIs
    const unified = this.calculateUnifiedKPIs(channelResults);

    // 3. Detect cross-channel alerts
    const crossChannelAlerts = this.detectCrossChannelAlerts(channelResults);

    // 4. Generate strategic insights
    const insights = this.generateStrategicInsights(channelResults, unified);

    // 5. Analyze funnel
    const funnelDiagnostic = this.analyzeFunnel(channelResults);

    return {
      clientId,
      dateRange,
      executionTime: Date.now() - startTime,
      channels: channelResults,
      unified,
      crossChannelAlerts,
      insights,
      funnelDiagnostic
    };
  }

  /**
   * Run all enabled Channel Brains
   */
  private async runChannelBrains(
    clientId: string,
    dateRange: { start: string; end: string },
    clientConfig: ClientConfigV2
  ): Promise<Record<string, ChannelSignals>> {
    const results: Record<string, ChannelSignals> = {};

    // Run in parallel for performance
    const promises: Promise<void>[] = [];

    // Meta (always enabled for now)
    if (clientConfig.integraciones?.meta !== false) {
      promises.push(
        new MetaBrain().analyze(clientId, dateRange, clientConfig)
          .then(signals => { results.meta = signals; })
      );
    }

    // Google (mock)
    if (clientConfig.integraciones?.google) {
      promises.push(
        new GoogleBrain().analyze(clientId, dateRange, clientConfig)
          .then(signals => { results.google = signals; })
      );
    }

    // GA4 (mock)
    if (clientConfig.integraciones?.ga4) {
      promises.push(
        new GA4Brain().analyze(clientId, dateRange, clientConfig)
          .then(signals => { results.ga4 = signals; })
      );
    }

    // Ecommerce (mock)
    if (clientConfig.integraciones?.ecommerce) {
      promises.push(
        new EcommerceBrain().analyze(clientId, dateRange, clientConfig)
          .then(signals => { results.ecommerce = signals; })
      );
    }

    await Promise.all(promises);

    return results;
  }

  /**
   * Calculate unified KPIs across all channels
   */
  private calculateUnifiedKPIs(channels: Record<string, ChannelSignals>) {
    const metaSpend = channels.meta?.kpis.costo || 0;
    const googleSpend = channels.google?.kpis.costo || 0;
    const totalAdSpend = metaSpend + googleSpend;

    // Use ecommerce revenue as source of truth (if available)
    const totalRevenue = channels.ecommerce?.kpis.ingresos_totales ||
      (channels.meta?.kpis.ingresos || 0) + (channels.google?.kpis.ingresos || 0);

    const blendedRoas = totalAdSpend > 0 ? totalRevenue / totalAdSpend : 0;

    const metaConv = channels.meta?.kpis.conversiones || 0;
    const googleConv = channels.google?.kpis.conversiones || 0;
    const totalConversions = metaConv + googleConv;

    const avgCpa = totalConversions > 0 ? totalAdSpend / totalConversions : 0;

    return {
      totalAdSpend,
      totalRevenue,
      blendedRoas: parseFloat(blendedRoas.toFixed(2)),
      totalConversions,
      avgCpa: parseFloat(avgCpa.toFixed(2))
    };
  }

  /**
   * Detect cross-channel patterns and generate alerts
   */
  private detectCrossChannelAlerts(
    channels: Record<string, ChannelSignals>
  ): CrossChannelAlert[] {
    const alerts: CrossChannelAlert[] = [];

    // 1. Attribution Discrepancy Alert
    if (channels.meta && channels.ecommerce) {
      const metaReportedConv = channels.meta.kpis.conversiones || 0;
      const ecommerceOrders = channels.ecommerce.kpis.ordenes || 0;
      const discrepancy = Math.abs(metaReportedConv - ecommerceOrders) / ecommerceOrders * 100;

      if (discrepancy > 10) {
        alerts.push({
          type: 'ATTRIBUTION_DISCREPANCY',
          severity: 'CRITICAL',
          title: 'Discrepancia de atribución Meta-Ecommerce',
          description: `Meta Pixel reporta ${metaReportedConv} conversiones pero la tienda registró ${ecommerceOrders} órdenes. Diferencia: ${discrepancy.toFixed(0)}%`,
          affectedChannels: ['META', 'ECOMMERCE'],
          correlations: {
            metaConversions: metaReportedConv,
            ecommerceOrders: ecommerceOrders,
            discrepancyPct: discrepancy
          },
          recommendation: 'Verificar tracking: Conversions API, pixel events, iOS 14+ attribution. Considerar usar datos de ecommerce como source of truth.'
        });
      }
    }

    // 2. Bounce Rate + ROAS Correlation
    if (channels.ga4 && (channels.meta || channels.google)) {
      const bounceRate = channels.ga4.kpis.tasa_rebote || 0;
      const metaRoas = channels.meta?.kpis.roas || 0;
      const googleRoas = channels.google?.kpis.roas || 0;

      if (bounceRate > 40 && (metaRoas < 2 || googleRoas < 2)) {
        alerts.push({
          type: 'BOUNCE_ROAS_CORRELATION',
          severity: 'WARNING',
          title: 'Bounce rate alto correlacionado con bajo ROAS',
          description: `Tasa de rebote de ${bounceRate.toFixed(1)}% está afectando conversiones. Meta ROAS: ${metaRoas.toFixed(2)}x, Google ROAS: ${googleRoas.toFixed(2)}x`,
          affectedChannels: ['GA4', 'META', 'GOOGLE'],
          correlations: {
            bounceRate,
            metaRoas,
            googleRoas
          },
          recommendation: 'Landing pages necesitan optimización: velocidad de carga, relevancia, o experiencia móvil. Test A/B recomendado.'
        });
      }
    }

    // 3. Blended ROAS vs Individual ROAS
    if (channels.ecommerce && channels.meta && channels.google) {
      const blendedRoas = channels.ecommerce.kpis.blended_roas || 0;
      const metaReportedRoas = channels.meta.kpis.roas || 0;
      const googleReportedRoas = channels.google.kpis.roas || 0;
      const avgReportedRoas = (metaReportedRoas + googleReportedRoas) / 2;
      const gap = ((avgReportedRoas - blendedRoas) / blendedRoas) * 100;

      if (Math.abs(gap) > 5) {
        alerts.push({
          type: 'BLENDED_ROAS_GAP',
          severity: gap > 0 ? 'WARNING' : 'INFO',
          title: 'Gap entre ROAS reportado y Blended ROAS real',
          description: `Plataformas reportan ROAS promedio de ${avgReportedRoas.toFixed(2)}x pero el ROAS real (ecommerce) es ${blendedRoas.toFixed(2)}x. Gap: ${gap.toFixed(0)}%`,
          affectedChannels: ['META', 'GOOGLE', 'ECOMMERCE'],
          correlations: {
            blendedRoas,
            metaReportedRoas,
            googleReportedRoas,
            gapPct: gap
          },
          recommendation: gap > 0
            ? 'Sobreatribución detectada. Ajustar expectativas de ROAS en optimización.'
            : 'ROAS real supera reportado. Posible subreporte o conversiones cross-device.'
        });
      }
    }

    return alerts;
  }

  /**
   * Generate strategic insights based on all channel data
   */
  private generateStrategicInsights(
    channels: Record<string, ChannelSignals>,
    unified: any
  ): StrategicInsight[] {
    const insights: StrategicInsight[] = [];

    // Insight 1: Scaling Opportunity
    if (channels.google && channels.google.signals.google_lost_is_budget > 0.15) {
      insights.push({
        category: 'SCALING',
        priority: 'HIGH',
        insight: 'Oportunidad de scaling en Google Ads por presupuesto limitado',
        evidence: [
          `Perdiendo ${(channels.google.signals.google_lost_is_budget * 100).toFixed(0)}% de impresiones por budget`,
          `ROAS actual de Google: ${channels.google.kpis.roas}x (rentable)`,
          `Impression Share: ${(channels.google.signals.google_search_impression_share * 100).toFixed(0)}%`
        ],
        actions: [
          'Incrementar presupuesto diario de Google en 30%',
          'Monitorear ROAS durante 5 días',
          'Si ROAS se mantiene >2x, escalar otros 20%'
        ]
      });
    }

    // Insight 2: Funnel Optimization
    if (channels.ga4 && channels.ga4.signals.ga4_cart_to_checkout_rate < 60) {
      insights.push({
        category: 'OPTIMIZATION',
        priority: 'HIGH',
        insight: 'Optimización crítica de funnel: carrito → checkout',
        evidence: [
          `Solo ${channels.ga4.signals.ga4_cart_to_checkout_rate.toFixed(0)}% de los usuarios con carrito inician checkout`,
          `Bounce rate alto: ${channels.ga4.kpis.tasa_rebote}%`,
          'Drop-off mayor a benchmark de industria (70%)'
        ],
        actions: [
          'A/B test: simplificar formulario de checkout',
          'Agregar trust badges y garantías',
          'Ofrecer múltiples métodos de pago',
          'Implementar exit-intent popup con descuento'
        ]
      });
    }

    // Insight 3: Attribution Fix
    if (channels.ecommerce && channels.ecommerce.signals.ecommerce_has_tracking_issues) {
      insights.push({
        category: 'TROUBLESHOOTING',
        priority: 'MEDIUM',
        insight: 'Problemas de tracking afectando toma de decisiones',
        evidence: [
          `Discrepancia de atribución: ${channels.ecommerce.signals.ecommerce_attribution_discrepancy_pct}%`,
          'Conversions API necesita verificación',
          'Posible impacto de iOS 14+ privacy'
        ],
        actions: [
          'Auditar Meta Pixel: verificar todos los eventos',
          'Implementar server-side tracking (Conversions API)',
          'Usar Blended ROAS como métrica principal',
          'Configurar UTM parameters consistentes'
        ]
      });
    }

    return insights;
  }

  /**
   * Analyze full funnel from impression to purchase
   */
  private analyzeFunnel(channels: Record<string, ChannelSignals>): FunnelDiagnostic {
    const meta = channels.meta;
    const google = channels.google;
    const ga4 = channels.ga4;
    const ecommerce = channels.ecommerce;

    const stages = [
      {
        name: 'Impresiones',
        metric: (meta?.kpis.impresiones || 0) + (google?.kpis.impresiones || 0),
        status: 'HEALTHY' as const
      },
      {
        name: 'Clicks',
        metric: (meta?.kpis.clicks || 0) + (google?.kpis.clicks || 0),
        dropoff: undefined,
        status: 'HEALTHY' as const
      },
      {
        name: 'Sesiones (Landing)',
        metric: ga4?.kpis.sesiones || 0,
        dropoff: ga4 ? (ga4.kpis.tasa_rebote || 0) : undefined,
        status: (ga4?.kpis.tasa_rebote || 0) > 40 ? 'WARNING' : 'HEALTHY'
      },
      {
        name: 'Vista de Producto',
        metric: ga4?.kpis.vistas_producto || 0,
        dropoff: undefined,
        status: 'HEALTHY' as const
      },
      {
        name: 'Agregar a Carrito',
        metric: ga4?.kpis.agregar_carrito || 0,
        dropoff: undefined,
        status: 'HEALTHY' as const
      },
      {
        name: 'Iniciar Checkout',
        metric: ga4?.kpis.iniciar_checkout || 0,
        dropoff: ga4 ? 100 - (ga4.signals.ga4_cart_to_checkout_rate || 0) : undefined,
        status: (ga4?.signals.ga4_cart_to_checkout_rate || 100) < 60 ? 'CRITICAL' : 'HEALTHY'
      },
      {
        name: 'Compra',
        metric: ecommerce?.kpis.ordenes || 0,
        dropoff: ga4 ? 100 - (ga4.signals.ga4_checkout_to_purchase_rate || 0) : undefined,
        status: (ga4?.signals.ga4_checkout_to_purchase_rate || 100) < 50 ? 'WARNING' : 'HEALTHY'
      }
    ];

    // Find bottleneck
    const criticalStage = stages.find(s => s.status === 'CRITICAL');
    const bottleneck = criticalStage?.name;

    return {
      stages,
      bottleneck,
      recommendation: bottleneck
        ? `Optimizar etapa: ${bottleneck}. Es el mayor punto de fricción en el funnel.`
        : 'Funnel saludable. Continuar monitoreando para mantener performance.'
    };
  }
}
