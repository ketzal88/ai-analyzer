# AI Analyst — Instrucción para Claude Code
## Repo: `worker-brain` · Feature: `ai-analyst`

---

## Contexto del proyecto

Worker Brain es un sistema de análisis de marketing multi-canal para una agencia digital
latinoamericana. El backend corre en Firebase/Firestore. El frontend es Next.js.

Esta feature agrega un **AI Analyst** al dashboard interno del equipo: un panel de chat
que aparece al costado de cualquier vista de datos, con contexto estructurado completo
del cliente y el canal seleccionado, que le permite al equipo conversar con Claude sobre
lo que están viendo en pantalla.

---

## Qué hay que construir

### 1. Schema del contexto (`/lib/ai-analyst/context-builder.ts`)

Una función `buildAnalystContext(clientId, channel, dateRange)` que arma el JSON
que se inyecta en cada conversación. El JSON tiene esta estructura:

```typescript
{
  _meta: {
    schema_version: "1.0",
    client: { id, name, industry, country, currency },
    period: {
      current: { from, to, days },
      compare: { from, to, days, label }  // 30d anteriores
    },
    targets: {
      // targets por canal del cliente leídos desde Firestore
      meta_ads: { roas, cpa, ctr, hook_rate },
      google_ads: { roas, cpa, ctr, conv_rate },
      tiendanube: { conv_rate, avg_order, cart_abandon },
      klaviyo: { open_rate, click_rate, revenue_per_email },
      perfit: { open_rate, click_rate, unsubscribe_rate },
      ga4: { bounce_rate, avg_session, pages_per_session },
      mercadolibre: { conversion, reviews_avg },
    }
  },

  channels: {
    meta_ads: {
      summary: { spend, impressions, clicks, purchases, revenue_reported,
                 revenue_real_ecomm, attribution_gap_pct, roas_reported,
                 roas_real, ctr, cpa, cpm },
      vs_previous: { spend, roas, cpa, ctr },  // % delta
      campaigns: [{ id, name, status, objective, spend, purchases,
                    cpa, roas, ctr, hook_rate, hold_rate, top_creative }],
      creatives: [{ id, type, hook_rate, hold_rate, thumbstop, ctr,
                    spend, impressions, dna: { ...creativeDNA } }]
    },
    google_ads: {
      summary: { spend, clicks, impressions, conversions, revenue, roas,
                 ctr, cpa, avg_cpc, quality_score_avg, impression_share },
      vs_previous: { spend, roas, cpa, ctr },
      campaigns: [{ id, name, type, spend, conversions, roas, ctr, quality_score }]
    },
    ga4: {
      summary: { sessions, users, new_users_pct, bounce_rate,
                 avg_session_sec, pages_per_session, goal_completions },
      vs_previous: { sessions, bounce_rate, avg_session },
      top_landing_pages: [{ path, sessions, bounce, conv_rate }],
      traffic_sources: [{ source, sessions, conv_rate }]
    },
    tiendanube: {
      summary: { orders, revenue, avg_order, sessions, conv_rate,
                 cart_abandon_rate, refund_rate },
      vs_previous: { orders, revenue, conv_rate, cart_abandon },
      top_products: [{ name, orders, revenue }],
      funnel: { product_view, add_to_cart, checkout_start, purchase,
                drop_product_to_cart, drop_cart_to_checkout, drop_checkout_to_purchase }
    },
    klaviyo: {
      summary: { emails_sent, open_rate, click_rate, revenue_attributed,
                 revenue_per_email, unsubscribe_rate, list_size, list_growth_30d },
      vs_previous: { open_rate, click_rate, revenue },
      flows: [{ name, sends, open, click, revenue }],
      campaigns_last_30d: [{ name, sends, open, click, revenue }]
    },
    perfit: {
      summary: { emails_sent, open_rate, click_rate, revenue_attributed,
                 unsubscribe_rate, list_size, deliverability_score },
      vs_previous: { open_rate, click_rate, unsubscribe },
      notes: string
    },
    mercadolibre: {
      summary: { active_listings, visits, orders, revenue, conv_rate,
                 avg_order, reviews_avg, reviews_count },
      vs_previous: { orders, revenue, conv_rate },
      top_listings: [{ title, visits, conv, reviews }]
    }
  },

  cross_channel_insights: {
    attribution_gap: {
      meta_reported, meta_real_ecomm,
      google_reported, total_platform_reported,
      tiendanube_total, note
    },
    email_vs_paid: {
      email_cpa_combined, paid_cpa_combined,
      email_conv_rate, paid_conv_rate, insight
    },
    organic_performance: { ga4_organic_sessions, organic_conv_rate, note }
  },

  selected_context: { channel, element }
}
```

Los datos vienen del **Dashbo MCP** (ya integrado en el proyecto) y de Firestore.
Fechas del MCP: request en `YYYY-MM-DD`, response en `YYYYMMDD` — usar el util
`parseDashboDate()` que ya existe en el proyecto.

