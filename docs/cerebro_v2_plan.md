# Cerebro de Worker V2 — Plan de Implementación

**Fecha**: 2026-03-05
**Estado**: Pendiente de inicio
**Prerequisito completado**: Data Layer (Meta, Google, Ecommerce, Email syncs + channel_snapshots)

---

## Análisis: Plan Original vs Estado Actual

### Lo que se completó (Data Layer - ~70% del trabajo pesado)

| Área | Plan Original | Estado Actual |
|------|--------------|---------------|
| **Colección unificada** | `dashbo_snapshots/{clientId}/{date}/{canal}` | `channel_snapshots` con `{clientId}__CHANNEL__YYYY-MM-DD` |
| **Meta Ads sync** | Via Dashbo MCP | Directo via Meta API + cron `sync-meta` |
| **Google Ads sync** | Via Dashbo MCP (Phase 4) | Directo via Google Ads API + cron `sync-google` |
| **Ecommerce sync** | Via Dashbo MCP (Phase 2) | Directo via Shopify/TiendaNube/WooCommerce + cron `sync-ecommerce` |
| **Email sync** | Phase 6 (última) | Ya implementado: Klaviyo + Perfit + cron `sync-email` |
| **Backfill** | No estaba en el plan | `ChannelBackfillService` automático |
| **Client config** | `integraciones`, `targets`, `timezone` | `integraciones` hecho, `targets` parcial, `timezone` no |
| **Teams** | No estaba en el plan | Implementado |
| **Admin UI** | Tabs de integración en ClientForm | Hecho con toggles + credenciales + iconos de canal |
| **Cron scheduling** | Manual / cron_executions | Vercel native crons + event logging |
| **Tipos unificados** | `UnifiedChannelMetrics` | Implementado en `channel-snapshots.ts` |

### Lo que NO se hizo (Intelligence Layer - el cerebro propiamente dicho)

| Componente | Estado | Impacto |
|------------|--------|---------|
| **ChannelBrain interface** | No existe | Sin arquitectura de análisis por canal |
| **MetaBrain** | No existe (AlertEngine sigue suelto) | Análisis Meta no modular |
| **GoogleBrain** | No existe | Sin alertas ni análisis Google |
| **GA4Brain** | No existe + **falta el sync de GA4** | Sin datos de comportamiento web |
| **EcommerceBrain** | No existe | Sin alertas de ecommerce |
| **EmailBrain** | No existe | Sin insights de email (ej: Perfit automations 10% conv rate) |
| **Master Brain** | No existe | Sin correlación cross-channel |
| **Brain Prompts** | No existe | Prompts hardcodeados, no editables sin deploy |
| **Business Briefing** | No existe | Slack sigue siendo Meta-only |
| **Blended ROAS** | No se calcula | Cada canal reporta su ROAS aislado |
| **Cross-channel alerts** | No existen | Sin detección de canibalización, atribución, etc. |
| **Overview dashboard** | Ruta existe en nav, página no implementada | Sin vista unificada de negocio |
| **GA4 data collection** | No existe | El único canal que falta sincronizar |

### Resumen

Se construyó toda la plomería (data collection, storage, cron jobs, backfill, admin UI) pero falta el cerebro (análisis, correlación, alertas inteligentes, business briefing). Es como tener todos los sensores instalados pero sin el procesador que interpreta las señales.

---

## Plan de Implementación

### PHASE 1 — GA4 Sync + ChannelBrain Interface (1 semana)

**Objetivo**: Completar la recolección de datos + definir la interfaz que todos los brains van a implementar.

#### 1.1 GA4 Data Sync
- Crear `src/lib/ga4-service.ts` — Google Analytics Data API (v1beta)
  - Métricas: sessions, users, bounceRate, conversions, revenue, addToCart, checkouts
  - Dimensiones: sessionSource/Medium, channelGrouping, landingPage, date
  - Escribir a `channel_snapshots` con `channel: 'GA4'`
