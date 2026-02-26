/**
 * GA4Brain — Worker Brain V2 (Mock Implementation)
 *
 * Simulates Google Analytics 4 analysis for Phase 3 prototype.
 * Focuses on landing page performance, funnel analysis, and organic traffic.
 *
 * Future: Replace with real GA4 API integration.
 */

import { ChannelBrain, ChannelSignals, ChannelAlert, ClientConfigV2 } from "./channel-brain-interface";

export class GA4Brain extends ChannelBrain {
  async analyze(
    clientId: string,
    dateRange: { start: string; end: string },
    clientConfig: ClientConfigV2
  ): Promise<ChannelSignals> {
    const mockData = this.generateMockData(clientId, dateRange);

    return {
      canal: 'GA4',
      clientId,
      dateRange,
      kpis: mockData.kpis,
      alerts: mockData.alerts,
      signals: mockData.signals,
      dataQuality: {
        fieldsWithNull: [],
        confidence: 'HIGH'
      }
    };
  }

  private generateMockData(clientId: string, dateRange: any) {
    // Simulate GA4 session and funnel data
    const sessions = 12840;
    const bounceRate = 45.2; // High!
    const avgSessionDuration = 142; // seconds
    const landingPageViews = 12840;
    const productViews = 5420;
    const addToCarts = 1240;
    const checkoutInitiated = 680;
    const purchases = 285;

    return {
      kpis: {
        sesiones: sessions,
        tasa_rebote: bounceRate,
        duracion_promedio_sesion: avgSessionDuration,
        vistas_producto: productViews,
        agregar_carrito: addToCarts,
        iniciar_checkout: checkoutInitiated,
        compras: purchases,
        tasa_conversion_ecommerce: parseFloat(((purchases / sessions) * 100).toFixed(2))
      },
      alerts: [
        {
          type: 'GA4_BOUNCE_SPIKE',
          severity: 'CRITICAL' as const,
          message: 'Tasa de rebote aumentó 15% en últimos 3 días',
          recommendation: 'Landing pages con problemas de carga o relevancia. Correlación: -12% en ROAS de Meta/Google.',
          data: {
            currentBounceRate: 45.2,
            baselineBounceRate: 30.1,
            delta: 15.1,
            affectedPages: [
              '/productos/colchon-memory-foam',
              '/productos/sommier-2-plazas',
              '/ofertas'
            ],
            correlation: {
              metaRoasDelta: -12,
              googleRoasDelta: -9
            }
          }
        },
        {
          type: 'GA4_FUNNEL_DROP',
          severity: 'WARNING' as const,
          message: 'Drop-off crítico: Carrito → Checkout (45%)',
          recommendation: 'Revisar flujo de checkout. Posible fricción en shipping o payment.',
          data: {
            addToCartToCheckout: 55,
            checkoutToPurchase: 42,
            bottleneck: 'checkout_initiation'
          }
        },
        {
          type: 'GA4_ORGANIC_DROP',
          severity: 'INFO' as const,
          message: 'Tráfico orgánico bajó 18% vs semana anterior',
          recommendation: 'Dependencia alta en paid ads. Considerar SEO y content marketing.',
          data: {
            organicSessions: 1280,
            organicDelta: -18,
            paidSessions: 11560,
            paidPercentage: 90
          }
        }
      ],
      signals: {
        ga4_bounce_rate: bounceRate,
        ga4_avg_session_duration: avgSessionDuration,
        ga4_ecommerce_conversion_rate: (purchases / sessions) * 100,
        ga4_cart_to_checkout_rate: (checkoutInitiated / addToCarts) * 100,
        ga4_checkout_to_purchase_rate: (purchases / checkoutInitiated) * 100,
        ga4_organic_percentage: 10,
        ga4_paid_percentage: 90,
        ga4_top_landing_page_bounce: 52.3,
        ga4_has_funnel_issues: true
      },
      nullFields: []
    };
  }
}
