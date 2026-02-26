/**
 * EcommerceBrain — Worker Brain V2 (Mock Implementation)
 *
 * Simulates TiendaNube/Shopify analysis for Phase 2 prototype.
 * Calculates true Blended ROAS using real ecommerce revenue.
 *
 * Future: Replace with real TiendaNube/Shopify API integration.
 */

import { ChannelBrain, ChannelSignals, ChannelAlert, ClientConfigV2 } from "./channel-brain-interface";

export class EcommerceBrain extends ChannelBrain {
  async analyze(
    clientId: string,
    dateRange: { start: string; end: string },
    clientConfig: ClientConfigV2
  ): Promise<ChannelSignals> {
    const mockData = this.generateMockData(clientId, dateRange, clientConfig);

    return {
      canal: 'ECOMMERCE',
      clientId,
      dateRange,
      kpis: mockData.kpis,
      alerts: mockData.alerts,
      signals: mockData.signals,
      dataQuality: {
        fieldsWithNull: [],
        confidence: 'HIGH',
        notes: 'Mock data from TiendaNube. Real integration pending.'
      }
    };
  }

  private generateMockData(
    clientId: string,
    dateRange: any,
    clientConfig: ClientConfigV2
  ) {
    // Simulate real ecommerce revenue (source of truth)
    const totalRevenue = 112450;
    const totalOrders = 285;
    const avgOrderValue = totalRevenue / totalOrders;

    // Attribution breakdown (how ecommerce attributes revenue)
    const metaAttributed = 95240; // What ecommerce says came from Meta
    const googleAttributed = 39280; // What ecommerce says came from Google
    const organicAttributed = 12840; // Direct/organic
    const unknownAttributed = totalRevenue - metaAttributed - googleAttributed - organicAttributed;

    // Ad spend (combined from Meta + Google)
    const metaSpend = 7583;
    const googleSpend = 18420;
    const totalAdSpend = metaSpend + googleSpend;

    // Blended ROAS (real revenue / total ad spend)
    const blendedRoas = totalRevenue / totalAdSpend;

    // Individual channel ROAS (according to ecommerce attribution)
    const metaRoasEcommerce = metaAttributed / metaSpend;
    const googleRoasEcommerce = googleAttributed / googleSpend;

    return {
      kpis: {
        ingresos_totales: totalRevenue,
        ordenes: totalOrders,
        ticket_promedio: parseFloat(avgOrderValue.toFixed(2)),
        gasto_ads_total: totalAdSpend,
        blended_roas: parseFloat(blendedRoas.toFixed(2)),
        meta_roas_atribuido: parseFloat(metaRoasEcommerce.toFixed(2)),
        google_roas_atribuido: parseFloat(googleRoasEcommerce.toFixed(2)),
        revenue_organico: organicAttributed,
        revenue_desconocido: unknownAttributed
      },
      alerts: [
        {
          type: 'ECOMMERCE_ATTRIBUTION_DISCREPANCY',
          severity: 'CRITICAL' as const,
          message: 'Discrepancia de atribución Meta: 12% entre pixel y ecommerce',
          recommendation: 'Meta Pixel reporta 320 conversiones. TiendaNube registra 241 atribuidas a Meta. Verificar tracking.',
          data: {
            metaPixelConversions: 320,
            ecommerceMetaOrders: 241,
            discrepancyPct: 12,
            potentialRevenueGap: 8420,
            cause: 'Posible: iOS 14+ privacy, ad blockers, o cross-device purchases'
          }
        },
        {
          type: 'ECOMMERCE_BLENDED_ROAS_DROP',
          severity: 'WARNING' as const,
          message: 'Blended ROAS cayó 8% vs semana anterior',
          recommendation: 'ROAS real (2.49x) es menor que lo reportado por canales (Meta: 2.83x, Google: 2.14x).',
          data: {
            currentBlendedRoas: 2.49,
            previousBlendedRoas: 2.71,
            delta: -8,
            metaReportedRoas: 2.83,
            googleReportedRoas: 2.14
          }
        },
        {
          type: 'ECOMMERCE_AOV_INCREASE',
          severity: 'INFO' as const,
          message: 'AOV aumentó 15% vs semana anterior',
          recommendation: 'Upsells/bundles funcionando. Considerar escalar campañas high-ticket.',
          data: {
            currentAov: avgOrderValue,
            previousAov: 340,
            delta: 15
          }
        }
      ],
      signals: {
        ecommerce_blended_roas: blendedRoas,
        ecommerce_total_revenue: totalRevenue,
        ecommerce_meta_attributed_revenue: metaAttributed,
        ecommerce_google_attributed_revenue: googleAttributed,
        ecommerce_organic_revenue: organicAttributed,
        ecommerce_attribution_discrepancy_pct: 12,
        ecommerce_aov: avgOrderValue,
        ecommerce_conversion_rate: 2.2, // orders / total sessions
        ecommerce_has_tracking_issues: true
      },
      nullFields: []
    };
  }
}
