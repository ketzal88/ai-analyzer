# 🔗 Links Directos para Crear Índices en Firestore

## 📋 Instrucciones

1. **Reemplaza `YOUR_PROJECT_ID`** con tu Firebase Project ID en cada link
2. Haz clic en cada link
3. Revisa que los campos estén correctos
4. Haz clic en "Create Index"
5. Espera a que el estado sea "Enabled" (puede tardar varios minutos)

---

## 🔍 ¿Cómo encontrar tu Project ID?

Opción 1: En tu `.env.local`:
```bash
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu-proyecto-aqui
```

Opción 2: En Firebase Console:
- Ve a: https://console.firebase.google.com/
- Selecciona tu proyecto
- Ve a Project Settings (⚙️)
- Copia el "Project ID"

---

## 📊 Índices Requeridos

### 1. meta_creatives: clientId + lastSeenActiveAt (DESC)
**Uso:** Query base para creativos activos recientes

🔗 **Link directo:**
```
https://console.firebase.google.com/u/1/project/ai-analyzer-dcb94/firestore/indexes?create_composite=Cl9wcm9qZWN0cy9ZT1VSX1BST0pFQ1RfSUQvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL21ldGFfY3JlYXRpdmVzL2luZGV4ZXMvXxABGg4KCmNsaWVudElkEAEaDgoKbGFzdFNlZW5BY3RpdmVBdBACGgwKCF9fbmFtZV9fEAI
```

**Campos:**
- `clientId` (Ascending)
- `lastSeenActiveAt` (Descending)

---

### 2. meta_creatives: clientId + campaign.id + lastSeenActiveAt (DESC)
**Uso:** Filtrar creativos por campaña específica

🔗 **Link directo:**
```
https://console.firebase.google.com/u/1/project/ai-analyzer-dcb94/firestore/indexes?create_composite=Cl9wcm9qZWN0cy9ZT1VSX1BST0pFQ1RfSUQvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL21ldGFfY3JlYXRpdmVzL2luZGV4ZXMvXxABGg4KCmNsaWVudElkEAEaEQoNY2FtcGFpZ24uaWQQARoOCgpsYXN0U2VlbkFjdGl2ZUF0EAIaDAoIX19uYW1lX18QAg
```

**Campos:**
- `clientId` (Ascending)
- `campaign.id` (Ascending)
- `lastSeenActiveAt` (Descending)

---

### 3. meta_creatives: clientId + creative.format + lastSeenActiveAt (DESC)
**Uso:** Filtrar creativos por formato (IMAGE, VIDEO, CAROUSEL, CATALOG)

🔗 **Link directo:**
```
https://console.firebase.google.com/u/1/project/ai-analyzer-dcb94/firestore/indexes?create_composite=Cl9wcm9qZWN0cy9ZT1VSX1BST0pFQ1RfSUQvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL21ldGFfY3JlYXRpdmVzL2luZGV4ZXMvXxABGg4KCmNsaWVudElkEAEaEgoOY3JlYXRpdmUuZm9ybWF0EAEaDgoKbGFzdFNlZW5BY3RpdmVBdBACGgwKCF9fbmFtZV9fEAI
```

**Campos:**
- `clientId` (Ascending)
- `creative.format` (Ascending)
- `lastSeenActiveAt` (Descending)

---

### 4. meta_creatives: clientId + status + lastSeenActiveAt (DESC)
**Uso:** Filtrar creativos por status (ACTIVE, PAUSED, etc.)

🔗 **Link directo:**
```
https://console.firebase.google.com/u/1/project/ai-analyzer-dcb94/firestore/indexes?create_composite=Cl9wcm9qZWN0cy9ZT1VSX1BST0pFQ1RfSUQvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL21ldGFfY3JlYXRpdmVzL2luZGV4ZXMvXxABGg4KCmNsaWVudElkEAEaDQoJc3RhdHVzEAEaDgoKbGFzdFNlZW5BY3RpdmVBdBACGgwKCF9fbmFtZV9fEAI
```

**Campos:**
- `clientId` (Ascending)
- `status` (Ascending)
- `lastSeenActiveAt` (Descending)

---

### 5. insights_daily: clientId + date (ASC)
**Uso:** Query de insights por rango de fechas (AG-42)

