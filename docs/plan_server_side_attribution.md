# Server-Side Attribution & CAPI — Investigación y Plan de Implementación

## 1. Investigación: Qué Hace RedTrack

RedTrack es una plataforma de **server-side tracking y atribución multi-touch** que resuelve el problema central de la publicidad digital post-iOS 14: los pixels del navegador pierden ~30-50% de las conversiones por ad blockers, ITP, y restricciones de cookies de terceros.

### Arquitectura Core: Flujo Completo

```
                        ┌─────────────────────┐
                        │   Ad Platforms       │
                        │ (Meta, Google, TikTok)│
                        └──────────┬──────────┘
                                   │ click con fbclid/gclid/ttclid
                                   ▼
┌──────────────────────────────────────────────────────────┐
│  1. LANDING PAGE (first-party domain)                     │
│     - Script JS captura fbclid → cookie _fbc             │
│     - Captura gclid → cookie _gcl                        │
│     - Genera fbp (browser fingerprint) → cookie _fbp     │
│     - Genera click_id interno (UUID) → cookie 1st party  │
│     - Todo en cookies FIRST-PARTY (duran 1-2 años)       │
└──────────────────────────────┬───────────────────────────┘
                               │ usuario navega...
                               ▼
┌──────────────────────────────────────────────────────────┐
│  2. CONVERSIÓN (checkout/form/signup)                     │
│     - Ecommerce backend detecta la compra                │
│     - Lee cookies: _fbc, _fbp, _gcl, click_id interno   │
│     - Recolecta user_data: email, phone, IP, user_agent  │
│     - Genera event_id único (UUID v4)                    │
└──────────────────────────────┬───────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────┐
│  3. SERVIDOR DE ATRIBUCIÓN (el "cerebro")                │
│     a) MATCHING: cruza click_id con la sesión original   │
│        → sabe de qué ad/campaign/adset vino              │
│     b) DEDUPLICACIÓN: event_id evita contar 2x           │
│     c) ATRIBUCIÓN: aplica modelo (last-click, multi-touch)│
│     d) ENRUTAMIENTO: decide a qué APIs enviar            │
└──────┬──────────┬───────────┬───────────────────────────┘
       │          │           │
       ▼          ▼           ▼
   Meta CAPI   Google Ads   TikTok Events API
```

### Captura de Click IDs (Client-Side)

| Parámetro | Plataforma | Cookie resultante | Formato |
|-----------|-----------|-------------------|---------|
| `fbclid` | Meta | `_fbc` | `fb.1.{timestamp}.{fbclid}` |
| (browser) | Meta | `_fbp` | `fb.1.{timestamp}.{random}` |
| `gclid` | Google | `_gcl_aw` | El gclid raw |
| `ttclid` | TikTok | `_ttp` | El ttclid raw |

Son cookies **first-party** (dominio del store), sobreviven a ITP y ad blockers.

### Envío Server-to-Server: Meta CAPI

```
POST https://graph.facebook.com/v21.0/{pixel_id}/events
```
```json
{
  "data": [{
    "event_name": "Purchase",
    "event_time": 1709827200,
    "event_id": "order_12345",
    "action_source": "website",
    "user_data": {
      "em": ["sha256(email)"],
      "ph": ["sha256(phone)"],
      "fbc": "fb.1.1709827000.AbCdEf",  // NO hasheado
      "fbp": "fb.1.1709800000.123456",  // NO hasheado
      "client_ip_address": "1.2.3.4",
      "client_user_agent": "Mozilla/5.0..."
    },
    "custom_data": {
      "currency": "ARS",
      "value": 15000.00,
      "content_ids": ["SKU123"],
      "content_type": "product"
    }
  }],
  "access_token": "{token}"
}
```

**Reglas críticas:**
- `fbc` y `fbp` **NO se hashean** (rompe matching)
- `event_id` debe ser el **mismo** que el del pixel browser → Meta deduplica
- Email/phone **sí se hashean** con SHA256 (lowercase, sin espacios)

### Envío Server-to-Server: Google Ads Offline Conversions

```
ConversionUploadService.UploadClickConversions({
  gclid: "CjwKCAj...",
  conversion_action: "customers/123/conversionActions/456",
  conversion_date_time: "2024-03-07 14:30:00-03:00",
  conversion_value: 15000.00,
  currency_code: "ARS"
})
```