---

### 2. System prompts en Firestore (`/lib/ai-analyst/prompts.ts`)

Colección Firestore: `brain_prompts/{channelId}`

Crear un loader `getChannelPrompt(channelId: string): Promise<string>` que lea
el prompt desde Firestore con cache en memoria (TTL 5 min).

Si el documento no existe en Firestore, hacer fallback a los prompts default
definidos en el mismo archivo como constantes.

**Un prompt por canal** (8 en total):
- `meta_ads` — especializado en diagnóstico de creativos, Hook Rate, ROAS real vs reportado
- `google_ads` — Quality Score, Impression Share, Search vs PMax
- `ga4` — fuentes de tráfico, funnel, bounce rate por landing
- `tiendanube` — abandono de carrito, funnel producto→compra, brecha de atribución
- `klaviyo` — flows, CPA email vs paid, salud de lista
- `perfit` — deliverability, segmento B2B, comparativa con Klaviyo
- `mercadolibre` — ranking de listings, reviews, canibalización con ecommerce propio
- `cross_channel` — foto completa, rebalanceo de presupuesto, atribución multi-touch

Cada prompt debe:
1. Definir el rol del analista para ese canal
2. Incluir reglas de diagnóstico específicas del canal (benchmarks, umbrales, lógica)
3. Instruir a responder en español, sin preambles ("Excelente pregunta", etc.)
4. Pedir respuestas de máx 250 palabras salvo que el usuario pida profundidad
5. Pedir terminar con una acción concreta o pregunta al equipo

---

### 3. API Route (`/app/api/ai-analyst/chat/route.ts`)

`POST /api/ai-analyst/chat`

```typescript
// Request body
{
  clientId: string,
  channel: string,           // "meta_ads" | "google_ads" | etc.
  dateRange: { from: string, to: string },
  messages: { role: "user" | "assistant", content: string }[]
  // El historial completo de la conversación — multi-turn
}

// Response: SSE stream (text/event-stream)
// Formato: data: { type: "delta", text: "..." }\n\n
//          data: { type: "done" }\n\n
```

Lógica del route:
1. Validar auth (usuario interno con Firebase Auth)
2. Llamar `buildAnalystContext(clientId, channel, dateRange)`
3. Llamar `getChannelPrompt(channel)` desde Firestore
4. Construir el system prompt: `${channelPrompt}\n\n---\nDATOS:\n${JSON.stringify(context)}`
5. Llamar a Anthropic API con streaming (`claude-sonnet-4-20250514`)
6. Hacer pipe del stream como SSE al cliente

Rate limit: máx 30 requests/hora por usuario (usar KV de Vercel o un counter en Firestore).

---

### 4. Hook del cliente (`/hooks/useAnalystChat.ts`)

```typescript
const {
  messages,        // { role, content }[]
  isStreaming,     // boolean
  sendMessage,     // (text: string) => void
  resetChat,       // () => void
  streamBuffer,    // string — texto parcial mientras llega el stream
} = useAnalystChat({ clientId, channel, dateRange })
```

El hook maneja:
- El historial multi-turn en estado local
- La conexión SSE con fetch + ReadableStream
- El buffer de streaming para mostrar texto mientras llega
- El abort del stream si el usuario cierra el panel

---

### 5. Componente UI (`/components/ai-analyst/AnalystPanel.tsx`)

Panel lateral que se monta sobre el layout existente del dashboard.

**Props:**
```typescript
{
  channel: ChannelId,
  clientId: string,
  dateRange: { from: string, to: string },
  isOpen: boolean,
  onClose: () => void,
  initialPrompt?: string   // para abrir el chat con una pregunta ya disparada
}
```

**UI del panel:**
- Header: icono del canal + nombre + badge "Contexto completo · 30d"
- Área de mensajes con scroll automático al último
- Mensajes del usuario: burbuja derecha, fondo oscuro
- Mensajes del asistente: burbuja izquierda, renderer de markdown simple
  (bold, listas con ›, headers con color ámbar)
- Estado de streaming: dots animados mientras no hay texto, texto parcial cuando empieza
- Input: textarea con Enter para enviar (Shift+Enter = newline), botón de envío
- Empty state: sugerencias de preguntas clickeables por canal
- Botón de reset de conversación

