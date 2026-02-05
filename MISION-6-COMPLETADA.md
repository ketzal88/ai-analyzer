# 📊 MISIÓN 6 — Meta Graph Sync (Campaign Daily)

## ✅ Completado

Se ha implementado el motor de sincronización para extraer métricas diarias a nivel de campaña desde Meta Graph API y almacenarlas de forma normalizada en Firestore.

---

## 🚀 Componentes Entregados

### 1. **Sync API Endpoint** (`src/app/api/sync/route.ts`)
Endpoint POST que maneja el ciclo de vida de la sincronización.

**Características:**
- ✅ **Carga de Configuración**: Lee `metaAdAccountId` dinámicamente desde Firestore (`accounts/{accountId}`).
- ✅ **Meta Graph Integration**: Llama al endpoint `/insights` con `level=campaign` y `time_increment=1`.
- ✅ **Manejo de Errores**: Implementa `fetchWithRetry` con backoff exponencial.
- ✅ **Normalización**: Transforma los datos de Meta (strings y arrays) a tipos numéricos limpios.
- ✅ **Métricas Derivadas**: Calcula CTR, CPC, ROAS y CPA antes de guardar.
- ✅ **Upsert Eficiente**: Usa `Firestore Batch` para guardar datos optimizados.
- ✅ **Trazabilidad**: Registra cada corrida en la colección `sync_runs`.

---

## 📁 Esquema de Datos Firestore

### Colección: `insights_daily`
Docs id: `${accountId}_${campaignId}_${date}`

```typescript
{
  accountId: string;
  campaignId: string;
  campaignName: string;
  date: string; // YYYY-MM-DD
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  purchaseValue: number;
  ctr: number;
  cpc: number;
  roas: number;
  cpa: number;
  updatedAt: string;
}
```

### Colección: `sync_runs`
Registra el historial de sincronizaciones.

```typescript
{
  accountId: string;
  status: "running" | "completed" | "failed";
  range: string;
  campaignsProcessed: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
}
```

---

## 🛠️ Configuración Requerida

### 1. Meta Graph API
Necesitas un **System User Token** con permisos `ads_read`.

### 2. Variables de Entorno (`.env.local`)
Asegúrate de agregar lo siguiente:

```env
META_ACCESS_TOKEN=tu_token_de_meta_aqui
```

---

## 🧪 Testing (CURL)

### Ejecutar Sincronización (Últimos 14 días)
```bash
curl -X POST "http://localhost:3000/api/sync?accountId=YOUR_FIRESTORE_ID&range=last_14d" \
     -H "Cookie: session=YOUR_SESSION_COOKIE"
```

### Ejecutar Sincronización (Últimos 7 días)
```bash
curl -X POST "http://localhost:3000/api/sync?accountId=YOUR_FIRESTORE_ID&range=last_7d" \
     -H "Cookie: session=YOUR_SESSION_COOKIE"
```

---

## 📝 Logs de Ejemplo (Servidor)
```text
[POST] /api/sync?accountId=acc_123&range=last_14d
Starting sync for account acc_123 (Meta ID: act_XXXXXXXX). Range: last_14d
Meta API Call: Level=campaign, fields=spend,purchases,...
Success: Processed 142 daily insights for 12 campaigns.
Sync run completed: sync_abc123.
```

---

## 🔐 Seguridad y Guardrails
- ✅ **Server-Only**: El token de Meta nunca viaja al cliente.
- ✅ **Ownership Check**: Solo el dueño de la cuenta puede disparar la sincronización.
- ✅ **Rate Limiting Ready**: El sistema espera y reintenta automáticamente si Meta devuelve un error 429.
- ✅ **Data Minimalism**: No se guardan los JSON gigantes de Meta, solo las métricas necesarias para el diagnóstico.

---

**Siguiente paso:** Inyectar estos datos en el Dashboard para mostrar gráficas reales de performance. 📈