**Reglas críticas:**
- `gclid` tiene ventana de **63 días** máximo
- Batch recomendado (no 1 request por conversión)
- Se puede enviar `user_identifiers` (Enhanced Conversions) como fallback sin gclid

### Deduplicación Pixel + CAPI

1. Browser pixel dispara `Purchase` con `event_id: "order_123"`
2. Server CAPI envía `Purchase` con `event_id: "order_123"`
3. Meta recibe ambos → mismo `event_name` + `event_id` → cuenta solo 1

Google usa `gclid` + `conversion_action` + `conversion_date_time` para deduplicar. Opcionalmente `transaction_id` (recomendado).

---

## 2. Dos Estrategias Posibles

### Estrategia A: Híbrida (Pixel nativo + CAPI como refuerzo)

```
Pixel nativo del store (browser)  ── Purchase event_id: "order_123" ──→  Meta
                                                                          ↕ dedup
Worker Brain servidor (CAPI)      ── Purchase event_id: "order_123" ──→  Meta
```

- **No se desactiva nada**. El pixel del app de Meta sigue corriendo.
- El servidor envía el **mismo evento con el mismo `event_id`** via CAPI.
- Meta deduplica automáticamente por `event_name` + `event_id`.
- Si el pixel falla (ad blocker, iOS), el CAPI lo cubre. Si el CAPI falla, el pixel lo cubre.

### Estrategia B: Takeover (Desactivar pixel nativo, solo CAPI propio)

Lo que hacen Elevar, wetracked, RedTrack, Analyzify:

1. Desactivar "Data Sharing" en Shopify → Facebook & Instagram app
2. Desactivar Google tag nativo
3. Instalar script propio que captura click IDs
4. El servidor se convierte en la ÚNICA fuente de conversiones

**Ventaja**: Control total, mejor EMQ (Event Match Quality).
**Desventaja**: Single point of failure.

### Decisión: Estrategia A (Híbrida) para Worker Brain

Razones:
- No requiere que el cliente desactive nada (menor fricción)
- Menor riesgo (si Worker Brain falla, el pixel nativo sigue funcionando)
- Compatible con la infraestructura actual
- Valor agregado inmediato sin disrumpir el setup existente del cliente

---

## 3. Respuesta Clave: ¿Reduce la Superposición de Atribuciones?

### Lo que SÍ resuelve la Estrategia A

| Problema | Cómo lo resuelve |
|----------|-----------------|
| **Conversiones perdidas por pixel** | CAPI recupera el 30-50% que el pixel pierde por ad blockers/iOS |
| **Meta sub-reporta** | Meta recibe más conversiones reales → su ROAS reportado se acerca al real |
| **Google sub-reporta** | Google recibe conversiones offline con gclid → su CPA/ROAS mejora |
| **Optimización de algoritmos** | Meta y Google optimizan mejor sus ML models con más señales reales |
| **Gap ecommerce vs plataforma** | El gap que ya mostramos en cross_channel analyst se achica porque ambas plataformas reciben más data |

### Lo que NO resuelve la Estrategia A (sola)

| Problema | Por qué no lo resuelve |
|----------|----------------------|
| **Meta y Google cuentan la misma venta** | Cada plataforma atribuye según su propia ventana. Si un usuario hizo click en Meta Y en Google antes de comprar, ambas reclaman la venta. CAPI no cambia esto — solo da más data a cada una. |
| **ROAS inflado por doble conteo** | La suma de "conversiones Meta + conversiones Google" siempre será > conversiones reales del ecommerce. CAPI puede incluso **empeorar** esto si ahora cada plataforma captura más. |
| **Atribución cross-channel** | Para resolver la superposición real necesitás un **modelo de atribución propio** que diga "esta venta fue de Meta" vs "esta fue de Google" vs "esta fue orgánica". |

### La Solución Completa: CAPI + Atribución Propia (2 capas)