- Crear `/api/cron/sync-ga4` — Cron diario
- Agregar a `vercel.json`
- Agregar campos a `ClientConfig`: `ga4PropertyId`, toggle en `integraciones.ga4`
- Backfill support en `ChannelBackfillService`

#### 1.2 ChannelBrain Interface
- Crear `src/lib/brains/types.ts`:
```typescript
interface ChannelSignals {
  channel: 'META' | 'GOOGLE' | 'GA4' | 'ECOMMERCE' | 'EMAIL'
  clientId: string
  period: { start: string; end: string }
  kpis: Record<string, number | null>
  alerts: ChannelAlert[]
  signals: Record<string, number | string | boolean | null>
  dataQuality: { confidence: 'HIGH' | 'MEDIUM' | 'LOW'; missingFields: string[] }
}

interface ChannelBrain {
  channel: string
  analyze(snapshots: ChannelDailySnapshot[], config: EngineConfig, targets: ClientTargets): ChannelSignals
}
```
- Crear `src/lib/brains/` folder structure

---

### PHASE 2 — Channel Brains: Meta + Google + Ecommerce (2 semanas)

**Objetivo**: Cada canal analiza sus propios datos y emite señales + alertas.

#### 2.1 MetaBrain (`src/lib/brains/meta-brain.ts`)
- Refactorizar `AlertEngine.evaluate()` existente como base
- Consumir `channel_snapshots` de META
- Alertas Meta existentes (16 tipos) migradas a este brain
- Emitir `ChannelSignals` con: roas, cpa, frequency, hook_rate, scaling_opportunities
- Incorporar creative classification + DNA como señales

#### 2.2 GoogleBrain (`src/lib/brains/google-brain.ts`)
- Alertas nuevas: `GOOGLE_HIGH_CPA`, `GOOGLE_BUDGET_WASTE`, `GOOGLE_LOW_CONVERSION_RATE`
- Señales: roas, cpa, conversion_rate, impression_share
- Comparativas vs período anterior (delta%)

#### 2.3 EcommerceBrain (`src/lib/brains/ecommerce-brain.ts`)
- Alertas: `ECOMMERCE_ORDERS_DROP`, `ECOMMERCE_REFUND_SPIKE`, `ECOMMERCE_AOV_CHANGE`
- Señales: orders_paid, revenue, aov, refund_rate, pending_orders
- Detección de tendencias (7d rolling)

---

### PHASE 3 — Channel Brains: GA4 + Email (1 semana)

#### 3.1 GA4Brain (`src/lib/brains/ga4-brain.ts`)
- Alertas: `GA4_BOUNCE_SPIKE`, `GA4_CHECKOUT_DEGRADATION`, `GA4_SESSION_DROP`, `GA4_ORGANIC_DROP`
- Señales: sessions, bounce_rate, checkout_rate, organic_share, conversion_rate_by_channel
- Cruzar datos de channel grouping con inversión en ads
- Data quality handling: Si GA4 no tiene datos, emitir `confidence: 'LOW'`, no errores

#### 3.2 EmailBrain (`src/lib/brains/email-brain.ts`)
- Alertas: `EMAIL_REVENUE_SPIKE` (oportunidad), `EMAIL_OPEN_RATE_DROP`, `EMAIL_AUTOMATION_OUTPERFORMS`
- Señales: email_revenue, automation_revenue, campaign_revenue, conversion_rate, identified_session_rate
- **Insight clave** (del análisis de Perfit/Blackhorn): Detectar cuando automations convierten a tasa >> campañas -> señal de que hay que mejorar captura de email
- Señal de `email_share_of_revenue` para que Master Brain calcule dependencia

---

### PHASE 4 — Master Brain + Blended ROAS (2 semanas)

**Objetivo**: Correlación cross-channel. El corazón del cerebro.

