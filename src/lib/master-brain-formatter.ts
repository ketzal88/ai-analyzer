/**
 * MasterBrain Slack Formatter
 *
 * Generates beautifully formatted Slack messages from MasterBrain analysis.
 */

import type { MasterBrainAnalysis } from './master-brain';

export class MasterBrainFormatter {
  /**
   * Format complete MasterBrain analysis as Slack message
   */
  static formatSlackMessage(
    clientName: string,
    analysis: MasterBrainAnalysis
  ): string {
    const sections: string[] = [];

    // Header
    sections.push(this.formatHeader(clientName, analysis));

    // Unified KPIs (Blended ROAS)
    sections.push(this.formatUnifiedKPIs(analysis));

    // Individual Channel Performance
    sections.push(this.formatChannelPerformance(analysis));

    // Cross-Channel Alerts
    if (analysis.crossChannelAlerts.length > 0) {
      sections.push(this.formatCrossChannelAlerts(analysis));
    }

    // Funnel Diagnostic
    sections.push(this.formatFunnelDiagnostic(analysis));

    // Strategic Insights
    if (analysis.insights.length > 0) {
      sections.push(this.formatStrategicInsights(analysis));
    }

    // Footer
    sections.push(this.formatFooter(analysis));

    return sections.join('\n\n');
  }

  private static formatHeader(clientName: string, analysis: MasterBrainAnalysis): string {
    const { start, end } = analysis.dateRange;
    const dateLabel = start === end ? start : `${start} → ${end}`;

    return [
      '━'.repeat(80),
      `🧠 WORKER BRAIN V2 — Análisis Multi-Canal`,
      `📊 ${clientName}`,
      '━'.repeat(80),
      '',
      `📅 Período: ${dateLabel}`,
      `⏱️  Tiempo de análisis: ${analysis.executionTime}ms`,
      `🔗 Canales analizados: ${Object.keys(analysis.channels).map(c => c.toUpperCase()).join(', ')}`,
      '━'.repeat(80)
    ].join('\n');
  }

  private static formatUnifiedKPIs(analysis: MasterBrainAnalysis): string {
    const { unified } = analysis;

    return [
      '💰 BLENDED PERFORMANCE (REAL)',
      '━'.repeat(80),
      '',
      `💵 Gasto Total Ads:    $${this.formatNumber(unified.totalAdSpend)}`,
      `📈 Ingresos Reales:    $${this.formatNumber(unified.totalRevenue)}`,
      `🎯 Blended ROAS:       ${unified.blendedRoas}x ${this.getRoasEmoji(unified.blendedRoas)}`,
      `📊 Conversiones:       ${unified.totalConversions}`,
      `💸 CPA Promedio:       $${unified.avgCpa.toFixed(2)}`,
      '',
      `ℹ️  *Blended ROAS usa ingresos reales de ecommerce (fuente de verdad)*`
    ].join('\n');
  }

  private static formatChannelPerformance(analysis: MasterBrainAnalysis): string {
    const lines: string[] = [
      '📊 PERFORMANCE POR CANAL',
      '━'.repeat(80),
      ''
    ];

    const { channels } = analysis;

    if (channels.meta) {
      const meta = channels.meta.kpis;
      lines.push(
        `📘 META ADS`,
        `   • Gasto: $${this.formatNumber(meta.costo || 0)}`,
        `   • ROAS: ${(meta.roas || 0).toFixed(2)}x`,
        `   • Conversiones: ${meta.conversiones || 0}`,
        `   • CTR: ${(meta.ctr || 0).toFixed(2)}%`,
        ''
      );
    }

    if (channels.google) {
      const google = channels.google.kpis;
      lines.push(
        `🔵 GOOGLE ADS`,
        `   • Gasto: $${this.formatNumber(google.costo || 0)}`,
        `   • ROAS: ${(google.roas || 0).toFixed(2)}x`,
        `   • Conversiones: ${google.conversiones || 0}`,
        `   • CTR: ${(google.ctr || 0).toFixed(2)}%`,
        ''
      );
    }

    if (channels.ga4) {
      const ga4 = channels.ga4.kpis;
      lines.push(
        `📈 GOOGLE ANALYTICS 4`,
        `   • Sesiones: ${this.formatNumber(ga4.sesiones || 0)}`,
        `   • Tasa de Rebote: ${(ga4.tasa_rebote || 0).toFixed(1)}% ${(ga4.tasa_rebote || 0) > 40 ? '⚠️' : '✅'}`,
        `   • Conversión Ecommerce: ${(ga4.tasa_conversion_ecommerce || 0).toFixed(2)}%`,
        `   • Compras: ${ga4.compras || 0}`,
        ''
      );
    }

    if (channels.ecommerce) {
      const ecom = channels.ecommerce.kpis;
      lines.push(
        `🛒 ECOMMERCE (TiendaNube)`,
        `   • Ingresos Totales: $${this.formatNumber(ecom.ingresos_totales || 0)}`,
        `   • Órdenes: ${ecom.ordenes || 0}`,
        `   • AOV: $${(ecom.ticket_promedio || 0).toFixed(2)}`,
        `   • Revenue Orgánico: $${this.formatNumber(ecom.revenue_organico || 0)}`,
        ''
      );
    }

    return lines.join('\n');
  }

