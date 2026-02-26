# Worker Brain v2 — Plan Maestro de Implementación

> Documento técnico y estratégico para la construcción del Master Brain multi-canal.
> Basado en auditoría real del MCP Dashbo (Feb 2026) con cliente Almacén de Colchones.

---

## 1. Lo que el MCP Dashbo realmente nos da

Antes de construir cualquier cosa, la auditoría del catálogo de campos confirma qué datos existen y cuáles son confiables.

### 1.1 Fuentes disponibles por cliente

El campo `Canal` en Dashbo acepta estos valores con sus aliases:

| Valor interno | Display | Aliases reconocidos |
|---|---|---|
| `FACEBOOK` | Facebook Ads | Meta, Instagram, Meta Ads |
| `GOOGLE` | Google Ads | Adwords |
| `ANALYTICS` | GA4 | Google Analytics, Analytics |
| `TIENDA_NUBE` | Tiendanube | Tienda Nube, TiendaNube |
| `SHOPIFY` | Shopify | Shopify |
| `TIKTOK` | TikTok Ads | TikTok |
| `LINKEDIN` | LinkedIn Ads | LinkedIn |
| `SHEET` | Sheet | Google Sheet |

**Conclusión crítica**: Shopify y TiendaNube ya están en el MCP de Dashbo. No se necesitan APIs directas para ecommerce. Email (Klaviyo/Perfit) sigue siendo Fase 2.

### 1.2 Campos confirmados por fuente

#### META ADS — Campos confiables
**Métricas de alcance:** `Impresiones`, `Meta_Alcance`, `Meta_Frecuencia`
**Métricas de engagement:** `Clicks`, `Meta_Link_click`, `Meta_Landing_page_view`, `Meta_Video_view`, `CTR`, `CPC`, `CPM`, `HOOK_RATE`
**Métricas de conversión:** `Meta_Pixel_purchase`, `Meta_Pixel_add_to_cart`, `Meta_Pixel_initiate_checkout`, `Meta_Pixel_lead`, `Meta_Lead`, `Meta_Messaging_conversation_started_7d`
**Métricas de valor:** `Valor_de_compra`, `ROAS`, `Meta_Costo_por_compra`, `Meta_Costo_por_agregar_al_carrito`, `Meta_Costo_por_checkout_iniciado`
**Dimensiones:** `Campana`, `Grupo_de_Anuncios`, `Anuncio`, `Anuncio_ID`, `Anuncio_Estado`, `Anuncio_Texto_Principal`, `Anuncio_URL_de_la_Imagen_o_Video`, `Meta_Edad`, `Meta_Genero`, `Meta_Plataforma_Publicacion`, `Meta_Posicion_Plataforma`, `Meta_Dispositivo`, `Meta_Region`

#### GOOGLE ADS — Campos confiables
**Métricas:** `Impresiones`, `Clicks`, `Costo`, `Conversiones_Primarias`, `Valor_de_compra`, `CTR`, `CPC`, `CPM`, `ROAS`, `CPA_Conversiones_primarias`, `Conv_Rate_Conversiones_primarias`
**Dimensiones:** `Campana`, `Campana_Estado`, `Grupo_de_Anuncios`, `Grupo_de_Anuncios_Estado`
**Nota:** Google Ads NO tiene datos de anuncio individual (sin `Anuncio_ID`, sin `Anuncio_Texto`). El análisis granular de creativos es exclusivo de Meta.

#### GA4 — Campos confiables (confirmados con data real)
**Métricas de tráfico:** `GA4__Sesiones`, `GA4__Usuario_activos`, `GA4__Total_usuarios`, `GA4__Usuarios_nuevos`, `GA4__Usuarios_recurrentes`
**Métricas de engagement:** `GA4__Tasa_rebote`, `GA4__Tasa_compromiso`, `GA4__Sesiones_comprometidas`, `GA4__Duración_promedio_sesión`, `GA4__Tiempo_compromiso_por_sesión`
**Métricas de ecommerce:** `GA4__Compras`, `GA4__Transacciones_de_comercio_electrónico`, `GA4__Ingresos_por_compras`, `GA4__Valor_promedio_orden`, `GA4__Agregar_al_carrito`, `GA4__Iniciar_checkout`, `GA4__Tasa_checkout_a_compra`, `GA4__Tasa_agregar_al_carrito`
**Métricas de retención/LTV:** `GA4__Usuarios_recurrentes`, `GA4__Compradores_primera_vez`, `GA4__Tasa_retención_cohorte`, `GA4__Valor_vida_útil`, `GA4__Valor_vida_útil_usuario`
**Métricas de SEO orgánico:** `GA4__Clics_búsqueda_orgánica_Google`, `GA4__Impresiones_búsqueda_orgánica_Google`, `GA4__CTR_búsqueda_orgánica_Google`, `GA4__Posición_promedio_búsqueda_orgánica_Google`
**Dimensiones clave:** `GA4__Fuente`, `GA4__Medio`, `GA4__Fuente_medio`, `GA4__Agrupación_canal_sesión`, `GA4__Página_destino`, `GA4__Categoría_dispositivo`, `GA4__Nombre_item`, `GA4__Categoría_item`
**⚠️ Campos con nulls observados:** `GA4__Usuarios_nuevos`, `GA4__Valor_promedio_orden`, `GA4__Agregar_al_carrito`, `GA4__Iniciar_checkout` — el Brain debe manejar null como ausencia de configuración, no como cero.

#### TIENDANUBE / SHOPIFY — Campos confiables
**Métricas:** `Ecommerce_Ingresos_Brutos`, `Ecommerce_Ordenes`, `Ecommerce_Valor_Promedio_Orden`
**Fórmulas calculadas por Dashbo:** `Ecommerce_ROAS` (Ingresos Brutos / Costo), `Ecommerce_ACOS` (Costo / Ingresos Brutos), `Ecommerce_CPA` (Costo / Ordenes)
**Dimensión de estado:** `Ecommerce_Estado_Orden` con valores: `paid`, `pending`, `refunded`, `partially_refunded`, `cancelled`, `voided`, `authorized`
**Nota:** No hay datos de stock por SKU. El indicador de riesgo de stock requiere una integración directa futura.