#### 4.1 Master Brain (`src/lib/brains/master-brain.ts`)
- Recibe `ChannelSignals[]` de todos los brains activos
- Calcula **Blended ROAS real**:
  ```
  blended_roas = ecommerce_revenue_paid / (meta_spend + google_spend)
  source_label = 'ecommerce' | 'ga4' | 'platforms'
  ```
- **5 correlaciones cross-channel**:
  1. `ATTRIBUTION_DISCREPANCY` — Plataformas reportan 40%+ más que ecommerce real
  2. `LANDING_DEGRADATION` — CTR estable + bounce rate sube -> problema de landing, no de ad
  3. `CHANNEL_CANNIBALIZATION` — Meta + Google atribuyen las mismas compras
  4. `EMAIL_CAPTURE_OPPORTUNITY` — Automations convierten 10x+ más que campañas pero identification rate < 10%
  5. `ORGANIC_SUPPORT_DROP` — Tráfico orgánico cae -> explica baja en conversiones

#### 4.2 Almacenamiento
- Guardar output del Master Brain en `channel_snapshots` con `channel: 'MASTER'`
- O en nueva colección `brain_outputs/{clientId}/{date}`
- Incluir: blended_roas, cross_channel_alerts, channel_health_scores

#### 4.3 Orquestador
- Actualizar `data-sync` cron para ejecutar:
  1. Leer snapshots de todos los canales
  2. Ejecutar cada ChannelBrain -> ChannelSignals
  3. Ejecutar MasterBrain(allSignals) -> MasterOutput
  4. Guardar en Firestore

---

### PHASE 5 — Brain Prompts + Business Briefing (1.5 semanas)

#### 5.1 Brain Prompts (editable sin deploy)
- Colección `brain_prompts/{brainId}` en Firestore
- Cada prompt tiene: `systemPrompt`, `analysisTemplate`, `alertRules[]`, `version`
- `BrainPromptService` con cache en memoria (TTL 5min)
- UI en `/admin/cerebro` Tab nuevo: "Channel Brains" — editor de prompts por canal
- Los AlertRules se definen como JSON editable:
  ```json
  { "type": "META_HIGH_FREQUENCY", "condition": "frequency > {threshold}", "threshold": 3.5, "severity": "WARNING" }
  ```

#### 5.2 Business Briefing (Slack)
- Nuevo formato de Slack digest que integra TODOS los canales:
```
WORKER MASTER BRAIN — Business Briefing
Cliente: {nombre} | {día} {fecha}

━━━━━━━━━━━━━━━━━━━━━━━━━
NEGOCIO REAL (yesterday)
━━━━━━━━━━━━━━━━━━━━━━━━━
Ventas: ${ingresos} ({delta_vs_ayer}% vs ayer)
Órdenes: {count} | Ticket: ${promedio}
Blended ROAS: {blended_roas}x [source: ecommerce|ga4|platforms]
  -> Meta reporta: {meta_roas}x | Google reporta: {google_roas}x
  -> Brecha atribución: +{brecha}%

━━━━━━━━━━━━━━━━━━━━━━━━━
PAID MEDIA
━━━━━━━━━━━━━━━━━━━━━━━━━
Meta: ${costo} | ROAS {meta_roas}x | CPA ${meta_cpa} {semaforo}
Google: ${costo} | ROAS {google_roas}x | CPA ${google_cpa} {semaforo}

━━━━━━━━━━━━━━━━━━━━━━━━━
EMAIL
━━━━━━━━━━━━━━━━━━━━━━━━━
Revenue: ${email_revenue} ({email_share}% del total)
Automations: {automation_conv_rate}% conv rate ({automation_vs_campaign}x vs campañas)

━━━━━━━━━━━━━━━━━━━━━━━━━
COMPORTAMIENTO WEB (GA4)
━━━━━━━━━━━━━━━━━━━━━━━━━
Sesiones: {count} | Rebote: {tasa}% {delta}
Conversión checkout: {tasa}% {delta}

━━━━━━━━━━━━━━━━━━━━━━━━━
ATENCIÓN HOY (N alertas)
━━━━━━━━━━━━━━━━━━━━━━━━━
[CRITICAL] {mensaje} -> Acción: {recomendacion}
[WARNING] {mensaje} -> Acción: {recomendacion}
[INFO] {mensaje} -> Acción: {recomendacion}
```