🔗 **Link directo:**
```
https://console.firebase.google.com/u/1/project/ai-analyzer-dcb94/firestore/indexes?create_composite=Cl9wcm9qZWN0cy9ZT1VSX1BST0pFQ1RfSUQvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL2luc2lnaHRzX2RhaWx5L2luZGV4ZXMvXxABGg4KCmNsaWVudElkEAEaCwoHZGF0ZRABGgwKCF9fbmFtZV9fEAI
```

**Campos:**
- `clientId` (Ascending)
- `date` (Ascending)

---

## 🛠️ Método Alternativo: Firebase CLI

Si prefieres usar la línea de comandos:

```bash
# 1. meta_creatives: clientId + lastSeenActiveAt
firebase firestore:indexes:create \
  --project YOUR_PROJECT_ID \
  --collection-group meta_creatives \
  --field clientId:asc \
  --field lastSeenActiveAt:desc

# 2. meta_creatives: clientId + campaign.id + lastSeenActiveAt
firebase firestore:indexes:create \
  --project YOUR_PROJECT_ID \
  --collection-group meta_creatives \
  --field clientId:asc \
  --field campaign.id:asc \
  --field lastSeenActiveAt:desc

# 3. meta_creatives: clientId + creative.format + lastSeenActiveAt
firebase firestore:indexes:create \
  --project YOUR_PROJECT_ID \
  --collection-group meta_creatives \
  --field clientId:asc \
  --field creative.format:asc \
  --field lastSeenActiveAt:desc

# 4. meta_creatives: clientId + status + lastSeenActiveAt
firebase firestore:indexes:create \
  --project YOUR_PROJECT_ID \
  --collection-group meta_creatives \
  --field clientId:asc \
  --field status:asc \
  --field lastSeenActiveAt:desc

# 5. insights_daily: clientId + date
firebase firestore:indexes:create \
  --project YOUR_PROJECT_ID \
  --collection-group insights_daily \
  --field clientId:asc \
  --field date:asc
```

---

## ✅ Verificación

Después de crear los índices, verifica que estén activos:

1. Ve a: https://console.firebase.google.com/project/YOUR_PROJECT_ID/firestore/indexes
2. Busca los índices en la lista
3. Verifica que el estado sea **"Enabled"** (no "Building")
4. Si alguno está en "Building", espera unos minutos

---

## 🚨 Troubleshooting

### Error: "Index already exists"
✅ **Solución:** El índice ya está creado, puedes continuar.

### Error: "Invalid field path"
❌ **Causa:** El nombre del campo está mal escrito
✅ **Solución:** Verifica que los nombres coincidan exactamente con el schema

### Índice en estado "Building" por mucho tiempo
⏳ **Normal:** Puede tardar 5-30 minutos si ya tienes datos
✅ **Solución:** Espera pacientemente, no lo canceles

### Error al hacer query después de crear índice
⏳ **Causa:** El índice aún no está "Enabled"
✅ **Solución:** Espera a que el estado cambie de "Building" a "Enabled"

---

## 📝 Notas Importantes

1. **Reemplaza `YOUR_PROJECT_ID`** en TODOS los links antes de usarlos
2. Los índices se crean **asíncronamente** - pueden tardar varios minutos
3. No necesitas reiniciar tu aplicación después de crear índices
4. Los índices consumen espacio de almacenamiento (~10-20% del tamaño de la colección)
5. Puedes eliminar índices que no uses desde la consola

---

## 🎯 Orden Recomendado de Creación

1. ✅ `insights_daily: clientId + date` (crítico para AG-42)
2. ✅ `meta_creatives: clientId + lastSeenActiveAt` (crítico para AG-41 y AG-42)
3. ⚪ `meta_creatives: clientId + campaign.id + lastSeenActiveAt` (opcional, para filtros)
4. ⚪ `meta_creatives: clientId + creative.format + lastSeenActiveAt` (opcional, para filtros)
5. ⚪ `meta_creatives: clientId + status + lastSeenActiveAt` (opcional, para filtros)

**Mínimo requerido:** Índices 1 y 2  
**Recomendado:** Todos los índices para funcionalidad completa

---

**Última actualización:** 2026-02-06  
**Misiones:** AG-41 + AG-42