### 1.3 Business Units (ejemplo con Almacén de Colchones)
- **BU 16974**: "FACEBOOK - Global" — mensual, incluye todos los campos Meta
- **BU 17016**: "GOOGLE - Global" — mensual, incluye todos los campos Google Ads

Cada BU tiene su propio `Presupuesto_Total`, `Presupuesto_Gasto_vs_tiempo_global` (pace del presupuesto) y `Presupuesto_Objetivo_X` configurables. **Pendiente de decisión:** determinar si el seguimiento de presupuesto lo manejamos desde las BUs de Dashbo o internamente en Worker Brain.

---

## 2. Arquitectura Definitiva del Sistema

### 2.1 Las 5 Capas

```
CAPA 1 — Data Sources (todo via MCP Dashbo)
├── FACEBOOK     → Meta Ads completo (nivel ad)
├── GOOGLE       → Google Ads (nivel campaña/adgroup)
├── ANALYTICS    → GA4 (comportamiento + ecommerce + SEO)
├── TIENDA_NUBE  → Ecommerce real (órdenes, ingresos, estado)
└── SHOPIFY      → Idem TiendaNube

CAPA 2 — Data Fetcher (cron diario en Next.js)
└── Llama al MCP una vez por cliente/canal
    Cachea en Firestore: dashbo_snapshots/{clientId}/{date}/{canal}

CAPA 3 — Channel Brains (análisis por canal, cada uno con su prompt en Firestore)
├── MetaBrain    → lógica actual refactorizada como ChannelBrain
├── GoogleBrain  → análisis Google Ads
├── GA4Brain     → comportamiento post-clic + SEO orgánico
└── EcommerceBrain → ventas reales + funnel ecommerce

CAPA 4 — Master Brain (correlación cross-canal, con su propio prompt en Firestore)
└── Recibe signal objects de todos los Channel Brains
    Calcula Blended ROAS real
    Detecta brechas de atribución
    Genera alertas cross-canal
    Produce Business Briefing

CAPA 5 — Output Layer
├── UI: dashboards por canal + Business Overview
├── Alertas: por canal + cross-canal
└── Slack: Business Briefing matutino
```

### 2.2 Interfaz ChannelBrain

Cada Channel Brain implementa esta interfaz TypeScript. MetaBrain ya la implementa (refactorización, no reescritura).

```typescript
interface ChannelSignals {
  canal: 'META' | 'GOOGLE' | 'GA4' | 'ECOMMERCE'
  clientId: string
  dateRange: { start: string; end: string }

  // Métricas core normalizadas
  kpis: {
    costo?: number
    ingresos?: number
    roas?: number
    cpa?: number
    conversiones?: number
    clicks?: number
    impresiones?: number
    ctr?: number
  }

  // Alertas generadas por el canal
  alerts: ChannelAlert[]

  // Señales para el Master Brain (no para el usuario)
  signals: {
    [key: string]: number | string | boolean | null
  }

  // Estado de disponibilidad de datos
  dataQuality: {
    fieldsWithNull: string[]
    confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  }
}

interface ChannelAlert {
  type: string
  severity: 'CRITICAL' | 'WARNING' | 'INFO'
  message: string
  recommendation: string
  data: Record<string, unknown>
}
```

---

## 3. Estrategia de Fechas

### 3.1 Comportamiento del MCP Dashbo con fechas

Confirmado mediante tests con cliente real:
- **Request:** formato `YYYY-MM-DD` en `startDate` / `endDate`
- **Response:** el campo `Fecha` llega como string `YYYYMMDD` (ej: `"20260224"`) — **no es ISO, requiere parsing explícito**
- Los rangos devuelven una fila por día, desordenadas — el código no puede asumir orden cronológico
- `startDate === endDate` devuelve exactamente una fila (confirmado)

### 3.2 Las ventanas que necesita el sistema

| Ventana | Rango | Uso |
|---|---|---|
| **yesterday** | `today-1 → today-1` | El día completo más reciente — base del Briefing matutino |
| **last7days** | `today-7 → today-1` | Trending, comparativas semana a semana, análisis de creativos |
| **mtd** | `primer día del mes → today-1` | KPI acumulado mensual |
| **last30days** | `today-30 → today-1` | Análisis de creativos largo plazo |

> **Por qué `yesterday` y no `today`:** A las 9am el día en curso tiene pocas horas de data. El Briefing siempre referencia el día anterior completo. `today` se usa solo para monitoreo intraday de alertas urgentes.

### 3.3 Qué ventana usa cada query del cron

| Query | Canal | Ventana | Motivo |
|---|---|---|---|
| Q1 — Meta Global | FACEBOOK | `yesterday` | Dato limpio del día |
| Q2 — Meta por Anuncio | FACEBOOK | `last7days` | Necesita volumen para clasificar creativos |
| Q3 — Google Ads | GOOGLE | `yesterday` | Dato limpio del día |
| Q4 — GA4 | ANALYTICS | `yesterday` | Comportamiento del día |
| Q5 — Ecommerce | TIENDA_NUBE / SHOPIFY | `yesterday` | Órdenes del día |
| MTD acumulado | todos | `mtd` | Solo una vez por día, para el Briefing mensual |

El MTD se corre una sola vez en el cron matutino y se cachea en `dashbo_snapshots/{clientId}/{YYYY-MM}/mtd_{canal}`. No se recalcula en monitoreos intraday.

### 3.4 Implementación