---

### PHASE 6 — Overview Dashboard + UI (2 semanas)

#### 6.1 Overview Dashboard (`/overview`)
- KPIs principales: Revenue real, Blended ROAS, Inversión total, Órdenes
- Gráfico de revenue por fuente (ads vs email vs orgánico)
- Funnel unificado: Impresiones -> Clicks -> Sesiones -> ATC -> Checkout -> Compra
- ROAS comparison chart: Meta vs Google vs Blended vs Email ROI
- Timeline 30d con tendencias
- Alertas cross-channel activas

#### 6.2 Channel Health Cards
- Card por canal con semáforo (verde/amarillo/rojo) basado en ChannelBrain signals
- Click -> navega al dashboard del canal específico

#### 6.3 Mejoras a dashboards existentes
- Agregar contexto cross-channel a cada dashboard individual
  - En Meta: mostrar "este gasto generó X% del revenue real en ecommerce"
  - En Email: mostrar "automations rescataron X ventas de carritos abandonados de ads"

---

## Timeline

| Phase | Duración | Entregable principal |
|-------|----------|---------------------|
| 1. GA4 + Interface | 1 semana | Último canal de datos + contrato de brains |
| 2. Meta/Google/Ecom Brains | 2 semanas | Análisis por canal con alertas |
| 3. GA4 + Email Brains | 1 semana | Comportamiento web + insights de email |
| 4. Master Brain | 2 semanas | Correlación cross-channel + Blended ROAS |
| 5. Prompts + Briefing | 1.5 semanas | Editabilidad sin deploy + Slack unificado |
| 6. Overview + UI | 2 semanas | Dashboard ejecutivo multi-canal |
| **Total** | **~9.5 semanas** | **Cerebro completo multi-canal** |

---

## Diferencias clave vs plan original (worker_brain_v2_master_plan_1.md)

1. **Sin Dashbo** -> Data directa de APIs (ya implementado)
2. **EmailBrain es Phase 3** (no 6) -> Ya tenemos la data de Perfit/Klaviyo
3. **GA4 es Phase 1** (no 3) -> Es el único canal que falta sincronizar
4. **El insight de email-ads synergy** es nuevo -> Viene del análisis cruzado con Perfit (Blackhorn feb 2026: automations 10% conv rate vs 0.29% campañas)
5. **Data layer ya está hecho** -> El plan original mezclaba plomería con inteligencia, ahora es pura inteligencia

---

## Principios de diseño

1. **"Prompts are the product, code is the container"** — Iterar lógica de análisis editando texto, no código
2. **"Alert rules are configuration, not logic"** — Thresholds/severities en Firestore, editables sin deploy
3. **"Nulls are information, not errors"** — Manejar datos faltantes con confidence levels, no excepciones
4. **"Channel Brain without data = silent mode"** — Si no hay GA4 config, GA4Brain retorna null, Master Brain no falla
5. **"Blended ROAS always shows source"** — Ecommerce > GA4 > Platforms, siempre etiquetado
6. **"Each brain is pure computation"** — Sin DB access en analyze(), datos entran como parámetros (mismo pattern que AlertEngine.evaluate())

---

## Cómo retomar este plan

### Instrucción para Claude

Si estás leyendo esto en una nueva sesión, seguí estos pasos:

1. **Leé el CLAUDE.md** (`.claude/CLAUDE.md`) — Es el master reference de todo el proyecto. Tiene la arquitectura actual, colecciones de Firestore, tipos, servicios, crons, y convenciones.

