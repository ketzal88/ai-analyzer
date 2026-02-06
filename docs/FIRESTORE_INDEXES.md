# 🔥 Firestore Indexes - Infrastructure as Code

## ❌ Problema con Links de Consola

Los links `create_composite` de Firebase Console **no son confiables**:
- Formato interno de Google, no documentado
- Cambia entre versiones
- No funciona consistentemente

## ✅ Solución Real: Firebase CLI + firestore.indexes.json

### Por Qué Este Approach

1. **Reproducible:** Mismo resultado en cualquier entorno
2. **Versionable:** Índices en git, trackeable
3. **Automatizable:** CI/CD puede deployar
4. **Verificable:** `firebase deploy` valida antes de aplicar

---

## 🚀 Deploy de Índices

### Prerequisitos

```bash
# Instalar Firebase CLI (si no lo tenés)
npm install -g firebase-tools

# Login
firebase login

# Verificar proyecto
firebase projects:list
```

### Deploy

```bash
# Deploy SOLO índices (no toca rules, functions, hosting)
firebase deploy --only firestore:indexes --project ai-analyzer-dcb94
```

**Output esperado:**
```
=== Deploying to 'ai-analyzer-dcb94'...

i  firestore: reading indexes from firestore.indexes.json...
✔  firestore: deployed indexes in firestore.indexes.json successfully

✔  Deploy complete!
```

---

## 📊 Índices Definidos

### 1. insights_daily: clientId + date
**Por qué:** AG-42 necesita traer insights de un rango de fechas para calcular KPIs
**Query que lo dispara:**
```typescript
db.collection("insights_daily")
  .where("clientId", "==", clientId)
  .where("date", ">=", startDate)
  .where("date", "<=", endDate)
```
**Sin índice:** Error `FAILED_PRECONDITION: The query requires an index`

---

### 2. meta_creatives: clientId + lastSeenActiveAt (DESC)
**Por qué:** AG-41 y AG-42 necesitan creativos activos recientes ordenados
**Query que lo dispara:**
```typescript
db.collection("meta_creatives")
  .where("clientId", "==", clientId)
  .where("lastSeenActiveAt", ">=", activeSince)
  .orderBy("lastSeenActiveAt", "desc")
```
**Sin índice:** Error `FAILED_PRECONDITION`
**Performance:** Sin índice, Firestore escanea TODA la colección

---

### 3. meta_creatives: clientId + campaign.id + lastSeenActiveAt (DESC)
**Por qué:** Filtrar creativos de una campaña específica
**Query que lo dispara:**
```typescript
db.collection("meta_creatives")
  .where("clientId", "==", clientId)
  .where("campaign.id", "==", campaignId)
  .orderBy("lastSeenActiveAt", "desc")
```
**Opcional:** Solo si usás filtro por campaña en UI

---

### 4. meta_creatives: clientId + creative.format + lastSeenActiveAt (DESC)
**Por qué:** Filtrar por tipo de creativo (IMAGE, VIDEO, CAROUSEL, CATALOG)
**Query que lo dispara:**
```typescript
db.collection("meta_creatives")
  .where("clientId", "==", clientId)
  .where("creative.format", "==", format)
  .orderBy("lastSeenActiveAt", "desc")
```
**Opcional:** Solo si usás filtro por formato en UI

---

### 5. meta_creatives: clientId + status + lastSeenActiveAt (DESC)
**Por qué:** Filtrar por status (ACTIVE, PAUSED)
**Query que lo dispara:**
```typescript
db.collection("meta_creatives")
  .where("clientId", "==", clientId)
  .where("status", "==", status)
  .orderBy("lastSeenActiveAt", "desc")
```
**Opcional:** Solo si usás filtro por status en UI

---

## 📈 Impacto en Performance y Costos

### Performance

**Sin índices:**
- Query escanea toda la colección
- Latencia: 2-10s (dependiendo de tamaño)
- Timeout en colecciones grandes (>10k docs)

**Con índices:**
- Query usa índice optimizado
- Latencia: 50-200ms
- Escalable a millones de docs

### Costos

**Escrituras:**
- Cada write a `meta_creatives` genera 1 write por índice
- Con 5 índices: 1 doc write = 6 writes totales (1 doc + 5 índices)
- **Costo adicional:** ~$0.18 por 100k writes (negligible)