```typescript
// src/lib/date-utils.ts

export function buildDateRanges(now: Date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)

  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  return {
    today:      { startDate: fmt(now),           endDate: fmt(now) },
    yesterday:  { startDate: fmt(yesterday),      endDate: fmt(yesterday) },
    last7days:  { startDate: fmt(sevenDaysAgo),   endDate: fmt(yesterday) },
    last30days: { startDate: fmt(thirtyDaysAgo),  endDate: fmt(yesterday) },
    mtd:        { startDate: fmt(firstOfMonth),   endDate: fmt(yesterday) },
  }
}

// Parser para la respuesta del MCP: "20260224" → Date
export function parseDashboDate(raw: string): Date {
  const year  = parseInt(raw.slice(0, 4))
  const month = parseInt(raw.slice(4, 6)) - 1  // 0-indexed
  const day   = parseInt(raw.slice(6, 8))
  return new Date(year, month, day)
}

// Construir fechas en la zona horaria del cliente
// (crítico para clientes en México, España, etc.)
export function buildDateRangesForTimezone(tz: string) {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: tz }))
  return buildDateRanges(now)
}
```

### 3.5 Comparativas (deltas) sin queries extra

Las comparativas "ayer vs antesdeayer" se calculan desde el cache de Firestore, sin llamadas adicionales al MCP:

```typescript
// Al generar el Briefing, leer los dos últimos snapshots cacheados
const hoy    = await getSnapshot(clientId, fmt(yesterday))
const previo = await getSnapshot(clientId, fmt(dayBefore))

const delta = {
  costo:   pct(hoy.meta.costo,         previo.meta.costo),
  roas:    pct(hoy.meta.roas,          previo.meta.roas),
  ordenes: pct(hoy.ecommerce?.ordenes, previo.ecommerce?.ordenes),
}
```

---

## 4. Campos a pedir por query

**Q1 — Meta Global (por campaña):**
```
fields: [
  "Canal", "Campana", "Campana_Estado", "Fecha",
  "Impresiones", "Meta_Alcance", "Meta_Frecuencia",
  "Clicks", "Meta_Link_click", "Meta_Landing_page_view",
  "Costo", "Valor_de_compra", "Meta_Pixel_purchase",
  "Meta_Pixel_add_to_cart", "Meta_Pixel_initiate_checkout",
  "Meta_Video_view", "CTR", "CPC", "CPM", "ROAS",
  "HOOK_RATE", "Meta_Costo_por_compra"
]
date_range: yesterday
filters: [{ fieldName: "Canal", operator: "EQUALS", values: ["FACEBOOK"] }]
```

**Q2 — Meta por Anuncio (creativos):**
```
fields: [
  "Anuncio_ID", "Anuncio", "Anuncio_Estado",
  "Anuncio_Texto_Principal", "Anuncio_URL_de_la_Imagen_o_Video",
  "Campana", "Grupo_de_Anuncios",
  "Impresiones", "Meta_Frecuencia", "Clicks",
  "Costo", "Valor_de_compra", "Meta_Pixel_purchase",
  "Meta_Video_view", "CTR", "ROAS", "HOOK_RATE",
  "Meta_Costo_por_compra", "Meta_Pixel_add_to_cart"
]
date_range: last7days
filters: [{ fieldName: "Canal", operator: "EQUALS", values: ["FACEBOOK"] }]
```

**Q3 — Google Ads Global:**
```
fields: [
  "Canal", "Campana", "Campana_Estado", "Fecha",
  "Impresiones", "Clicks", "Costo",
  "Conversiones_Primarias", "Valor_de_compra",
  "CTR", "CPC", "CPM", "ROAS", "CPA_Conversiones_primarias"
]
date_range: yesterday
filters: [{ fieldName: "Canal", operator: "EQUALS", values: ["GOOGLE"] }]
```

**Q4 — GA4 Comportamiento + Ecommerce:**
```
fields: [
  "Canal", "Fecha",
  "GA4__Sesiones", "GA4__Usuario_activos", "GA4__Usuarios_nuevos",
  "GA4__Tasa_rebote", "GA4__Tasa_compromiso",
  "GA4__Duración_promedio_sesión",
  "GA4__Compras", "GA4__Ingresos_por_compras",
  "GA4__Agregar_al_carrito", "GA4__Iniciar_checkout",
  "GA4__Tasa_checkout_a_compra", "GA4__Valor_promedio_orden",
  "GA4__Clics_búsqueda_orgánica_Google",
  "GA4__Compradores_primera_vez", "GA4__Usuarios_recurrentes"
]
date_range: yesterday
filters: [{ fieldName: "Canal", operator: "EQUALS", values: ["ANALYTICS"] }]
```

**Q5 — Ecommerce Real:**
```
fields: [
  "Canal", "Fecha",
  "Ecommerce_Ingresos_Brutos", "Ecommerce_Ordenes",
  "Ecommerce_Valor_Promedio_Orden", "Ecommerce_Estado_Orden",
  "Ecommerce_ROAS", "Ecommerce_CPA"
]
date_range: yesterday
filters: [
  { fieldName: "Canal", operator: "EQUALS", values: ["TIENDA_NUBE"] },
  { fieldName: "Ecommerce_Estado_Orden", operator: "EQUALS", values: ["paid"] }
]
```

---

## 5. Prompts de los Channel Brains

Cada Brain tiene su propio prompt almacenado en Firestore bajo `brain_prompts/{brainId}`. Esto permite iterar la lógica de análisis sin deployar código. El prompt es el "cerebro" — el código es el contenedor.

### 5.1 Estructura del prompt

```typescript
interface BrainPrompt {
  brainId: 'META' | 'GOOGLE' | 'GA4' | 'ECOMMERCE' | 'MASTER'
  version: string          // semver: "1.0.0", "1.1.0", etc.
  updatedAt: Timestamp
  systemPrompt: string     // instrucciones de rol y principios
  analysisPrompt: string   // template con placeholders para los datos
  alertRules: AlertRule[]  // reglas de alertas — iterables sin tocar el prompt
}

interface AlertRule {
  id: string               // ej: "META_HIGH_FREQUENCY"
  enabled: boolean         // se puede desactivar sin borrar
  condition: string        // descripción legible de la condición
  threshold: number        // el valor numérico del umbral
  severity: 'CRITICAL' | 'WARNING' | 'INFO'
  messageTemplate: string  // con placeholders: "Frecuencia {value}x supera umbral {threshold}x"
  recommendation: string
}
```