**Ancho:** 420px, posición fixed derecha, altura 100vh menos el header.
**Tema:** dark, acento ámbar (#f59e0b), fuente monospace.

---

### 6. Integración en el layout (`/app/layout.tsx` o el layout del dashboard)

Agregar el estado `analystOpen` y el componente `<AnalystPanel>` al layout principal.

Exponer desde un contexto (`AnalystContext`) o un store Zustand:
```typescript
openAnalyst(channel: ChannelId, initialPrompt?: string): void
closeAnalyst(): void
```

Para que cualquier componente del dashboard pueda abrir el panel con un canal
y opcionalmente una pregunta ya pre-cargada.

---

### 7. Botones de trigger en vistas existentes

En cada vista de canal del dashboard, agregar:

1. **Botón "Analizar con IA"** en el header de la vista → `openAnalyst(channel)`
2. **Preguntas rápidas** (3 por canal) como chips clickeables → `openAnalyst(channel, pregunta)`

Las preguntas sugeridas por canal:

```typescript
const SUGGESTED_QUESTIONS: Record<ChannelId, string[]> = {
  meta_ads: [
    "¿Por qué está tan alto el CPA?",
    "Diagnosticá el creativo con peor Hook Rate",
    "¿Qué campaña debería pausar primero?",
  ],
  google_ads: [
    "¿Cómo mejorar el Quality Score?",
    "¿Vale la pena escalar PMax?",
    "Comparame eficiencia Google vs Meta",
  ],
  ga4: [
    "¿Por qué sube el bounce rate?",
    "¿Cuál es la mejor fuente de tráfico por conversión?",
    "Analizá el funnel completo",
  ],
  tiendanube: [
    "¿Por qué hay tanto abandono de carrito?",
    "¿Dónde se cae más gente en el checkout?",
    "Comparame el revenue real vs lo que reporta Meta",
  ],
  klaviyo: [
    "¿Está sub-explotada la lista?",
    "¿Qué flow genera más revenue?",
    "Comparame CPA email vs paid ads",
  ],
  perfit: [
    "¿Qué está afectando el deliverability?",
    "¿Por qué sube el unsubscribe rate?",
    "¿Tiene sentido migrar esta lista a Klaviyo?",
  ],
  mercadolibre: [
    "¿Por qué cayeron las órdenes este mes?",
    "¿Las reviews están afectando el ranking?",
    "¿Hay canibalización con el ecommerce propio?",
  ],
  cross_channel: [
    "Dame la foto completa de la cuenta",
    "¿Dónde está la mayor oportunidad de crecimiento?",
    "¿Cómo redistribuirías el presupuesto?",
  ],
}
```

---

## Estructura de archivos a crear

```
worker-brain/
├── lib/
│   └── ai-analyst/
│       ├── context-builder.ts     # buildAnalystContext()
│       ├── prompts.ts             # getChannelPrompt() + prompts default
│       └── types.ts               # ChannelId, AnalystContext, etc.
├── app/
│   └── api/
│       └── ai-analyst/
│           └── chat/
│               └── route.ts       # POST handler con SSE streaming
├── hooks/
│   └── useAnalystChat.ts          # Hook multi-turn con streaming
├── components/
│   └── ai-analyst/
│       ├── AnalystPanel.tsx       # Panel completo
│       ├── MessageList.tsx        # Renderer de mensajes + markdown
│       ├── AnalystInput.tsx       # Textarea + botón envío
│       └── SuggestedQuestions.tsx # Chips de preguntas por canal
└── context/
    └── AnalystContext.tsx         # Provider + hook useAnalyst()
```

---

## Variables de entorno necesarias

```env
# Ya deberían existir en el proyecto:
ANTHROPIC_API_KEY=           # Para llamar a Claude desde el route

# Verificar que existen:
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

---

## Notas técnicas importantes

**Dashbo MCP:** Las fechas en el request van como `YYYY-MM-DD`. Las fechas en la
response vienen como `YYYYMMDD` y hay que parsearlas con `parseDashboDate()`.
Canal Meta en Dashbo: `"FACEBOOK"`. Single-day queries son más confiables que rangos.

**Atribución:** Siempre incluir en el contexto tanto el revenue reportado por Meta/Google
como el revenue real de Tiendanube. Claude debe poder señalar la brecha.

**Prompts en Firestore:** La colección es `brain_prompts/{channelId}` con un campo
`systemPrompt: string`. Esto permite que el equipo edite los prompts desde la consola
de Firebase sin hacer deploy. El loader debe tener cache de 5 min.

**Streaming:** Usar la API de Anthropic con `stream: true` y hacer pipe directo
al cliente como SSE. No acumular en memoria del servidor.

**Multi-turn:** El historial completo de la conversación viaja en el body de cada
request. El servidor es stateless — Claude no recuerda entre requests por sí solo.

---

## Plan de implementación sugerido para esta sesión

1. `lib/ai-analyst/types.ts` — tipos y constantes
2. `lib/ai-analyst/prompts.ts` — prompts default + loader de Firestore
3. `lib/ai-analyst/context-builder.ts` — builder del JSON de contexto
4. `app/api/ai-analyst/chat/route.ts` — API con streaming
5. `hooks/useAnalystChat.ts` — hook del cliente
6. `components/ai-analyst/` — todos los componentes UI
7. `context/AnalystContext.tsx` — provider global
8. Integrar en el layout y agregar botones en vistas existentes
9. Seed de prompts en Firestore para los 8 canales

Empezá por los tipos y el context-builder para establecer el contrato de datos
antes de tocar cualquier UI.