**Almacenamiento:**
- Índices consumen ~10-20% del tamaño de la colección
- Para 10k creativos (~50MB): índices ~5-10MB
- **Costo adicional:** ~$0.001/mes (negligible)

**Lecturas:**
- Índices NO aumentan costo de reads
- De hecho, reducen reads al evitar full scans

---

## 🔍 Verificación

### Ver índices actuales
```bash
firebase firestore:indexes --project ai-analyzer-dcb94
```

### Ver estado de building
```bash
# En Firebase Console
https://console.firebase.google.com/u/1/project/ai-analyzer-dcb94/firestore/indexes
```

**Estados:**
- `CREATING` → Construyéndose (5-30 min)
- `READY` → Listo para usar
- `ERROR` → Falló (revisar config)

---

## 🚨 Troubleshooting

### Error: "Index already exists"
✅ **Normal.** Firebase detecta que el índice ya existe y lo skipea.

### Error: "Permission denied"
❌ **Causa:** No tenés permisos de Editor/Owner en el proyecto
✅ **Solución:** Pedí acceso o usá cuenta con permisos

### Error: "Invalid field path: campaign.id"
❌ **Causa:** Campo no existe en ningún documento
✅ **Solución:** Ejecutá sync de creativos primero para crear docs con ese campo

### Índice en CREATING por >1 hora
⏳ **Normal** si tenés muchos datos (>100k docs)
✅ **Solución:** Dejalo, no lo canceles. Puede tardar hasta 24h en casos extremos.

---

## 🔄 Workflow Recomendado

### Primera vez (setup)
```bash
# 1. Deploy índices
firebase deploy --only firestore:indexes --project ai-analyzer-dcb94

# 2. Esperar a que estén READY (verificar en consola)

# 3. Ejecutar sync de creativos
curl -X POST "http://localhost:3000/api/cron/sync-creatives?clientId=TEST_CLIENT" \
  -H "x-cron-secret: YOUR_SECRET"

# 4. Probar endpoint de selección
curl "http://localhost:3000/api/creative/active?clientId=TEST_CLIENT&range=last_14d"
```

### Cambios futuros
```bash
# 1. Editar firestore.indexes.json
# 2. Deploy
firebase deploy --only firestore:indexes --project ai-analyzer-dcb94
# 3. Commit a git
git add firestore.indexes.json
git commit -m "feat: add new index for X"
```

---

## 📝 Notas Técnicas

### queryScope: COLLECTION vs COLLECTION_GROUP

**COLLECTION:**
- Índice solo para queries en una colección específica
- Más eficiente
- Menor overhead

**COLLECTION_GROUP:**
- Índice para queries que cruzan subcollections
- Necesario solo si usás `.collectionGroup()`
- Más costoso

**Decisión:** Usamos `COLLECTION` porque no tenemos subcollections en `meta_creatives` ni `insights_daily`.

### Orden de Campos

El orden en `firestore.indexes.json` **debe coincidir** con el orden en la query:

```typescript
// Query
.where("clientId", "==", x)
.where("status", "==", y)
.orderBy("lastSeenActiveAt", "desc")

// Index (mismo orden)
["clientId", "status", "lastSeenActiveAt"]
```

Si invertís el orden, el índice **no se usa**.

### Campos con Puntos

`campaign.id` y `creative.format` son **field paths**, no nested objects en el índice.

Firestore los trata como:
```
campaign: { id: "123" }  →  fieldPath: "campaign.id"
```

---

## ✅ Checklist de Deploy

- [ ] Archivo `firestore.indexes.json` en root del proyecto
- [ ] Firebase CLI instalado (`firebase --version`)
- [ ] Logged in (`firebase login`)
- [ ] Proyecto correcto (`firebase use ai-analyzer-dcb94`)
- [ ] Deploy ejecutado (`firebase deploy --only firestore:indexes`)
- [ ] Índices en estado READY (verificar en consola)
- [ ] Queries funcionando sin errores

---

**Última actualización:** 2026-02-06  
**Proyecto:** ai-analyzer-dcb94  
**Misiones:** AG-41 + AG-42