```
CAPA 1: CAPI (Estrategia A)
  → Resuelve: cada plataforma recibe TODAS las conversiones reales
  → Resultado: mejor optimización de campañas, menos conversiones perdidas

CAPA 2: ATRIBUCIÓN PROPIA (lo que ya empezamos con attribution en ecommerce)
  → Resuelve: la SUPERPOSICIÓN entre plataformas
  → Ya tenemos: UTM parsing de landing_site/referring_site (Shopify, TN, WC)
  → Ya tenemos: cross_channel analyst que compara Meta-reported vs ecommerce-real
  → Falta: usar fbclid/gclid de los orders para matchear conversiones
    con campañas específicas → saber "esta venta real fue de Meta campaign X"

COMBINADAS:
  → Meta recibe conversiones correctas vía CAPI (optimiza mejor)
  → Google recibe conversiones correctas vía Offline Import (optimiza mejor)
  → Worker Brain muestra atribución REAL sin superposición (dashboard de verdad)
  → El cliente ve: "Meta dice 100 ventas, Google dice 80, la realidad son 120 únicas"
```

---

## 4. Plan de Implementación

### Fase 1: Extracción de Click IDs de Orders (Quick Win)

**Objetivo**: Parsear `fbclid` y `gclid` de los orders que ya sync-eamos.
**Impacto**: Base de datos de qué conversiones vinieron de qué plataforma, con click ID real.
**Esfuerzo**: Bajo — es parseo de datos que ya tenemos.

**Cambios técnicos:**

1. **Shopify** — Parsear `fbclid`/`gclid` de `landing_site`:
   ```
   landing_site: "/products/x?utm_source=facebook&fbclid=AbCdEf123&gclid=CjwKCAj..."
   ```
   - Ya tenemos UTM parsing en `shopify-service.ts`
   - Agregar extracción de `fbclid` y `gclid` del query string
   - Guardar en `rawData.clickIds: { fbclid?: string, gclid?: string }[]`

2. **WooCommerce** — Parsear de `meta_data`:
   - WC 8.5+ guarda `_wc_order_attribution_utm_source` en meta_data
   - Algunos plugins guardan `_fbclid` y `_gclid` en meta_data
   - Agregar extracción si existen

3. **Tienda Nube** — Limitado:
   - TN no expone landing_site ni click IDs en su API
   - Solo tenemos `storefront` (store, meli, api, etc.)
   - Se puede inferir canal pero no click ID específico

4. **Almacenamiento**: Nuevo campo en `channel_snapshots` (ECOMMERCE):
   ```typescript
   rawData: {
     ...existing,
     clickIdMatches: {
       meta: number,    // orders con fbclid
       google: number,  // orders con gclid
       both: number,    // orders con ambos (superposición real!)
       none: number,    // orders sin click ID (orgánico/directo/email)
     },
     orderClickIds: Array<{
       orderId: string,
       fbclid?: string,
       gclid?: string,
       email_hash?: string,  // SHA256 para CAPI
       phone_hash?: string,  // SHA256 para CAPI
       created_at: string,
       total: number,
       currency: string,
     }>
   }
   ```

**Archivos a modificar:**
- `src/lib/shopify-service.ts` — agregar parseo de fbclid/gclid en `aggregateByDay()`
- `src/lib/woocommerce-service.ts` — agregar parseo de meta_data click IDs
- `src/lib/tiendanube-service.ts` — marcar limitación, solo inferencia por storefront

**Entregable**: Dashboard muestra "De tus 120 ventas, 45 tienen fbclid, 30 tienen gclid, 8 tienen ambos, 37 no tienen click ID".

---

### Fase 2: Meta Conversions API — Envío Server-Side

**Objetivo**: Enviar conversiones Purchase a Meta vía CAPI con datos enriquecidos.
**Impacto**: Meta recibe 30-50% más conversiones → mejor optimización de campañas.
**Esfuerzo**: Medio — nuevo servicio + cron.

**Cambios técnicos:**

1. **Nuevo servicio**: `src/lib/meta-capi-service.ts`
   ```typescript
   export class MetaCapiService {
     // Envía batch de Purchase events a Meta CAPI
     async sendPurchaseEvents(
       pixelId: string,
       accessToken: string,
       events: CAPIEvent[]
     ): Promise<CAPIResponse>

     // Construye el payload con hashing correcto
     private buildEventPayload(order: OrderClickId): CAPIEventData

     // SHA256 hash para PII (email, phone)
     private hashPII(value: string): string

     // Construye _fbc desde fbclid
     private buildFbc(fbclid: string, timestamp: number): string
   }
   ```

