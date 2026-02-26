/**
 * GoogleBrain — Worker Brain V2 (Mock Implementation)
 *
 * Simulates Google Ads analysis for Phase 4 prototype.
 * Returns realistic mock data for testing Master Brain correlation.
 *
 * Future: Replace with real Google Ads API integration.
 */

import { ChannelBrain, ChannelSignals, ChannelAlert, ClientConfigV2 } from "./channel-brain-interface";

export class GoogleBrain extends ChannelBrain {
  async analyze(
    clientId: string,
    dateRange: { start: string; end: string },
    clientConfig: ClientConfigV2
  ): Promise<ChannelSignals> {
    // Mock: Simulate Google Ads performance data
    const mockData = this.generateMockData(clientId, dateRange);

    return {
      canal: 'GOOGLE',
      clientId,
      dateRange,
      kpis: mockData.kpis,
      alerts: mockData.alerts,
      signals: mockData.signals,
      dataQuality: {
        fieldsWithNull: mockData.nullFields,
        confidence: 'HIGH'
      }
    };
  }

  private generateMockData(clientId: string, dateRange: any) {
    // Simulate Google Ads spend and performance
    const spend = 18420;
    const revenue = 39280;
    const roas = revenue / spend;
    const conversions = 24;
    const cpa = spend / conversions;
    const clicks = 1840;
    const impressions = 45200;
    const ctr = (clicks / impressions) * 100;

    return {
      kpis: {
        costo: spend,
        ingresos: revenue,
        roas: parseFloat(roas.toFixed(2)),
        cpa: parseFloat(cpa.toFixed(2)),
        conversiones: conversions,
        clicks: clicks,
        impresiones: impressions,
        ctr: parseFloat(ctr.toFixed(2))
      },
      alerts: [
        {
          type: 'GOOGLE_QUALITY_SCORE_DROP',
          severity: 'WARNING' as const,
          message: 'Quality Score cayó en 3 keywords principales',
          recommendation: 'Revisar relevancia de anuncios vs landing pages. Correlación con bounce rate alto en GA4.',
          data: {
            keywords: ['colchon memory foam', 'colchon ortopedico', 'sommier 2 plazas'],
            avgQsBefore: 8.2,
            avgQsNow: 6.4,
            impactOnCpc: '+18%'
          }
        },
        {
          type: 'GOOGLE_SEARCH_LOST_IS',
          severity: 'INFO' as const,
          message: 'Impression Share perdido por presupuesto: 23%',
          recommendation: 'Oportunidad de scaling. Budget actual: $620/día, recomendado: $800/día.',
          data: {
            lostIsBudget: 23,
            lostIsRank: 8,
            potentialImpressions: 58400
          }
        }
      ],
      signals: {
        google_roas: roas,
        google_cpa: cpa,
        google_avg_quality_score: 6.4,
        google_search_impression_share: 0.67,
        google_lost_is_budget: 0.23,
        google_lost_is_rank: 0.08,
        google_top_keyword_ctr: 4.8,
        google_conversion_rate: 1.3
      },
      nullFields: []
    };
  }
}