### 5.2 Prompt del MetaBrain

**System prompt:**
```
Eres el MetaBrain, especialista en Meta Ads (Facebook e Instagram).
Tu trabajo es analizar el rendimiento de las campañas de Meta para el cliente {clientName}
y producir un diagnóstico accionable.

Principios:
- Distinguís entre campañas con problema de creatividad, problema de audiencia, y problema de oferta.
- Identificás oportunidades de escala, no solo problemas.
- No hacés recomendaciones genéricas. Cada observación tiene un dato que la respalda.
- Si los datos son insuficientes para una conclusión, lo decís explícitamente.
- Respondés siempre en español.
```

**Analysis prompt template:**
```
Analizá el rendimiento de Meta Ads del cliente {clientName} para el período {dateRange}.

## Datos del período
- Costo total: {costo}
- ROAS: {roas}x (target: {roas_target}x)
- CPA: {cpa} (target: {cpa_target})
- Pixel Compras: {pixel_purchases}
- Frecuencia promedio: {frecuencia}x
- Alcance: {alcance}
- CTR: {ctr}%
- Hook Rate: {hook_rate}%

## Campañas activas
{campaigns_table}

## Anuncios (top 5 por inversión últimos 7 días)
{ads_table}

## Comparativa vs período anterior
- ROAS: {roas_delta}% {roas_direction}
- CPA: {cpa_delta}% {cpa_direction}
- Costo: {costo_delta}% {costo_direction}

Producí:
1. Un diagnóstico de 2-3 oraciones del estado general de la cuenta.
2. Las alertas que aplican según las reglas (si las hay).
3. Las señales en formato JSON para el Master Brain.
4. Máximo 2 recomendaciones accionables con el dato que las justifica.
```

**Alert rules:**
```json
[
  {
    "id": "META_HIGH_FREQUENCY",
    "enabled": true,
    "condition": "Frecuencia promedio supera umbral",
    "threshold": 3.5,
    "severity": "WARNING",
    "messageTemplate": "Frecuencia en {value}x — audiencia saturada",
    "recommendation": "Expandir audiencias o rotar creativos"
  },
  {
    "id": "META_LOW_ROAS",
    "enabled": true,
    "condition": "ROAS cae por debajo del target del cliente",
    "threshold": 0,
    "severity": "CRITICAL",
    "messageTemplate": "ROAS {value}x está por debajo del target {threshold}x",
    "recommendation": "Pausar campañas con ROAS < 1x. Revisar oferta y landing."
  },
  {
    "id": "META_BUDGET_BLEED",
    "enabled": true,
    "condition": "Campaña gasta presupuesto sin conversiones en N días",
    "threshold": 3,
    "severity": "CRITICAL",
    "messageTemplate": "{campaign} lleva {days} días sin conversiones gastando {costo}/día",
    "recommendation": "Pausar campaña y revisar segmentación o creativo"
  },
  {
    "id": "META_SCALING_OPPORTUNITY",
    "enabled": true,
    "condition": "Campaña con ROAS mayor al doble del target y budget no limitado",
    "threshold": 2,
    "severity": "INFO",
    "messageTemplate": "{campaign} tiene ROAS {value}x con margen para escalar",
    "recommendation": "Aumentar presupuesto 20-30% para escalar resultado"
  }
]
```

### 5.3 Prompt del GoogleBrain

**System prompt:**
```
Eres el GoogleBrain, especialista en Google Ads.
Tu trabajo es analizar la eficiencia de las campañas de Google para el cliente {clientName}
y detectar desperdicio o oportunidades que no son visibles mirando solo Meta.

Principios:
- Evaluás cada campaña en términos de CPA real vs target.
- Identificás campañas activas que no están convirtiendo (budget waste).
- No comparás directamente ROAS de Google vs Meta — son modelos de atribución distintos.
- Respondés siempre en español.
```

**Analysis prompt template:**
```
Analizá el rendimiento de Google Ads del cliente {clientName} para {dateRange}.

## Datos del período
- Costo total: {costo}
- ROAS: {roas}x (target: {roas_target}x)
- CPA: {cpa} (target: {cpa_target})
- Conversiones primarias: {conversiones}
- CTR: {ctr}%

## Campañas activas
{campaigns_table}

Producí:
1. Diagnóstico de 1-2 oraciones del estado general de Google Ads.
2. Las alertas que aplican.
3. Señales en formato JSON para el Master Brain.
4. Máximo 2 recomendaciones accionables.
```

**Alert rules:**
```json
[
  {
    "id": "GOOGLE_HIGH_CPA",
    "enabled": true,
    "condition": "CPA supera target en más del 50%",
    "threshold": 1.5,
    "severity": "CRITICAL",
    "messageTemplate": "CPA Google en {value} — {pct}% por encima del target {threshold}",
    "recommendation": "Revisar keywords de bajo Quality Score y ajustar bids"
  },
  {
    "id": "GOOGLE_BUDGET_WASTE",
    "enabled": true,
    "condition": "Campaña activa con 0 conversiones en N días",
    "threshold": 7,
    "severity": "WARNING",
    "messageTemplate": "{campaign} lleva {days} días activa sin conversiones",
    "recommendation": "Pausar campaña o revisar match types y landing"
  },
  {
    "id": "GOOGLE_LOW_CONVERSION_RATE",
    "enabled": true,
    "condition": "Tasa de conversión cayó vs semana anterior",
    "threshold": 0.2,
    "severity": "WARNING",
    "messageTemplate": "Conv. rate cayó {pct}% vs semana anterior",
    "recommendation": "Revisar cambios recientes en landing o en la oferta"
  }
]
```

### 5.4 Prompt del GA4Brain

