# 🔥 Guía Paso a Paso: Crear Índices en Firestore

## 📍 Link Base para Crear Índices

**Ve directamente a la página de índices:**
```
https://console.firebase.google.com/u/1/project/ai-analyzer-dcb94/firestore/indexes
```

---

## 🔴 ÍNDICE CRÍTICO 1: insights_daily

### Paso a Paso:

1. **Haz clic en el botón "Create Index"** (arriba a la derecha)

2. **Configura los siguientes campos:**
   - **Collection ID:** `insights_daily`
   - **Query scope:** Collection
   
3. **Agrega los campos en este orden:**
   
   **Campo 1:**
   - Field path: `clientId`
   - Order: `Ascending`
   
   **Campo 2:**
   - Field path: `date`
   - Order: `Ascending`

4. **Haz clic en "Create"**

5. **Espera** a que el estado cambie de "Building" → "Enabled" (5-30 minutos)

---

## 🔴 ÍNDICE CRÍTICO 2: meta_creatives (base)

### Paso a Paso:

1. **Haz clic en "Create Index"** nuevamente

2. **Configura:**
   - **Collection ID:** `meta_creatives`
   - **Query scope:** Collection
   
3. **Agrega los campos:**
   
   **Campo 1:**
   - Field path: `clientId`
   - Order: `Ascending`
   
   **Campo 2:**
   - Field path: `lastSeenActiveAt`
   - Order: `Descending` ⚠️ (importante: DESCENDING)

4. **Haz clic en "Create"**

---

## 🟡 ÍNDICE OPCIONAL 3: meta_creatives + campaign.id

### Paso a Paso:

1. **Haz clic en "Create Index"**

2. **Configura:**
   - **Collection ID:** `meta_creatives`
   - **Query scope:** Collection
   
3. **Agrega los campos:**
   
   **Campo 1:**
   - Field path: `clientId`
   - Order: `Ascending`
   
   **Campo 2:**
   - Field path: `campaign.id`
   - Order: `Ascending`
   
   **Campo 3:**
   - Field path: `lastSeenActiveAt`
   - Order: `Descending`

4. **Haz clic en "Create"**

---

## 🟡 ÍNDICE OPCIONAL 4: meta_creatives + creative.format

### Paso a Paso:

1. **Haz clic en "Create Index"**

2. **Configura:**
   - **Collection ID:** `meta_creatives`
   - **Query scope:** Collection
   
3. **Agrega los campos:**
   
   **Campo 1:**
   - Field path: `clientId`
   - Order: `Ascending`
   
   **Campo 2:**
   - Field path: `creative.format`
   - Order: `Ascending`
   
   **Campo 3:**
   - Field path: `lastSeenActiveAt`
   - Order: `Descending`

4. **Haz clic en "Create"**

---

## 🟡 ÍNDICE OPCIONAL 5: meta_creatives + status

### Paso a Paso:

1. **Haz clic en "Create Index"**

2. **Configura:**
   - **Collection ID:** `meta_creatives`
   - **Query scope:** Collection
   
3. **Agrega los campos:**
   
   **Campo 1:**
   - Field path: `clientId`
   - Order: `Ascending`
   
   **Campo 2:**
   - Field path: `status`
   - Order: `Ascending`
   
   **Campo 3:**
   - Field path: `lastSeenActiveAt`
   - Order: `Descending`

4. **Haz clic en "Create"**

---

## ✅ Verificación

Después de crear cada índice:

1. **Verifica el estado** en la lista de índices
2. **Espera** a que diga "Enabled" (no "Building")
3. **No cierres** la pestaña mientras está en "Building"

### Estados Posibles:
- 🟡 **Building** - Creándose (espera)
- ✅ **Enabled** - Listo para usar
- ❌ **Error** - Algo salió mal (revisa los campos)

---

## 🎯 Resumen de Índices a Crear

| # | Colección | Campos | Prioridad |
|---|-----------|--------|-----------|
| 1 | `insights_daily` | `clientId` ↑, `date` ↑ | 🔴 CRÍTICO |
| 2 | `meta_creatives` | `clientId` ↑, `lastSeenActiveAt` ↓ | 🔴 CRÍTICO |
| 3 | `meta_creatives` | `clientId` ↑, `campaign.id` ↑, `lastSeenActiveAt` ↓ | 🟡 Opcional |
| 4 | `meta_creatives` | `clientId` ↑, `creative.format` ↑, `lastSeenActiveAt` ↓ | 🟡 Opcional |
| 5 | `meta_creatives` | `clientId` ↑, `status` ↑, `lastSeenActiveAt` ↓ | 🟡 Opcional |

**Leyenda:**
- ↑ = Ascending
- ↓ = Descending

---

## 💡 Tips Importantes

1. **Orden de campos importa:** Respeta el orden exacto mostrado arriba
2. **Ascending vs Descending:** Presta atención, `lastSeenActiveAt` siempre es Descending
3. **Puntos en field paths:** Escribe exactamente `campaign.id`, `creative.format` (con el punto)
4. **Tiempo de creación:** Puede tardar 5-30 minutos dependiendo de cuántos datos tengas
5. **No reiniciar app:** No necesitas reiniciar tu aplicación después de crear índices

---

## 🚨 Troubleshooting

### "Index already exists"
✅ Perfecto, ya está creado. Continúa con el siguiente.

### "Invalid field path"
❌ Revisa que escribiste exactamente el nombre del campo (con puntos si aplica)

### Índice en "Building" por más de 1 hora
⏳ Normal si tienes muchos datos. Déjalo trabajar, no lo canceles.

### Error al hacer query después de crear
⏳ El índice aún no está "Enabled". Espera unos minutos más.

---

## 📞 Si Necesitas Ayuda

Si algún índice falla o no estás seguro de algo:

1. Toma una captura de pantalla del error
2. Verifica que los nombres de campos coincidan exactamente
3. Asegúrate de que "Query scope" esté en "Collection" (no "Collection group")

---

**Link directo a tu consola de índices:**
https://console.firebase.google.com/u/1/project/ai-analyzer-dcb94/firestore/indexes

**Última actualización:** 2026-02-06
