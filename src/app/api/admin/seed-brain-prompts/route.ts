/**
 * Seed Brain Prompts API
 *
 * POST /api/admin/seed-brain-prompts
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

interface AlertRule {
  id: string;
  enabled: boolean;
  condition: string;
  threshold: number;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  messageTemplate: string;
  recommendation: string;
}

interface BrainPrompt {
  brainId: string;
  version: string;
  updatedAt: string;
  systemPrompt: string;
  analysisPrompt: string;
  alertRules: AlertRule[];
}

const PROMPTS: BrainPrompt[] = [
  {
    brainId: 'META',
    version: '1.0.0',
    updatedAt: new Date().toISOString(),
    systemPrompt: `Eres MetaBrain, un sistema experto en análisis de Meta Ads (Facebook/Instagram).
Tu rol es evaluar el performance de campañas y detectar oportunidades de optimización.`,
    analysisPrompt: `Analiza las siguientes métricas de Meta Ads para el cliente {clientName}:
- ROAS 7d: {roas}
- CPA 7d: {cpa}
- Frecuencia promedio: {frequency}
- Spend 7d: {spend}

Genera recomendaciones basadas en las alert rules configuradas.`,
    alertRules: [
      {
        id: 'META_HIGH_FREQUENCY',
        enabled: true,
        condition: 'Frecuencia promedio > threshold',
        threshold: 3.5,
        severity: 'WARNING',
        messageTemplate: 'Alta frecuencia detectada: {frequency}x (umbral: {threshold}x)',
        recommendation: 'Audiencia saturada. Acciones: 1) Expandir targeting, 2) Rotar creativos, 3) Pausar campaña si frecuencia >5x.'
      },
      {
        id: 'META_LOW_ROAS',
        enabled: true,
        condition: 'ROAS < threshold',
        threshold: 2.0,
        severity: 'CRITICAL',
        messageTemplate: 'ROAS bajo: {roas}x (target: {threshold}x)',
        recommendation: 'Performance crítico. Acciones: 1) Revisar targeting, 2) Optimizar creativos, 3) Ajustar bid strategy.'
      },
      {
        id: 'META_BUDGET_BLEED',
        enabled: true,
        condition: 'CPA > targetCpa * threshold',
        threshold: 1.5,
        severity: 'WARNING',
        messageTemplate: 'CPA elevado: ${cpa} (target: ${targetCpa})',
        recommendation: 'Gasto ineficiente. Acciones: 1) Reducir budget, 2) Mejorar landing page, 3) Refinar audiencia.'
      },
      {
        id: 'META_SCALING_OPPORTUNITY',
        enabled: true,
        condition: 'ROAS > threshold AND frequency < 2.5',
        threshold: 3.0,
        severity: 'INFO',
        messageTemplate: 'Oportunidad de scaling: ROAS {roas}x con baja frecuencia',
        recommendation: 'Performance excelente. Acciones: 1) Incrementar budget +20%, 2) Duplicar ad sets ganadores, 3) Expandir lookalike audiences.'
      }
    ]
  },
  {
    brainId: 'GOOGLE',
    version: '1.0.0',
    updatedAt: new Date().toISOString(),
    systemPrompt: `Eres GoogleBrain, un sistema experto en análisis de Google Ads.`,
    analysisPrompt: `Analiza Google Ads performance.`,
    alertRules: [
      {
        id: 'GOOGLE_QUALITY_SCORE_DROP',
        enabled: true,
        condition: 'Quality Score < threshold',
        threshold: 7.0,
        severity: 'WARNING',
        messageTemplate: 'Quality Score bajo: {qualityScore}',
        recommendation: 'Mejorar relevancia de anuncios.'
      }
    ]
  },
  {
    brainId: 'GA4',
    version: '1.0.0',
    updatedAt: new Date().toISOString(),
    systemPrompt: `Eres GA4Brain, un sistema experto en análisis de Google Analytics 4.`,
    analysisPrompt: `Analiza el funnel de conversión.`,
    alertRules: [
      {
        id: 'GA4_BOUNCE_SPIKE',
        enabled: true,
        condition: 'Bounce Rate > threshold',
        threshold: 40,
        severity: 'CRITICAL',
        messageTemplate: 'Tasa de rebote alta: {bounceRate}%',
        recommendation: 'Landing pages con problemas.'
      }
    ]
  },
  {
    brainId: 'ECOMMERCE',
    version: '1.0.0',
    updatedAt: new Date().toISOString(),
    systemPrompt: `Eres EcommerceBrain, un sistema experto en análisis de ecommerce.`,
    analysisPrompt: `Analiza Blended ROAS y atribución.`,
    alertRules: [
      {
        id: 'ECOMMERCE_ATTRIBUTION_DISCREPANCY',
        enabled: true,
        condition: 'Discrepancy > threshold',
        threshold: 10,
        severity: 'CRITICAL',
        messageTemplate: 'Discrepancia de atribución: {discrepancy}%',
        recommendation: 'Verificar tracking.'
      }
    ]
  }
];

export async function POST() {
  try {
    const results = [];

    for (const prompt of PROMPTS) {
      await db.collection('brain_prompts').doc(prompt.brainId.toLowerCase()).set(prompt);
      results.push({
        brainId: prompt.brainId,
        rulesCount: prompt.alertRules.length,
        status: 'seeded'
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Brain prompts seeded successfully',
      results
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
