/**
 * Seed Brain Prompts — Worker Brain V2
 *
 * Populates brain_prompts collection with initial prompts and alert rules.
 * These prompts will be editable via Cerebro UI without code deploys.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { db } from '../src/lib/firebase-admin';

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

const META_BRAIN_PROMPT: BrainPrompt = {
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
};

const GOOGLE_BRAIN_PROMPT: BrainPrompt = {
  brainId: 'GOOGLE',
  version: '1.0.0',
  updatedAt: new Date().toISOString(),
  systemPrompt: `Eres GoogleBrain, un sistema experto en análisis de Google Ads.
Tu rol es evaluar el performance de campañas de búsqueda y display.`,
  analysisPrompt: `Analiza las siguientes métricas de Google Ads:
- ROAS: {roas}
- Quality Score promedio: {qualityScore}
- Impression Share: {impressionShare}
- Lost IS (Budget): {lostIsBudget}`,
  alertRules: [
    {
      id: 'GOOGLE_QUALITY_SCORE_DROP',
      enabled: true,
      condition: 'Quality Score < threshold',
      threshold: 7.0,
      severity: 'WARNING',
      messageTemplate: 'Quality Score bajo: {qualityScore} (mínimo recomendado: {threshold})',
      recommendation: 'Mejorar relevancia de anuncios y landing pages para reducir CPC.'
    },
    {
      id: 'GOOGLE_LOST_IS_BUDGET',
      enabled: true,
      condition: 'Lost IS Budget > threshold',
      threshold: 0.15,
      severity: 'INFO',
      messageTemplate: 'Perdiendo {lostIsBudget}% de impresiones por presupuesto',
      recommendation: 'Oportunidad de scaling si ROAS es rentable.'
    }
  ]
};

const GA4_BRAIN_PROMPT: BrainPrompt = {
  brainId: 'GA4',
  version: '1.0.0',
  updatedAt: new Date().toISOString(),
  systemPrompt: `Eres GA4Brain, un sistema experto en análisis de Google Analytics 4.
Tu rol es evaluar el comportamiento de usuarios y detectar problemas en el funnel.`,
  analysisPrompt: `Analiza el funnel de conversión:
- Bounce Rate: {bounceRate}%
- Cart to Checkout: {cartToCheckout}%
- Checkout to Purchase: {checkoutToPurchase}%`,
  alertRules: [
    {
      id: 'GA4_BOUNCE_SPIKE',
      enabled: true,
      condition: 'Bounce Rate > threshold',
      threshold: 40,
      severity: 'CRITICAL',
      messageTemplate: 'Tasa de rebote alta: {bounceRate}% (baseline: {threshold}%)',
      recommendation: 'Landing pages con problemas. Revisar velocidad de carga y relevancia.'
    },
    {
      id: 'GA4_FUNNEL_DROP',
      enabled: true,
      condition: 'Cart to Checkout < threshold',
      threshold: 60,
      severity: 'WARNING',
      messageTemplate: 'Drop-off en checkout: solo {cartToCheckout}% completa',
      recommendation: 'Simplificar proceso de checkout y agregar trust signals.'
    }
  ]
};

const ECOMMERCE_BRAIN_PROMPT: BrainPrompt = {
  brainId: 'ECOMMERCE',
  version: '1.0.0',
  updatedAt: new Date().toISOString(),
  systemPrompt: `Eres EcommerceBrain, un sistema experto en análisis de datos de ecommerce.
Tu rol es calcular el Blended ROAS real y detectar discrepancias de atribución.`,
  analysisPrompt: `Analiza los datos de ecommerce:
- Revenue Total: ${totalRevenue}
- Blended ROAS: {blendedRoas}x
- Discrepancia de atribución: {discrepancy}%`,
  alertRules: [
    {
      id: 'ECOMMERCE_ATTRIBUTION_DISCREPANCY',
      enabled: true,
      condition: 'Discrepancy > threshold',
      threshold: 10,
      severity: 'CRITICAL',
      messageTemplate: 'Discrepancia de atribución: {discrepancy}%',
      recommendation: 'Verificar tracking: Conversions API, pixel events, iOS 14+ attribution.'
    },
    {
      id: 'ECOMMERCE_BLENDED_ROAS_DROP',
      enabled: true,
      condition: 'Blended ROAS < threshold',
      threshold: 2.5,
      severity: 'WARNING',
      messageTemplate: 'Blended ROAS bajo: {blendedRoas}x (target: {threshold}x)',
      recommendation: 'Performance global bajo. Revisar todos los canales.'
    }
  ]
};

async function seedBrainPrompts() {
  console.log('\n🌱 SEEDING BRAIN PROMPTS');
  console.log('═'.repeat(80));

  const prompts = [
    META_BRAIN_PROMPT,
    GOOGLE_BRAIN_PROMPT,
    GA4_BRAIN_PROMPT,
    ECOMMERCE_BRAIN_PROMPT
  ];

  try {
    for (const prompt of prompts) {
      console.log(`\n📝 Seeding ${prompt.brainId} Brain...`);

      await db.collection('brain_prompts').doc(prompt.brainId.toLowerCase()).set(prompt);

      console.log(`   ✅ Created with ${prompt.alertRules.length} alert rules`);
      console.log(`   📋 Rules: ${prompt.alertRules.map(r => r.id).join(', ')}`);
    }

    console.log('\n═'.repeat(80));
    console.log('✅ Brain prompts seeded successfully\n');

  } catch (error) {
    console.error('\n❌ Error seeding prompts:', error);
    throw error;
  }
}

seedBrainPrompts()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