2. **Tipos**: `src/types/capi.ts`
   ```typescript
   interface CAPIEvent {
     event_name: 'Purchase';
     event_time: number;
     event_id: string;          // order ID (dedup con pixel)
     action_source: 'website';
     user_data: {
       em?: string[];           // SHA256(email)
       ph?: string[];           // SHA256(phone)
       fbc?: string;            // fb.1.{ts}.{fbclid} — NO hasheado
       fbp?: string;            // fb.1.{ts}.{random} — NO hasheado
       client_ip_address?: string;
       client_user_agent?: string;
       fn?: string;             // SHA256(first_name)
       ln?: string;             // SHA256(last_name)
       ct?: string;             // SHA256(city)
       zp?: string;             // SHA256(zip)
       country?: string;        // SHA256(country_code)
     };
     custom_data: {
       currency: string;
       value: number;
       content_ids: string[];
       content_type: 'product';
       num_items: number;
       order_id: string;
     };
   }
   ```

3. **Client config**: Nuevos campos en `ClientConfig`:
   ```typescript
   metaPixelId?: string;        // Pixel ID para CAPI (distinto del ad account)
   capiEnabled?: boolean;       // Toggle on/off
   googleConversionActionId?: string;  // Para fase 3
   googleOfflineEnabled?: boolean;
   ```

4. **Cron**: `/api/cron/send-capi` — Corre después de `sync-ecommerce`
   - Lee `channel_snapshots` del día con `orderClickIds`
   - Filtra orders con `fbclid` (tienen match para Meta)
   - Envía batch a Meta CAPI
   - Loguea resultado en `system_events`

5. **Deduplicación**: Usar `order.id` como `event_id` (el pixel nativo de Shopify
   usa el mismo order ID → Meta deduplica automáticamente).

**Config necesaria en .env.local:**
```env
# Ya existente
META_ACCESS_TOKEN=...
# Nuevo (por cliente, en Firestore)
# metaPixelId en ClientConfig
```

**Archivos nuevos:**
- `src/lib/meta-capi-service.ts`
- `src/types/capi.ts`
- `src/app/api/cron/send-capi/route.ts`

**Archivos a modificar:**
- `src/types/client.ts` — agregar campos CAPI
- `src/components/admin/ClientForm.tsx` — UI para pixelId y toggles
- `firestore.indexes.json` — si se necesitan queries nuevas

---

### Fase 3: Google Ads Offline Conversions

**Objetivo**: Enviar conversiones con gclid a Google Ads vía API.
**Impacto**: Google recibe conversiones que su tag perdió.
**Esfuerzo**: Medio — similar a Fase 2 pero con Google Ads API.

**Cambios técnicos:**

1. **Extensión de** `src/lib/google-ads-service.ts`:
   ```typescript
   // Nuevo método
   async uploadOfflineConversions(
     customerId: string,
     conversionActionId: string,
     conversions: OfflineConversion[]
   ): Promise<UploadResult>
   ```

2. **Tipo de conversión:**
   ```typescript
   interface OfflineConversion {
     gclid: string;
     conversion_action: string;
     conversion_date_time: string;  // "YYYY-MM-DD HH:mm:ss+HH:mm"
     conversion_value: number;
     currency_code: string;
     order_id?: string;             // transaction_id para dedup
   }
   ```

3. **Cron**: Extender `/api/cron/send-capi` o crear `/api/cron/send-google-conversions`
   - Filtra orders con `gclid`
   - Batch upload vía `google-ads-api` package (ya instalado)
   - `gclid` válido hasta 63 días después del click

**Prerequisito**: El cliente debe crear una Conversion Action en Google Ads de tipo "Import" → "Other data sources". El ID de esa action se guarda en `ClientConfig.googleConversionActionId`.

---

### Fase 4: Dashboard de Atribución Real (UI)

**Objetivo**: Visualizar la superposición real y la atribución corregida.
**Impacto**: El cliente ve la verdad — no la ficción que cada plataforma cuenta.

**Componentes UI:**

1. **Attribution Overlap Widget** — En cross-channel o en cada canal:
   ```
   ┌─────────────────────────────────────────┐
   │  Atribución Real (120 ventas totales)    │
   │                                          │
   │  ████████████░░░░░░  Meta: 45 (37.5%)   │
   │  ██████░░░░░░░░░░░░  Google: 30 (25.0%) │
   │  ████░░░░░░░░░░░░░░  Email: 8 (6.7%)    │
   │  ████████████████░░  Orgánico: 37 (30.8%)|
   │                                          │
   │  ⚠️ Superposición: 8 ventas con fbclid   │
   │     Y gclid (contadas por ambos)         │
   │                                          │
   │  Meta reporta: 65 ventas                 │
   │  Google reporta: 48 ventas               │
   │  Suma plataformas: 113                   │
   │  Realidad ecommerce: 120                 │
   │  Gap: +7 no atribuidas                   │
   └─────────────────────────────────────────┘
   ```