2. **Entendé el patrón existente antes de crear nada nuevo**:
   - Leé `src/lib/alert-engine.ts` — El `evaluate()` es el patrón que TODOS los brains deben seguir: función pura, datos como parámetros, zero DB access, retorna resultados.
   - Leé `src/types/channel-snapshots.ts` — Los tipos `UnifiedChannelMetrics` y `ChannelDailySnapshot` son el input de los brains.
   - Leé `src/types/engine-config.ts` — `EngineConfig` tiene los thresholds configurables por cliente.

3. **Verificá el estado actual** antes de empezar:
   - `git status` para ver si hay cambios sin commitear
   - Revisá `vercel.json` para ver los crons activos
   - Revisá `src/types/index.ts` para ver el estado actual de `ClientConfig` e `integraciones`
   - Confirmá que `channel_snapshots` tiene datos ejecutando: la app debería tener datos de META, GOOGLE, ECOMMERCE, EMAIL

4. **Identificá la phase actual**: Revisá el campo "Estado" al inicio de este documento y el log de progreso abajo.

5. **Convenciones del proyecto**:
   - Framework: Next.js 14 App Router + TypeScript
   - DB: Firebase/Firestore con `ignoreUndefinedProperties: true`
   - Styling: Tailwind CSS (Stitch Design System, tokens en `src/lib/design-tokens.ts`)
   - IDs de documentos en Firestore: formato `{clientId}__{entity}__{date}` con doble underscore
   - Crons validan auth via `Authorization: Bearer {CRON_SECRET}` o header `x-cron-secret`
   - Cada cron loguea a `cron_executions` via `EventService`
   - Los servicios de sync exponen `syncToChannelSnapshots(clientId, startDate, endDate)`

6. **NO hagas**:
   - No rompas las alertas existentes de Meta (16 tipos en AlertEngine) — refactorizalas dentro de MetaBrain
   - No cambies el formato de IDs de `channel_snapshots`
   - No hagas que los brains accedan a Firestore directamente — son funciones puras
   - No crees colecciones nuevas si podés usar `channel_snapshots` con un nuevo `channel` type

### Archivos clave para leer antes de cada phase

| Phase | Leer primero |
|-------|-------------|
| 1 (GA4 + Interface) | `src/lib/google-ads-service.ts` (patrón de sync), `src/app/api/cron/sync-google/route.ts` (patrón de cron), `src/lib/channel-backfill-service.ts` |
| 2 (Meta/Google/Ecom Brains) | `src/lib/alert-engine.ts` (refactorizar), `src/lib/client-snapshot-service.ts` (consume alertas), `src/lib/creative-classifier.ts` |
| 3 (GA4 + Email Brains) | `src/lib/klaviyo-service.ts`, `src/lib/perfit-service.ts` (entender métricas de email) |
| 4 (Master Brain) | Todos los brains creados en phases 2-3, `src/lib/performance-service.ts` (rolling metrics pattern) |
| 5 (Prompts + Briefing) | `src/lib/prompt-utils.ts`, `src/lib/slack-service.ts` (formato actual de digests) |
| 6 (Overview + UI) | `src/components/pages/EcommerceChannel.tsx` (patrón de dashboard), `src/configs/navConfig.ts` |

### Log de progreso

| Fecha | Phase | Acción | Commit |
|-------|-------|--------|--------|
| 2026-03-05 | - | Plan creado | - |
| | | | |

---

## Contexto de referencia

- Plan original: `docs/worker_brain_v2_master_plan_1.md`
- Tipos de channel snapshots: `src/types/channel-snapshots.ts`
- AlertEngine (patrón de referencia): `src/lib/alert-engine.ts`
- Crons actuales: `vercel.json`
- Client config: `src/types/index.ts`
- Channel backfill: `src/lib/channel-backfill-service.ts`
- Slack service: `src/lib/slack-service.ts`
- Prompt utils: `src/lib/prompt-utils.ts`
- Design tokens: `src/lib/design-tokens.ts`
- Nav config: `src/configs/navConfig.ts`
