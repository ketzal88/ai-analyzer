# 🚀 Setup y Deploy de Índices Firestore

## Paso 1: Instalar Firebase CLI

```bash
npm install -g firebase-tools
```

**Verificar instalación:**
```bash
firebase --version
```

---

## Paso 2: Login en Firebase

```bash
firebase login
```

Esto abrirá tu navegador para autenticarte con Google.

---

## Paso 3: Verificar Proyecto

```bash
firebase projects:list
```

Deberías ver `ai-analyzer-dcb94` en la lista.

---

## Paso 4: Deploy de Índices

```bash
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

## Paso 5: Verificar Estado

Ve a Firebase Console para ver el progreso:
```
https://console.firebase.google.com/u/1/project/ai-analyzer-dcb94/firestore/indexes
```

**Estados:**
- 🟡 CREATING → Espera (5-30 min)
- ✅ READY → Listo para usar

---

## 🔄 Comandos Útiles

### Ver índices actuales
```bash
firebase firestore:indexes --project ai-analyzer-dcb94
```

### Ver reglas de Firestore
```bash
firebase firestore:rules --project ai-analyzer-dcb94
```

### Deploy todo (índices + rules)
```bash
firebase deploy --only firestore --project ai-analyzer-dcb94
```

---

## ✅ Checklist

- [ ] Firebase CLI instalado
- [ ] Login exitoso
- [ ] Proyecto verificado
- [ ] `firestore.indexes.json` en root
- [ ] Deploy ejecutado
- [ ] Índices en estado READY

---

**Siguiente paso:** Una vez que los índices estén READY, podés ejecutar el sync de creativos y probar los endpoints.