**System prompt:**
```
Eres el GA4Brain, árbitro del comportamiento post-clic.
Tu trabajo no es medir si la pauta funciona — eso lo hacen MetaBrain y GoogleBrain.
Tu trabajo es responder: ¿el problema está en la pauta o en el destino?

Principios:
- Si el CTR de Meta es estable pero la tasa de rebote subió, el problema es el destino, no el anuncio.
- Si las sesiones cayeron pero el paid está estable, el problema puede ser orgánico o directo.
- Siempre verificás la calidad del dato antes de generar alertas. Nulls en funnel = no alertar.
- Reportás la fuente de la verdad (qué tan confiable es el tracking de GA4 para este cliente).
- Respondés siempre en español.
```

**Analysis prompt template:**
```
Analizá el comportamiento web del cliente {clientName} para {dateRange}.

## Tráfico
- Sesiones: {sesiones} ({sesiones_delta}% vs período anterior)
- Usuarios activos: {usuarios}
- Usuarios nuevos: {usuarios_nuevos} (null = no configurado)
- Tasa rebote: {tasa_rebote}% (baseline: {rebote_baseline}%)
- Tasa compromiso: {tasa_compromiso}%

## Funnel ecommerce (calidad del dato: {data_quality})
- Agregar al carrito: {add_to_cart} (null = GA4 e-commerce no configurado)
- Iniciar checkout: {initiate_checkout}
- Compras GA4: {compras_ga4}
- Tasa checkout → compra: {tasa_checkout}% (baseline: {checkout_baseline}%)

## SEO orgánico
- Clics orgánicos: {clics_organicos} ({organico_delta}% vs semana anterior)
- Impresiones: {impresiones_organicas}
- CTR orgánico: {ctr_organico}%

Producí:
1. Diagnóstico de 1-2 oraciones sobre el comportamiento web.
2. Las alertas que aplican (solo si data_quality >= MEDIUM para alertas de funnel).
3. Señales en formato JSON para el Master Brain.
4. Máximo 1 recomendación accionable.
```

**Alert rules:**
```json
[
  {
    "id": "GA4_BOUNCE_SPIKE",
    "enabled": true,
    "condition": "Tasa de rebote supera baseline en más del umbral",
    "threshold": 20,
    "severity": "WARNING",
    "messageTemplate": "Rebote en {value}% — {pct}% por encima del baseline {baseline}%",
    "recommendation": "Revisar landing page antes de tocar pauta. El anuncio puede estar bien."
  },
  {
    "id": "GA4_CHECKOUT_DEGRADATION",
    "enabled": true,
    "condition": "Tasa checkout-a-compra cayó vs semana anterior (requiere data_quality MEDIUM+)",
    "threshold": 15,
    "severity": "WARNING",
    "messageTemplate": "Conversión en checkout cayó {pct}% vs semana anterior",
    "recommendation": "Revisar el proceso de pago. Puede ser un problema técnico."
  },
  {
    "id": "GA4_ORGANIC_DROP",
    "enabled": true,
    "condition": "Clics orgánicos caen vs semana anterior",
    "threshold": 25,
    "severity": "WARNING",
    "messageTemplate": "Clics orgánicos cayeron {pct}% — puede afectar conversión total",
    "recommendation": "Verificar posiciones en Search Console antes de ajustar pauta paid"
  },
  {
    "id": "GA4_SESSION_DROP",
    "enabled": true,
    "condition": "Sesiones caen significativamente sin cambios en paid",
    "threshold": 20,
    "severity": "INFO",
    "messageTemplate": "Sesiones cayeron {pct}% sin cambios en inversión paid",
    "recommendation": "Revisar tráfico directo y orgánico. Puede haber un problema técnico del sitio."
  }
]
```

### 5.5 Prompt del EcommerceBrain

**System prompt:**
```
Eres el EcommerceBrain, la fuente de verdad del negocio.
Tus números son los que realmente facturó el cliente — no los que reportan Meta ni Google.
Tu trabajo es responder: ¿cómo le fue al negocio hoy, independientemente de lo que digan las plataformas?

Principios:
- Trabajás solo con órdenes "paid". Pending, cancelled y refunded tienen su propio análisis.
- El Blended ROAS que calculás usa tus ingresos como numerador — no los de Meta ni GA4.
- Un spike de refunds puede explicar una caída de ROAS que no tiene nada que ver con la pauta.
- Respondés siempre en español.
```

**Analysis prompt template:**
```
Analizá las ventas del cliente {clientName} para {dateRange}.

## Ventas reales (solo órdenes "paid")
- Ingresos brutos: {ingresos}
- Órdenes pagadas: {ordenes_paid}
- Ticket promedio: {ticket}

## Estado de órdenes
- Pending: {ordenes_pending}
- Refunded: {ordenes_refunded} ({refund_rate}% del total paid)
- Cancelled: {ordenes_cancelled}

## Contexto paid media
- Inversión total (Meta + Google): {costo_total}
- Blended ROAS real: {blended_roas}x (ingresos reales / inversión paid)

## Comparativa
- vs ayer: {ingresos_delta}% ingresos | {ordenes_delta}% órdenes
- vs semana pasada (mismo día): {ingresos_vs_semana}%

Producí:
1. Diagnóstico de 1-2 oraciones del estado de ventas.
2. Las alertas que aplican.
3. Señales en formato JSON para el Master Brain.
```

**Alert rules:**
```json
[
  {
    "id": "ECOMMERCE_ORDERS_DROP",
    "enabled": true,
    "condition": "Caída de órdenes vs período anterior supera umbral",
    "threshold": 20,
    "severity": "CRITICAL",
    "messageTemplate": "Órdenes cayeron {pct}% vs período anterior",
    "recommendation": "Verificar stock, estado del sitio y pauta antes de actuar"
  },
  {
    "id": "ECOMMERCE_REFUND_SPIKE",
    "enabled": true,
    "condition": "Tasa de reembolsos supera umbral del total de órdenes paid",
    "threshold": 5,
    "severity": "WARNING",
    "messageTemplate": "Reembolsos en {value}% del total — puede afectar ROAS real",
    "recommendation": "Revisar con el cliente qué productos están siendo devueltos"
  }
]
```

