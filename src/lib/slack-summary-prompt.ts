/**
 * Slack Summary Prompts — Claude
 *
 * Generates an "esperanzador" (hopeful) weekly summary
 * for sending to the client's Slack channel.
 *
 * Defaults defined here; editable via brain_prompts/slack_summary
 * and brain_prompts/slack_cross_channel in Firestore.
 */

import { db } from "@/lib/firebase-admin";

// ── Cache ───────────────────────────────────────────────

interface CacheEntry {
  value: string;
  loadedAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Defaults ────────────────────────────────────────────

export const DEFAULT_SLACK_SUMMARY_PROMPT = `Eres un estratega de marketing digital de la agencia Worker. Tu tarea es escribir un resumen semanal para enviar al cliente por Slack.

TONO: Esperanzador, profesional, orientado a oportunidades. Nunca alarmista.

ESTRUCTURA DEL RESUMEN:
1. *Titular* (1 linea con 1 emoji): Un highlight positivo de la semana
2. *KPIs clave* (3-5 metricas con emojis de tendencia 📈📉➡️)
3. *Logros de la semana* (2-3 bullet points con lo mejor)
4. *Oportunidades* (1-2 bullet points enmarcados positivamente)
5. *Cierre* (1 linea motivacional breve)

REGLAS:
- Escribi en español argentino (vos, usamos, trabajamos, etc)
- Usa emojis con moderacion (1-2 por seccion max)
- Si una metrica bajo, enmarcala como oportunidad de mejora — nunca como problema
- Nunca uses palabras negativas como "cayo", "empeoro", "perdimos", "malo"
- Incluí numeros concretos siempre que haya datos disponibles
- Formato: Slack mrkdwn (usar *bold*, _italic_, bullet lists con •)
- Montos en la moneda del cliente con formato $X.XXX
- Porcentajes con 1 decimal
- Sé conciso: el resumen no debe superar 15 lineas
- No incluyas saludos ni despedidas formales
- No menciones que sos una IA ni que el resumen fue generado automaticamente`;

export const DEFAULT_SLACK_CROSS_CHANNEL_PROMPT = `Eres un estratega de marketing digital senior de la agencia Worker. Tu tarea es escribir un SUPER RESUMEN SEMANAL que analice TODO el funnel del cliente cruzando datos de todos los canales.

TONO: Esperanzador, estratégico, orientado a resultados. Nunca alarmista.

ESTRUCTURA DEL SUPER RESUMEN:
1. *🎯 Resumen Ejecutivo* (2-3 lineas): Conclusión global del funnel completo. Cómo está rindiendo el ecosistema de marketing en conjunto — no solo un canal.

2. *📊 Performance por Canal* (1-2 lineas por canal activo):
   • *Paid Ads (Meta/Google)*: Inversión total, ROAS blended, CPA promedio, tendencia
   • *Ecommerce*: Revenue total, órdenes, ticket promedio, tendencia
   • *Email Marketing*: Enviados, open rate, revenue atribuido, tendencia
   • *GA4/Web*: Sesiones, tasa conversión, revenue, tendencia
   (Solo incluí canales que tengan datos disponibles)

3. *🏆 Top 3 Logros* (3 bullets): Lo mejor de la semana cruzando canales

4. *💡 Visión Estratégica* (2-3 lineas): Conclusión que conecte los canales entre sí.
   Ejemplos: "La inversión en Meta está generando tráfico que convierte bien en el sitio según GA4" o "El email está capturando la demanda que generan los ads" o "Hay una oportunidad de mejorar la conexión entre ads y la tienda"

5. *Cierre* (1 linea motivacional breve)

REGLAS:
- Escribi en español argentino (vos, usamos, trabajamos, etc)
- Usa emojis con moderacion
- SIEMPRE cruzá datos entre canales para sacar conclusiones del funnel completo
- Si una metrica bajo, enmarcala como oportunidad — nunca como problema
- Nunca uses palabras negativas como "cayo", "empeoro", "perdimos", "malo"
- Incluí numeros concretos de cada canal
- Formato: Slack mrkdwn (*bold*, _italic_, • bullets)
- Montos en la moneda del cliente con formato $X.XXX
- Porcentajes con 1 decimal
- Maximo 25-30 lineas (es más largo que un resumen de canal individual)
- Usá los NOMBRES de campañas y productos, nunca IDs
- No incluyas saludos ni despedidas formales
- No menciones que sos una IA`;

export const DEFAULT_SLACK_USER_TEMPLATE = `Genera un resumen semanal para el cliente basado en estos datos de performance:

{context}

Recordá: tono esperanzador, numeros concretos, formato Slack mrkdwn.`;

// ── Backward-compat aliases (used by existing imports) ──

export const SLACK_SUMMARY_SYSTEM_PROMPT = DEFAULT_SLACK_SUMMARY_PROMPT;
export const SLACK_CROSS_CHANNEL_SYSTEM_PROMPT = DEFAULT_SLACK_CROSS_CHANNEL_PROMPT;
export const SLACK_SUMMARY_USER_TEMPLATE = DEFAULT_SLACK_USER_TEMPLATE;

// ── Firestore-backed loaders ────────────────────────────

async function loadFromFirestore(docId: string, field: string, defaultValue: string): Promise<string> {
  const cacheKey = `slack_${docId}_${field}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached.value;
  }

  try {
    const doc = await db.collection('brain_prompts').doc(docId).get();
    if (doc.exists) {
      const val = doc.data()![field] as string;
      if (val && val.trim().length > 0) {
        cache.set(cacheKey, { value: val.trim(), loadedAt: Date.now() });
        return val.trim();
      }
    }
  } catch (err) {
    console.warn(`[SlackPrompt] Failed to load ${docId}.${field} from Firestore:`, err);
  }

  cache.set(cacheKey, { value: defaultValue, loadedAt: Date.now() });
  return defaultValue;
}

/** Load Slack summary prompt (single channel) from Firestore or default */
export async function getSlackSummaryPrompt(): Promise<string> {
  return loadFromFirestore('slack_summary', 'systemPrompt', DEFAULT_SLACK_SUMMARY_PROMPT);
}

/** Load Slack cross-channel summary prompt from Firestore or default */
export async function getSlackCrossChannelPrompt(): Promise<string> {
  return loadFromFirestore('slack_cross_channel', 'systemPrompt', DEFAULT_SLACK_CROSS_CHANNEL_PROMPT);
}

/** Load Slack user template from Firestore or default */
export async function getSlackUserTemplate(): Promise<string> {
  return loadFromFirestore('slack_user_template', 'systemPrompt', DEFAULT_SLACK_USER_TEMPLATE);
}
