# AG-41: Meta Creative Library - Implementation Complete ✅

## 📋 Resumen

Sistema completo de sincronización y consulta de creativos de Meta Ads, diseñado para:
- **Minimizar costos** de API (no llamadas repetidas, no descarga de media)
- **Normalizar metadata** sin almacenar payloads gigantes
- **Permitir análisis** de creativos por formato, campaña, y rendimiento
- **Preparar base** para clustering IA y auditorías

---

## 🏗️ Arquitectura

### Colección Firestore: `meta_creatives`

**DocID:** `${clientId}__${adId}` (estable, idempotente)

**Schema normalizado:**
```typescript
{
  clientId, metaAccountId, status, effectiveStatus,
  lastSeenActiveAt, firstSeenAt, updatedAt,
  
  campaign: { id, name, objective, buyingType },
  adset: { id, name, optimizationGoal, billingEvent, promotedObject },
  ad: { id, name },
  
  creative: {
    id, format, isDynamicProductAd, hasCatalog,
    primaryText, headline, description, ctaType, destinationUrl,
    pageId, instagramActorId,
    
    assets: {
      videoId, imageHash,
      carousel: { items: [...] },
      catalog: { catalogId, productSetId, templateName }
    }
  },
  
  labels: { conceptTag, funnelStage, angle, avatar },
  fingerprint  // sha256 para deduplicación
}
```

---

## 🔧 Componentes Implementados

### 1. **Types** (`src/types/meta-creative.ts`)
- `MetaCreativeDoc`: Schema completo
- `CreativeFormat`: IMAGE | VIDEO | CAROUSEL | CATALOG
- `CreativeSyncMetrics`: Métricas de sync
- `CreativeLibraryFilters`: Filtros de query

### 2. **Service** (`src/lib/meta-creative-service.ts`)

#### `fetchMetaCreatives(adAccountId, accessToken)`
- Fetch ads activos/pausados desde Meta Graph API
- Paginación automática con límite de seguridad (2000 ads)
- Fields mínimos: campaign, adset, creative (sin raw gigante)

#### `normalizeMetaAdToCreativeDoc(ad, clientId, metaAccountId)`
- Parsea `object_story_spec` y `asset_feed_spec`
- Detecta formato automáticamente
- Extrae copy (primaryText, headline, description, CTA)
- Extrae assets (videoId, imageHash, carousel items, catalog info)
- Genera fingerprint SHA256 para deduplicación

#### `upsertCreativeDocs(docs)`
- Upsert idempotente a Firestore
- Preserva `firstSeenAt` en updates
- Actualiza `lastSeenActiveAt` solo si ACTIVE
- Skip si fingerprint no cambió (ahorro de writes)
- Batching automático (500 docs/batch)

#### `syncMetaCreatives(clientId, metaAdAccountId)`
- Orquesta: Fetch → Normalize → Upsert
- Retorna métricas: fetched, created, updated, skipped, errors

### 3. **Endpoints**

#### `POST /api/cron/sync-creatives?clientId=xxx`
- **Protección:** Header `x-cron-secret`
- **Uso:** Cron diario (no UI)
- **Output:** Métricas de sync + log en `creative_sync_runs`

#### `GET /api/creative/library?clientId=xxx&campaignId=xxx&format=VIDEO&status=ACTIVE&activeSince=2026-01-01&limit=100`
- **Protección:** Session cookie
- **Filtros:** clientId, campaignId, format, status, activeSince
- **Default:** Solo creativos activos en últimos 14 días
- **Output:** Array de `MetaCreativeDoc` + metadata de filtros

---

## 📊 Índices Firestore Requeridos

Ver documentación completa en: [`docs/FIRESTORE_INDEXES.md`](./FIRESTORE_INDEXES.md)

**Índices críticos:**
1. `clientId ↑ + lastSeenActiveAt ↓`
2. `clientId ↑ + campaign.id ↑ + lastSeenActiveAt ↓`
3. `clientId ↑ + creative.format ↑ + lastSeenActiveAt ↓`
4. `clientId ↑ + status ↑ + lastSeenActiveAt ↓`

**Crear con:**
```bash
gcloud firestore indexes composite create \
  --collection-group=meta_creatives \
  --field-config=field-path=clientId,order=ascending \
  --field-config=field-path=lastSeenActiveAt,order=descending
```