### 5.6 Prompt del Master Brain

**System prompt:**
```
Eres el Master Brain, cerebro integrador del sistema Worker Brain v2.
Recibís los análisis de MetaBrain, GoogleBrain, GA4Brain y EcommerceBrain
y tu trabajo es producir un único Business Briefing que responda:
¿Qué pasó ayer en el negocio y qué hay que hacer hoy?

Principios:
- Correlacionás señales. Un problema que aparece en dos canales es más importante que uno en uno solo.
- Distinguís problemas de pauta de problemas de negocio.
- Priorizás máximo 5 alertas. Más alertas = menos acción.
- El Blended ROAS siempre indica su fuente (Ecommerce > GA4 > Plataformas).
- Si un Brain no tiene datos, no inventás correlaciones que lo requieren.
- Respondés siempre en español.
```

**Analysis prompt template:**
```
Generá el Business Briefing para el cliente {clientName} — {fecha}.

## MetaBrain
{meta_brain_output}

## GoogleBrain
{google_brain_output}

## GA4Brain
{ga4_brain_output}

## EcommerceBrain
{ecommerce_brain_output}

## Blended ROAS
- Inversión total: {costo_total}
- Ingresos reales ({fuente_ingreso}): {ingresos_reales}
- Blended ROAS: {blended_roas}x
- Meta reporta: {meta_roas}x | Google reporta: {google_roas}x
- Brecha atribución: {brecha}% (plataformas atribuyen {pct} más de lo que vende el ecommerce)

Producí el Business Briefing en el formato Slack definido.
Priorizá máximo 5 alertas combinando las de todos los Brains.
Incluí las correlaciones cross-canal que correspondan según las reglas.
```

**Cross-channel correlation rules:**
```json
[
  {
    "id": "ATTRIBUTION_DISCREPANCY",
    "enabled": true,
    "condition": "Suma de ingresos reportados por plataformas supera ingresos reales en umbral",
    "threshold": 40,
    "severity_warning": 1.4,
    "severity_critical": 2.0,
    "messageTemplate": "Plataformas se atribuyen {pct}% más de lo que facturó el negocio",
    "recommendation": "Revisar ventanas de atribución en Meta y Google",
    "requires": ["META", "GOOGLE", "ECOMMERCE"]
  },
  {
    "id": "LANDING_DEGRADATION",
    "enabled": true,
    "condition": "CTR Meta estable AND tasa de rebote subió",
    "ctr_variation_max": 10,
    "bounce_spike_min": 20,
    "severity": "WARNING",
    "messageTemplate": "El anuncio funciona (CTR estable) pero el destino falla (rebote +{pct}%)",
    "recommendation": "Revisar landing page. No pausar campañas todavía.",
    "requires": ["META", "GA4"],
    "min_ga4_quality": "MEDIUM"
  },
  {
    "id": "CHANNEL_CANNIBALIZATION",
    "enabled": true,
    "condition": "Meta y Google se atribuyen compras que GA4 no registra proporcionalmente",
    "threshold": 1.5,
    "severity": "INFO",
    "messageTemplate": "Meta y Google se están atribuyendo las mismas compras",
    "recommendation": "Revisar audiencias de exclusión en ambas plataformas",
    "requires": ["META", "GOOGLE", "GA4"]
  },
  {
    "id": "ORGANIC_SUPPORT_DROP",
    "enabled": true,
    "condition": "Clics orgánicos cayeron significativamente",
    "threshold": 25,
    "severity": "WARNING",
    "messageTemplate": "Tráfico orgánico cayó {pct}% — puede explicar caída general de conversión",
    "recommendation": "Verificar Search Console antes de atribuir el problema a la pauta",
    "requires": ["GA4"]
  },
  {
    "id": "ECOMMERCE_DIVERGENCE",
    "enabled": true,
    "condition": "Compras de GA4 difiere de órdenes paid de ecommerce en más del umbral",
    "threshold": 20,
    "severity": "WARNING",
    "messageTemplate": "GA4 registra {ga4_compras} compras, ecommerce registra {ecommerce_ordenes} — divergencia de {pct}%",
    "recommendation": "Auditar configuración de GA4 e-commerce tracking",
    "requires": ["GA4", "ECOMMERCE"]
  }
]
```

---

## 6. Estructura de Cache en Firestore

```
dashbo_snapshots/
  {clientId}/
    {YYYY-MM-DD}/
      meta/              → snapshot completo de Meta del día
      google/            → snapshot Google Ads
      ga4/               → snapshot GA4
      ecommerce/         → snapshot TiendaNube/Shopify
      master/            → output del Master Brain (alertas + briefing)
      meta_by_campaign/  → breakdown por campaña
      meta_by_ad/        → breakdown por anuncio (creativos)
      ga4_by_source/     → breakdown por fuente/medio
      ga4_by_landing/    → breakdown por página destino
    {YYYY-MM}/
      mtd_meta/          → acumulado mensual Meta
      mtd_google/        → acumulado mensual Google
      mtd_ga4/           → acumulado mensual GA4
      mtd_ecommerce/     → acumulado mensual Ecommerce

brain_prompts/
  meta/                  → BrainPrompt del MetaBrain (con version y alertRules)
  google/                → BrainPrompt del GoogleBrain
  ga4/                   → BrainPrompt del GA4Brain
  ecommerce/             → BrainPrompt del EcommerceBrain
  master/                → BrainPrompt del Master Brain (con cross-channel rules)
```

El cron lee siempre de Firestore primero. Solo llama al MCP si el snapshot no existe o tiene más de 6 horas.

---

## 7. Lógica de cada Channel Brain

### 7.1 MetaBrain (refactorización del estado actual)

El AlertEngine, DecisionEngine y CreativeClassifier actuales se envuelven en la interfaz ChannelBrain. Sin reescritura.