  private static formatCrossChannelAlerts(analysis: MasterBrainAnalysis): string {
    const lines: string[] = [
      '🚨 ALERTAS CROSS-CHANNEL',
      '━'.repeat(80),
      ''
    ];

    analysis.crossChannelAlerts.forEach((alert, i) => {
      const emoji = alert.severity === 'CRITICAL' ? '🔴' : alert.severity === 'WARNING' ? '🟡' : '🔵';
      const channels = alert.affectedChannels.join(' + ');

      lines.push(
        `${emoji} ${alert.severity}: ${alert.title}`,
        `   📍 Canales: ${channels}`,
        `   📝 ${alert.description}`,
        `   💡 ${alert.recommendation}`,
        ''
      );
    });

    return lines.join('\n');
  }

  private static formatFunnelDiagnostic(analysis: MasterBrainAnalysis): string {
    const { funnelDiagnostic } = analysis;

    const lines: string[] = [
      '🔍 DIAGNÓSTICO DE FUNNEL',
      '━'.repeat(80),
      ''
    ];

    funnelDiagnostic.stages.forEach(stage => {
      const statusEmoji = stage.status === 'CRITICAL' ? '🔴' :
        stage.status === 'WARNING' ? '🟡' : '✅';
      const dropoffText = stage.dropoff !== undefined
        ? ` (drop-off: ${stage.dropoff.toFixed(0)}%)`
        : '';

      lines.push(
        `${statusEmoji} ${stage.name}: ${this.formatNumber(stage.metric)}${dropoffText}`
      );
    });

    if (funnelDiagnostic.bottleneck) {
      lines.push(
        '',
        `⚠️  Bottleneck detectado: ${funnelDiagnostic.bottleneck}`,
        `💡 ${funnelDiagnostic.recommendation}`
      );
    }

    return lines.join('\n');
  }

  private static formatStrategicInsights(analysis: MasterBrainAnalysis): string {
    const lines: string[] = [
      '💡 INSIGHTS ESTRATÉGICOS',
      '━'.repeat(80),
      ''
    ];

    analysis.insights.forEach((insight, i) => {
      const emoji = insight.category === 'SCALING' ? '📈' :
        insight.category === 'OPTIMIZATION' ? '⚙️' :
          insight.category === 'TROUBLESHOOTING' ? '🔧' : '🎯';
      const priority = insight.priority === 'HIGH' ? '🔴' :
        insight.priority === 'MEDIUM' ? '🟡' : '🔵';

      lines.push(
        `${emoji} ${insight.category} ${priority}`,
        `   ${insight.insight}`,
        '',
        `   📊 Evidencia:`,
        ...insight.evidence.map(e => `      • ${e}`),
        '',
        `   ✅ Acciones Recomendadas:`,
        ...insight.actions.map((a, idx) => `      ${idx + 1}. ${a}`),
        ''
      );
    });

    return lines.join('\n');
  }

  private static formatFooter(analysis: MasterBrainAnalysis): string {
    return [
      '━'.repeat(80),
      '',
      `🤖 Generado por Worker Brain V2 (MasterBrain)`,
      `⏱️  Tiempo de análisis: ${analysis.executionTime}ms`,
      `🔗 Canales: ${Object.keys(analysis.channels).length}/4`,
      '',
      '━'.repeat(80)
    ].join('\n');
  }

  // Helpers
  private static formatNumber(num: number): string {
    return new Intl.NumberFormat('es-AR').format(Math.round(num));
  }

  private static getRoasEmoji(roas: number): string {
    if (roas >= 3) return '🟢';
    if (roas >= 2) return '🟡';
    return '🔴';
  }
}