2. **CAPI Status Widget** — En admin o en cada canal:
   ```
   ┌─────────────────────────────────────────┐
   │  Server-Side Tracking Status             │
   │                                          │
   │  Meta CAPI:   ✅ Activo — 45 events ayer │
   │  Google OCI:  ✅ Activo — 30 events ayer │
   │  Match Rate:  72% (orders con click ID)  │
   │  EMQ Score:   8/10                       │
   └─────────────────────────────────────────┘
   ```

3. **Integración con AI Analyst**: Agregar datos de atribución real al contexto XML del `cross_channel` analyst para que Claude pueda analizar discrepancias y recomendar acciones.

---

### Fase 5: Mejora de Match Rate (Opcional/Futuro)

Para subir del ~60-70% match rate inicial:

1. **Shopify Web Pixels API**: Custom pixel que captura `fbclid`/`gclid` del browser en cada visita, no solo cuando hay order. Requiere Shopify App Extension.

2. **Enhanced Conversions (Google)**: Si no hay `gclid`, enviar email hasheado como fallback. Google matchea por cuenta de Google del usuario.

3. **Advanced Matching (Meta)**: Enviar más PII hasheado (nombre, ciudad, zip) para mejorar el match rate cuando no hay `fbc`.

4. **Script JS propio**: Para Tienda Nube y WooCommerce donde no hay equivalente a Web Pixels API. Un snippet que el cliente pega en su theme.

---

## 5. Orden de Ejecución Recomendado

```
Fase 1: Click ID Extraction        ← Semana 1
  └─ Parseo de fbclid/gclid de orders existentes
  └─ Almacenamiento en channel_snapshots
  └─ Métricas de match rate

Fase 2: Meta CAPI                   ← Semana 2-3
  └─ MetaCapiService
  └─ Cron send-capi
  └─ Config UI en ClientForm
  └─ Dedup por order_id

Fase 3: Google Offline Conversions  ← Semana 3-4
  └─ Extensión google-ads-service
  └─ Upload con gclid + transaction_id
  └─ Config UI

Fase 4: Dashboard UI                ← Semana 4-5
  └─ Attribution overlap widget
  └─ CAPI status widget
  └─ AI Analyst cross_channel enrichment

Fase 5: Match Rate Improvement      ← Futuro
  └─ Shopify Web Pixels API
  └─ Enhanced Conversions / Advanced Matching
  └─ Script JS para TN/WC
```

---

## 6. Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Meta CAPI rechaza eventos por mala calidad | Validar payload contra schema antes de enviar. Monitorear EMQ en Events Manager. |
| Duplicación de conversiones en Meta | Usar `order_id` como `event_id` — mismo que usa el pixel nativo de Shopify. |
| gclid expirado (>63 días) | Filtrar orders donde `created_at - click_time > 63d`. En la práctica, el 99% convierte en <30d. |
| Shopify no tiene `landing_site` en todos los orders | Aceptar match rate parcial (~60-70%). Mejorar en Fase 5 con Web Pixels API. |
| Rate limits de Meta CAPI | Meta permite 1000 events/call, no tiene rate limit agresivo en CAPI (distinto de Marketing API). |
| Token de Meta expira | Usar System User Token (no expira) en vez de User Token. Ya lo tenemos con META_ACCESS_TOKEN. |
| El cliente no tiene Pixel ID | Agregarlo como campo requerido en ClientConfig cuando `capiEnabled: true`. |

---

## 7. Métricas de Éxito

| Métrica | Baseline (sin CAPI) | Target (con CAPI) |
|---------|---------------------|-------------------|
| Conversiones reportadas por Meta vs ecommerce real | 50-70% match | 85-95% match |
| Conversiones reportadas por Google vs ecommerce real | 60-80% match | 85-95% match |
| Event Match Quality (Meta EMQ) | 4-6/10 (pixel nativo) | 7-9/10 (CAPI con PII) |
| Orders con click ID identificado | 0% (no parseamos) | 60-75% |
| Superposición visible en dashboard | No medido | Medido y visualizado |