**Señales que emite hacia el Master Brain:**
```typescript
signals: {
  meta_roas: number,
  meta_cpa: number,
  meta_frecuencia_promedio: number,
  meta_pixel_purchases: number,
  meta_valor_compra: number,
  meta_budget_pace: number,
  meta_has_bleeding_campaigns: boolean,
  meta_has_scaling_opportunities: boolean,
  meta_top_ad_id: string,
  meta_top_ad_roas: number
}
```

### 7.2 GoogleBrain (nuevo)

**Señales que emite:**
```typescript
signals: {
  google_roas: number,
  google_cpa: number,
  google_conversiones: number,
  google_valor_compra: number,
  google_costo: number,
  google_is_active: boolean
}
```

### 7.3 GA4Brain (nuevo)

**Señales que emite:**
```typescript
signals: {
  ga4_sesiones: number,
  ga4_tasa_rebote: number,
  ga4_tasa_checkout_a_compra: number | null,
  ga4_compras: number,
  ga4_ingresos: number,
  ga4_valor_promedio_orden: number | null,
  ga4_usuarios_nuevos: number | null,
  ga4_usuarios_recurrentes: number,
  ga4_clics_organicos: number,
  ga4_tasa_compromiso: number,
  ga4_data_quality: 'HIGH' | 'MEDIUM' | 'LOW'
}
```

**Lógica de calidad:** Si `GA4__Agregar_al_carrito` y `GA4__Iniciar_checkout` son null → `ga4_data_quality: 'MEDIUM'` → no genera alertas de funnel → Master Brain no activa `LANDING_DEGRADATION` sin calidad >= MEDIUM.

### 7.4 EcommerceBrain (nuevo)

**Señales que emite:**
```typescript
signals: {
  ecommerce_ingresos_brutos: number,
  ecommerce_ordenes_pagadas: number,
  ecommerce_ordenes_canceladas: number,
  ecommerce_ordenes_reembolsadas: number,
  ecommerce_valor_promedio_orden: number,
  ecommerce_cpa_real: number,
  ecommerce_roas_real: number,
  ecommerce_is_active: boolean
}
```

---

## 8. Master Brain — Cálculo del Blended ROAS

```typescript
function calcularBlendedROAS(signals: ChannelSignals[]): BlendedMetrics {
  const costoMeta   = signals.meta?.kpis.costo ?? 0
  const costoGoogle = signals.google?.kpis.costo ?? 0
  const costoTotal  = costoMeta + costoGoogle

  // Fuente de verdad: Ecommerce > GA4 > Suma de plataformas
  const ingresoReal = signals.ecommerce?.signals.ecommerce_ingresos_brutos
    ?? signals.ga4?.signals.ga4_ingresos
    ?? (signals.meta?.kpis.ingresos ?? 0) + (signals.google?.kpis.ingresos ?? 0)

  return {
    blendedROAS: ingresoReal / costoTotal,
    metaROAS: signals.meta?.kpis.roas ?? null,
    googleROAS: signals.google?.kpis.roas ?? null,
    discrepanciaAtribucion: calcularDiscrepancia(signals),
    fuenteIngreso: signals.ecommerce ? 'ECOMMERCE' : signals.ga4 ? 'GA4' : 'PLATAFORMAS'
  }
}
```

---

## 9. Business Briefing — Formato Slack

```
📊 WORKER MASTER BRAIN — Business Briefing
Cliente: {nombre} | {día} {fecha}

━━━━━━━━━━━━━━━━━━━━━━━━━
💰 NEGOCIO REAL ({periodo})
━━━━━━━━━━━━━━━━━━━━━━━━━
Ventas: ${ecommerce_ingresos} ({delta_vs_ayer}% vs ayer)
Órdenes: {ordenes} | Ticket: ${ticket_promedio}
Blended ROAS: {blended_roas}x
  ↳ Meta reporta: {meta_roas}x | Google reporta: {google_roas}x
  ↳ Brecha atribución: +{brecha}% (plataformas vs real)

━━━━━━━━━━━━━━━━━━━━━━━━━
📣 PAID MEDIA
━━━━━━━━━━━━━━━━━━━━━━━━━
Meta: ${meta_costo} gastados | ROAS {meta_roas}x | CPA ${meta_cpa} {meta_semaforo}
Google: ${google_costo} gastados | ROAS {google_roas}x | CPA ${google_cpa} {google_semaforo}

━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 COMPORTAMIENTO WEB (GA4)
━━━━━━━━━━━━━━━━━━━━━━━━━
Sesiones: {sesiones} | Rebote: {tasa_rebote}% {rebote_delta}
Conversión checkout: {tasa_checkout}% {checkout_delta}

━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ ATENCIÓN HOY ({n} alertas)
━━━━━━━━━━━━━━━━━━━━━━━━━
{alerta_1_emoji} [{alerta_1_tipo}] {alerta_1_mensaje}
Acción: {alerta_1_recomendacion}

{alerta_2_emoji} [{alerta_2_tipo}] {alerta_2_mensaje}
Acción: {alerta_2_recomendacion}

[Ver dashboard completo →]
```

**Secciones condicionales:**
- NEGOCIO REAL → solo si EcommerceBrain activo
- GA4 → solo si GA4Brain activo
- Blended ROAS → "N/A" si solo hay datos de plataformas
- Sin alertas → `✅ Todo en orden. Sin acciones requeridas hoy.`

**Priorización de alertas (máximo 5):**
1. CRITICAL cross-canal (ATTRIBUTION_DISCREPANCY grave, ECOMMERCE_ORDERS_DROP)
2. CRITICAL canal individual (META_BUDGET_BLEED, GOOGLE_HIGH_CPA)
3. WARNING cross-canal (LANDING_DEGRADATION, CHANNEL_CANNIBALIZATION)
4. WARNING canal individual (GA4_BOUNCE_SPIKE, GA4_CHECKOUT_DEGRADATION)
5. INFO (ORGANIC_SUPPORT_DROP, oportunidades)

---

## 10. Configuración del Cliente