---

## 🚀 Uso

### 1. Configurar Cron Job

**Vercel Cron** (vercel.json):
```json
{
  "crons": [{
    "path": "/api/cron/sync-creatives?clientId=CLIENT_ID_HERE",
    "schedule": "0 2 * * *"
  }]
}
```

**Manual trigger:**
```bash
curl -X POST "https://your-domain.com/api/cron/sync-creatives?clientId=xxx" \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

### 2. Consultar Librería (Frontend)

```typescript
const response = await fetch(
  `/api/creative/library?clientId=${clientId}&format=VIDEO&limit=50`
);
const { creatives, count } = await response.json();

// creatives = MetaCreativeDoc[]
creatives.forEach(c => {
  console.log(c.creative.headline, c.creative.format, c.campaign.name);
});
```

### 3. Filtros Avanzados

```typescript
// Solo videos de campaña específica, activos en últimos 7 días
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

const url = new URLSearchParams({
  clientId: 'client_123',
  campaignId: '123456789',
  format: 'VIDEO',
  status: 'ACTIVE',
  activeSince: sevenDaysAgo.toISOString(),
  limit: '100'
});

fetch(`/api/creative/library?${url}`);
```

---

## 💰 Guardrails de Costo

1. **Sync solo por cron** (1x/día), nunca desde UI
2. **Hard limit:** 2000 ads por sync (evita loops infinitos)
3. **No descarga media:** Solo refs (videoId, imageHash)
4. **Fingerprint dedup:** Skip writes si creative no cambió
5. **Batching:** 500 docs/batch para optimizar Firestore writes
6. **Paginación controlada:** Logs de warning si se alcanza límite

---

## 📈 Métricas de Sync

Cada sync genera un documento en `creative_sync_runs`:

```typescript
{
  clientId,
  ok: boolean,
  totalAdsFetched: number,
  docsCreated: number,
  docsUpdated: number,
  docsSkipped: number,
  errors: string[],
  syncedAt: ISO timestamp,
  triggeredBy: "cron" | "manual"
}
```

---

## 🔮 Próximos Pasos (Futuro)

1. **KPIs por creativo:** Join con `insights_daily` por adId
2. **Clustering IA:** Agrupar creativos similares por fingerprint/copy
3. **Auditoría automática:** Detectar creativos duplicados, fatiga, best performers
4. **Labels manuales:** UI para etiquetar conceptTag, funnelStage, angle, avatar
5. **Performance tracking:** Histórico de fingerprint changes + ROAS evolution

---

## ✅ Checklist de Deployment

- [ ] Crear índices Firestore (ver `docs/FIRESTORE_INDEXES.md`)
- [ ] Configurar `CRON_SECRET` en variables de entorno
- [ ] Configurar `META_ACCESS_TOKEN` (ya existente)
- [ ] Configurar cron job en Vercel/hosting
- [ ] Ejecutar primer sync manual para validar
- [ ] Verificar logs en `creative_sync_runs`
- [ ] Probar endpoint `/api/creative/library` desde frontend

---

## 🐛 Troubleshooting

### Error: "Missing Firestore index"
**Solución:** Crear índices compuestos (ver `docs/FIRESTORE_INDEXES.md`)

### Error: "META_ACCESS_TOKEN not configured"
**Solución:** Agregar variable de entorno en `.env.local` y hosting

### Sync retorna 0 ads
**Posibles causas:**
- Ad account ID incorrecto
- Token expirado o sin permisos
- No hay ads activos/pausados en la cuenta

### Fingerprint no detecta cambios
**Causa:** Solo se consideran cambios en: format, copy, CTA, assets
**Solución esperada:** Cambios en budget/targeting no generan nuevo fingerprint

---

## 📝 Notas Técnicas

- **Idempotencia:** Múltiples syncs del mismo estado no duplican docs
- **Preservación de datos:** `firstSeenAt` nunca se sobreescribe
- **Status tracking:** `lastSeenActiveAt` solo se actualiza si ad está ACTIVE
- **Formato detection:** Heurística basada en `asset_feed_spec` y `object_story_spec`
- **Carousel limit:** Max 10 items por carousel (evita payloads gigantes)

---

**Implementado por:** Antigravity AI  
**Misión:** AG-41  
**Fecha:** 2026-02-06  
**Status:** ✅ COMPLETE