```typescript
interface ClientConfigV2 extends ClientConfigV1 {
  // Integraciones activas (determinan qué Channel Brains corren)
  integraciones: {
    meta: boolean
    google: boolean
    ga4: boolean
    ecommerce: 'tiendanube' | 'shopify' | null
    email: 'klaviyo' | 'perfit' | null  // Fase 2
  }

  // Targets para semáforos
  targets: {
    cpa_meta?: number
    cpa_google?: number
    roas_meta?: number
    roas_google?: number
    blended_roas_target?: number
    tasa_rebote_baseline?: number
    tasa_checkout_baseline?: number
  }

  // Umbrales para alertas cross-canal (con defaults)
  crossChannelThresholds: {
    attribution_discrepancy_pct: number  // default: 40
    organic_drop_pct: number             // default: 25
    bounce_spike_pct: number             // default: 20
  }

  // Zona horaria para construcción de fechas
  timezone: string  // default: "America/Argentina/Buenos_Aires"
}
```

---

## 11. Fases de Implementación

### FASE 1 — Refactorización Base (MetaBrain como ChannelBrain)
**Objetivo:** Preparar la arquitectura sin romper nada existente.
- Extraer interfaz `ChannelBrain` / `ChannelSignals` en TypeScript
- Implementar `date-utils.ts` con `buildDateRanges`, `parseDashboDate` y `buildDateRangesForTimezone`
- Envolver AlertEngine + DecisionEngine + CreativeClassifier existentes como `MetaBrain`
- Crear `DashboDataFetcher` con las 5 queries definidas en Sección 4
- Migrar cache de `creative_kpi_snapshots` a estructura `dashbo_snapshots/{clientId}/{date}/{canal}`
- Crear colección `brain_prompts` en Firestore con prompt v1.0.0 del MetaBrain (system + analysis + alertRules)
- Agregar campos `integraciones`, `targets`, `timezone` al formulario de cliente en `/admin/clients`
- **Entregable:** El sistema actual funciona exactamente igual pero sobre la nueva arquitectura, con prompts iterables desde Firestore sin deploy

### FASE 2 — EcommerceBrain (TiendaNube/Shopify via Dashbo)
**Objetivo:** Conectar ventas reales.
- Implementar `EcommerceBrain` con Q5
- Calcular Blended ROAS en el Master Brain
- Agregar sección "NEGOCIO REAL" al Business Briefing
- Alertas `ECOMMERCE_ORDERS_DROP` y `ECOMMERCE_REFUND_SPIKE` (prompt en Firestore)
- Nuevo panel `/dashboard/ecommerce`
- **Entregable:** El Briefing muestra ventas reales vs ROAS de plataforma

### FASE 3 — GA4Brain
**Objetivo:** Diagnósticos de comportamiento post-clic.
- Implementar `GA4Brain` con Q4
- Lógica de `ga4_data_quality` para nulls
- Alertas `GA4_BOUNCE_SPIKE`, `GA4_CHECKOUT_DEGRADATION`, `GA4_ORGANIC_DROP`
- Correlaciones `LANDING_DEGRADATION` y `ECOMMERCE_DIVERGENCE` en el Master Brain
- Nuevo panel `/dashboard/ga4`
- **Entregable:** El sistema distingue problemas de pauta vs problemas de landing

### FASE 4 — GoogleBrain
**Objetivo:** Visión cross-paid y detección de canibalización.
- Implementar `GoogleBrain` con Q3
- Alertas `GOOGLE_HIGH_CPA`, `GOOGLE_LOW_CONVERSION_RATE`, `GOOGLE_BUDGET_WASTE`
- Correlaciones `ATTRIBUTION_DISCREPANCY` y `CHANNEL_CANNIBALIZATION`
- Nuevo panel `/dashboard/google`
- **Entregable:** Vista unificada de inversión paid + alertas de eficiencia Google

### FASE 5 — Business Overview Dashboard
**Objetivo:** Panel unificado estratégico.
- Nuevo panel `/dashboard/overview`
- Funnel unificado: Sesiones GA4 → Add to Cart → Checkout → Compra (ecommerce real)
- Comparativa de ROAS: Meta reportado vs Google reportado vs Blended real
- Histórico de Blended ROAS (30 días)
- **Entregable:** Una sola pantalla con el estado del negocio

### FASE 6 — Email Marketing (Klaviyo / Perfit)
**Objetivo:** Sinergias email ↔ paid.
- Evaluar si Dashbo agrega Klaviyo/Perfit o API directa
- Construir `EmailBrain` con su prompt en Firestore
- Alerta `EMAIL_SYNERGY_WINDOW`
- Sección EMAIL en el Business Briefing
- **Entregable:** El sistema detecta ventanas de intención de email para escalar retargeting

---

## 12. Principios de Desarrollo

**Los prompts son el producto, el código es el contenedor.** Cada Brain tiene su prompt en Firestore, versionado y editable sin deploy. Iterar la lógica de análisis es editar texto, no código.

**Las alert rules son configuración, no lógica.** Los umbrales, severidades y mensajes se almacenan como JSON en Firestore junto al prompt. Cambiar un threshold no requiere PR.

**Nulls son información, no errores.** Si GA4 devuelve null, el Brain registra la ausencia y ajusta confianza. No lanza excepción ni genera alertas sin datos.

**Un Channel Brain sin datos es un Brain en modo silencioso.** Si el cliente no tiene GA4, `GA4Brain` devuelve null y el Master Brain no ejecuta correlaciones que lo requieren. No hay fallback inventado.

**El Blended ROAS siempre indica su fuente.** Siempre se muestra de dónde viene el número de ingreso: Ecommerce > GA4 > Plataformas.

**Las comparativas se resuelven desde el cache.** Los deltas "ayer vs antesdeayer" se calculan leyendo Firestore, nunca haciendo queries adicionales al MCP.

**El cron primero lee Firestore.** Solo llama al MCP si el snapshot no existe o tiene más de 6 horas. La `timezone` del cliente determina cómo se construyen las fechas.
