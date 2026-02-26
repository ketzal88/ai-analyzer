# Worker Brain V2 - Plan de Testing para Usuario Final

## 🎯 Objetivo
Validar que Worker Brain V2 funciona correctamente desde la **perspectiva del usuario** usando solo la **interfaz web** (sin llamadas API directas).

---

## 👤 TESTING DESDE LA UI

### 📍 FASE 1: Login y Dashboard (10 min)

**Objetivo:** Verificar acceso y vista principal

#### Paso 1.1: Login
```
1. Abrir: http://localhost:3000
2. Click en "Sign in with Google"
3. Seleccionar cuenta autorizada
4. ✅ Verificar: Redirige a /select-account o /dashboard
```

#### Paso 1.2: Selección de Cliente
```
1. Si estás en /select-account:
   - Ver lista de clientes disponibles
   - Seleccionar: "Almacen de Colchones" (cliente piloto)
   - ✅ Verificar: Redirige a /dashboard

2. Si ya estás en /dashboard:
   - ✅ Verificar: Muestra nombre del cliente actual en header
```

#### Paso 1.3: Vista del Dashboard
```
1. Dashboard debe mostrar:
   ✅ KPIs principales (Spend, ROAS, CPA, Conversiones)
   ✅ Gráficos de tendencia (últimos 7-30 días)
   ✅ Resumen de alertas activas
   ✅ Performance por campaña/adset

2. Verificar datos se cargan:
   ✅ Sin errores en consola (F12)
   ✅ Números tienen sentido (no hay NaN, 0, o valores extraños)
   ✅ Fechas son recientes (febrero 2026)
```

---

### 📍 FASE 2: Decision Board - Alertas (15 min)

**Objetivo:** Ver alertas generadas por MetaBrain

#### Paso 2.1: Navegar a Decision Board
```
1. Click en sidebar: "Decision Board"
2. URL debe cambiar a: /decision-board
3. ✅ Verificar: Página carga sin errores
```

#### Paso 2.2: Ver Alertas Activas
```
1. Decision Board debe mostrar:
   ✅ Lista de alertas ordenadas por severity
   ✅ Cada alerta muestra:
      - 🔴/🟡/🔵 Indicador de severity (CRITICAL/WARNING/INFO)
      - Título descriptivo
      - Nombre de entidad (campaña/adset/ad)
      - Recomendación de acción

2. Tipos de alertas esperadas (ejemplos):
   - "Alta frecuencia detectada" → Campaña saturada
   - "ROAS bajo" → Performance crítico
   - "CPA elevado" → Gasto ineficiente
   - "Oportunidad de scaling" → Performance excelente
```

#### Paso 2.3: Interactuar con Alertas
```
1. Click en una alerta:
   ✅ Verificar: Expande y muestra detalles completos
   ✅ Verificar: Muestra métricas específicas (frecuencia, ROAS, CPA)
   ✅ Verificar: Muestra acciones recomendadas

2. Filtrar alertas:
   ✅ Por severity (CRITICAL, WARNING, INFO)
   ✅ Por tipo (Fatigue, Bleeding, Scaling, etc.)
   ✅ Por nivel (Campaign, Adset, Ad)
```

#### Paso 2.4: Comparar con Baseline
```
1. Si tienes screenshots del sistema anterior:
   - Comparar cantidad de alertas (debe ser similar ±2)
   - Verificar tipos de alertas son los mismos
   - ✅ Sin regresiones: alertas críticas no desaparecieron
```

---

### 📍 FASE 3: Ads Manager - Vista de Anuncios (15 min)

**Objetivo:** Ver creativos y performance

#### Paso 3.1: Navegar a Ads Manager
```
1. Click en sidebar: "Ads Manager"
2. URL: /ads-manager
3. ✅ Verificar: Tabla de ads carga con datos
```

#### Paso 3.2: Verificar Datos de Ads
```
1. Tabla debe mostrar:
   ✅ Columnas: Ad Name, Status, Spend, ROAS, CPA, Frecuencia
   ✅ Filas: Listado de ads activos del cliente
   ✅ Preview de imagen/video del ad (thumbnail)

2. Click en un ad:
   ✅ Abre modal/panel con detalles completos
   ✅ Muestra histórico de performance (gráfico)
   ✅ Muestra clasificación (Dominant, Winner, Hidden, etc.)
```

#### Paso 3.3: Filtros y Ordenamiento
```
1. Probar filtros:
   ✅ Por status (Active, Paused)
   ✅ Por clasificación (Scalable, Saturating, etc.)
   ✅ Por rango de fechas

2. Probar ordenamiento:
   ✅ Por spend (DESC)
   ✅ Por ROAS (DESC)
   ✅ Por frecuencia (DESC)
```

---

### 📍 FASE 4: Creative Intel - Inteligencia de Creativos (15 min)

**Objetivo:** Ver análisis de creativos y patrones

#### Paso 4.1: Navegar a Creative Intel
```
1. Click en sidebar: "Creative Intel"
2. URL: /creative
3. ✅ Verificar: Vista de clustering carga
```

#### Paso 4.2: Ver Clusters de Creativos
```
1. Vista debe mostrar:
   ✅ Grupos de creativos similares (por fingerprint)
   ✅ Performance promedio del cluster
   ✅ Cantidad de ads en cada cluster

2. Click en un cluster:
   ✅ Expande y muestra todos los ads del grupo
   ✅ Muestra análisis de patrón común (formato, mensaje, audiencia)
```

#### Paso 4.3: Ver Patrones Ganadores
```
1. Sección "Winning Patterns":
   ✅ Muestra patrones detectados automáticamente
   ✅ Ejemplos: "Videos UGC + CTA directo = 3.2x ROAS promedio"
   ✅ Evidencia: Lista de ads que siguen el patrón
```

---

### 📍 FASE 5: Admin - Cerebro de Worker (20 min)

**Objetivo:** Verificar brain prompts y configuración

#### Paso 5.1: Navegar a Cerebro
```
1. Click en sidebar: "Administración" → "Cerebro de Worker"
2. URL: /admin/cerebro
3. ✅ Verificar: 4 tabs visibles
```

#### Paso 5.2: Tab 1 - Generadores IA
```
1. Seleccionar prompt type: "Report"
2. ✅ Verificar campos editables:
   - System Prompt (textarea)
   - Critical Instructions (textarea)
   - User Template (textarea)
   - Output Schema (code editor)

3. NO editar nada aún (solo revisar)
```

#### Paso 5.3: Tab 2 - Motor de Decisiones
```
1. Ver Engine Config del cliente actual:
   ✅ Fatigue thresholds (Frequency, CPA Multiplier)
   ✅ Structure rules (Min spend, Min impressions)
   ✅ Scaling speed (Conservative, Moderate, Aggressive)

2. NO editar nada aún (solo revisar)
```

#### Paso 5.4: Tab 3 - Clasificador Creativo (read-only)
```
1. Ver 6 categorías:
   ✅ DOMINANT_SCALABLE
   ✅ WINNER_SATURATING
   ✅ HIDDEN_BOFU
   ✅ INEFFICIENT_TOFU
   ✅ ZOMBIE
   ✅ NEW_INSUFFICIENT_DATA

2. Ver criterios de cada categoría
```

#### Paso 5.5: Tab 4 - Consola de Pruebas
```
1. Seleccionar:
   - Prompt type: "Creative Audit"
   - Cliente: "Almacen de Colchones"

2. Click "Test Prompt"
3. ✅ Verificar: Output genera análisis de creative
4. ✅ Verificar: Sin errores de API
```

---

### 📍 FASE 6: Slack Digest - Verificación (10 min)

**Objetivo:** Confirmar que digests llegan correctamente

#### Paso 6.1: Verificar Canal de Slack
```
1. Abrir Slack workspace de la agencia
2. Ir al canal del cliente (ej: #alma-colchones)
3. Buscar mensaje más reciente con:
   - Título: "📊 Acumulado Mes (Febrero 2026)"
   - Enviado por: Worker Brain Bot
```

#### Paso 6.2: Verificar Contenido del Digest
```
Mensaje debe incluir:

✅ **Header:**
   - Fecha del reporte
   - Período analizado (ej: "Feb 1-24")

✅ **KPIs Principales:**
   - Gasto total
   - ROAS 7d / MTD
   - CPA 7d / MTD
   - Conversiones totales

✅ **Alertas (si hay):**
   - 🔴 CRITICAL: [Descripción]
   - 🟡 WARNING: [Descripción]
   - 🔵 INFO: [Descripción]

✅ **Footer:**
   - Timestamp de generación
   - Link a dashboard (opcional)
```

#### Paso 6.3: Comparar con Día Anterior
```
1. Buscar digest del día anterior en mismo canal
2. Comparar:
   ✅ Formato es consistente
   ✅ Datos tienen sentido (tendencias coherentes)
   ✅ Alertas cambian según performance real
```

---

### 📍 FASE 7: Edición de Brain Prompts (15 min)

**Objetivo:** Probar edición sin deploy

#### Paso 7.1: Abrir Firebase Console
```
1. Ir a: https://console.firebase.google.com
2. Seleccionar proyecto: ai-analyzer
3. Ir a: Firestore Database
4. Navegar a: brain_prompts/meta
```

#### Paso 7.2: Editar Threshold de Alerta
```
1. En brain_prompts/meta:
   - Expandir array: alertRules
   - Buscar: META_HIGH_FREQUENCY
   - Campo: threshold
   - Valor actual: 3.5

2. Editar:
   - Cambiar a: 4.5
   - Guardar

3. ✅ Anotar hora del cambio
```

#### Paso 7.3: Esperar Siguiente Cron (o Trigger Manual)
```
Opción A - Esperar cron natural:
   - Los crons corren cada hora
   - Esperar máximo 60 min

Opción B - Trigger manual (si tienes acceso):
   - Ver FASE 8 para instrucciones de cron manual
```

#### Paso 7.4: Verificar Cambio Aplicado
```
1. Una vez que cron corrió:
   - Ir a /decision-board
   - Buscar alertas de "Alta frecuencia"

2. ✅ Verificar:
   - Campañas con frecuencia 3.6-4.4 ya NO alertan
   - Solo campañas con frecuencia >4.5 alertan
   - ✅ CAMBIO SIN DEPLOY funcionó!

3. Restaurar valor original:
   - Firebase Console → brain_prompts/meta
   - threshold: 4.5 → 3.5
   - Guardar
```

---

### 📍 FASE 8: Trigger Manual de Crons (15 min)

**Objetivo:** Ejecutar crons manualmente desde UI admin

#### Paso 8.1: Navegar a Cron Manual
```
1. Sidebar: "Administración" → "Cron Manual"
2. URL: /admin/cron
3. ✅ Verificar: Lista de crons disponibles
```

#### Paso 8.2: Ejecutar Data Sync
```
1. Cron: "Data Sync"
2. Descripción: "Sincroniza datos de Meta API y genera snapshots"
3. Click botón: "Run Now"

4. ✅ Verificar:
   - Spinner/loading aparece
   - Mensaje de éxito aparece después de 30-60 seg
   - No hay errores en consola

5. Resultado esperado:
   - "✅ Data sync completed for 29 clients"
   - Duration: ~45 seconds
```

#### Paso 8.3: Ejecutar Daily Digest
```
1. Cron: "Daily Digest"
2. Descripción: "Envía reporte diario a Slack"
3. Click botón: "Run Now"

4. ✅ Verificar:
   - Mensaje de éxito
   - "✅ Digests sent to 29 channels"

5. Verificar en Slack:
   - Nuevos mensajes llegaron a canales de clientes
   - Timestamp es actual (ahora mismo)
```

---

### 📍 FASE 9: Verificación de Firestore (15 min)

**Objetivo:** Confirmar estructura de datos correcta

#### Paso 9.1: Verificar dashbo_snapshots
```
1. Firebase Console → Firestore
2. Colección: dashbo_snapshots
3. Navegar a: dashbo_snapshots/[clientId]/[fecha]/meta

4. ✅ Verificar estructura:
{
  "account": [ /* Array de snapshots */ ],
  "campaign": [ /* Array de snapshots */ ],
  "adset": [ /* Array de snapshots */ ],
  "ad": [ /* Array de snapshots */ ],
  "updatedAt": "2026-02-25T..."
}

5. ✅ Verificar:
   - Fecha es reciente (hoy o ayer)
   - Arrays tienen datos (no están vacíos)
   - updatedAt es timestamp válido
```

#### Paso 9.2: Verificar client_snapshots
```
1. Colección: client_snapshots
2. Doc ID: [clientId]

3. ✅ Verificar campos:
   - date: "2026-02-24"
   - kpis: { spend, roas, cpa, conversions, ... }
   - alerts: [ /* Array de alertas */ ]
   - entityCounts: { campaigns, adsets, ads }
   - meta: { docSizeKB, executionTime, ... }

4. ✅ Verificar alerts:
   - Array length > 0 (si cliente tiene problemas)
   - Cada alert tiene: type, severity, title, description, entityId
```

#### Paso 9.3: Verificar brain_prompts
```
1. Colección: brain_prompts
2. Docs: meta, google, ga4, ecommerce

3. Para brain_prompts/meta:
   ✅ brainId: "META"
   ✅ version: "1.0.0"
   ✅ systemPrompt: (texto largo)
   ✅ analysisPrompt: (texto con {placeholders})
   ✅ alertRules: [ 4 reglas ]

4. Verificar cada alertRule:
   ✅ id: string único
   ✅ enabled: boolean
   ✅ threshold: número
   ✅ severity: "CRITICAL" | "WARNING" | "INFO"
   ✅ messageTemplate: string con {variables}
   ✅ recommendation: string con acciones
```

#### Paso 9.4: Verificar integraciones (Dashbo sync)
```
1. Colección: clients
2. Doc: [clientId] (ej: Almacen de Colchones)

3. ✅ Verificar campos nuevos:
   - integraciones: {
       meta: true,
       google: true,
       ga4: true,
       ecommerce: "tiendanube",
       email: null
     }
   - dashboClientId: 7334
   - dashboClientName: "Almacen de Colchones"
   - lastDashboSync: "2026-02-25T..."

4. Si NO existen estos campos:
   - ⚠️ Dashbo sync no se ejecutó
   - Ver troubleshooting abajo
```

---

---

## 📊 CHECKLIST FINAL - Usuario

### ✅ UI y Navegación
- [ ] Login funciona con Google Auth
- [ ] Todos los menús son accesibles
- [ ] Dashboard muestra KPIs correctos
- [ ] Gráficos cargan sin errores
- [ ] No hay console errors (F12)

### ✅ Alertas y Decision Board
- [ ] Decision Board muestra alertas
- [ ] Alertas tienen severity correcto (🔴/🟡/🔵)
- [ ] Recomendaciones son claras
- [ ] Filtros funcionan
- [ ] Detalles de alerta se expanden

### ✅ Ads Manager
- [ ] Tabla de ads carga completa
- [ ] Thumbnails de creativos visible
- [ ] Métricas (ROAS, CPA, Spend) correctas
- [ ] Filtros y ordenamiento funcionan
- [ ] Click en ad abre detalles

### ✅ Creative Intel
- [ ] Clusters de creativos visibles
- [ ] Patrones ganadores detectados
- [ ] Performance por cluster correcto
- [ ] Análisis de patrón claro

### ✅ Admin - Cerebro
- [ ] 4 tabs accesibles
- [ ] Brain prompts visibles
- [ ] Engine config editable
- [ ] Consola de pruebas funciona

### ✅ Slack Digests
- [ ] Mensajes llegan a canales correctos
- [ ] Formato es consistente
- [ ] KPIs en mensaje son correctos
- [ ] Alertas aparecen en digest
- [ ] Timestamp es actual

### ✅ Brain Prompts Editables
- [ ] Edición en Firebase refleja en sistema
- [ ] Cambio de threshold funciona
- [ ] No requiere deploy de código
- [ ] Cambios persisten después de cron

### ✅ Firestore Data
- [ ] dashbo_snapshots tiene datos recientes
- [ ] client_snapshots actualizado
- [ ] brain_prompts (4 docs) existen
- [ ] clients tiene campo integraciones
- [ ] Timestamps son actuales

### ✅ Crons Manuales
- [ ] UI de cron manual accesible
- [ ] Data sync ejecuta correctamente
- [ ] Daily digest ejecuta correctamente
- [ ] Mensajes de éxito aparecen
- [ ] Duración es razonable (<2 min)

---

## 🚨 TROUBLESHOOTING - Usuario

### ❌ "Dashboard muestra KPIs en 0 o NaN"

**Diagnóstico:**
1. Ir a Firebase Console → dashbo_snapshots
2. Verificar existe data para el cliente
3. Verificar fecha de updatedAt es reciente

**Solución:**
1. Ir a /admin/cron
2. Click "Run Now" en "Data Sync"
3. Esperar ~60 segundos
4. Refrescar dashboard (F5)

---

### ❌ "Decision Board no muestra alertas"

**Diagnóstico:**
1. Firebase Console → client_snapshots → [clientId]
2. Ver campo: alerts
3. Si alerts está vacío → normal (cliente sin problemas)
4. Si alerts tiene datos pero UI no muestra → bug

**Solución:**
1. Verificar cliente seleccionado es correcto (header)
2. Verificar filtros de severity no ocultan todas las alertas
3. Hard refresh: Ctrl + Shift + R (Chrome)
4. Si persiste: Check console errors (F12)

---

### ❌ "Slack digest no llega al canal"

**Diagnóstico:**
1. Verificar canal de Slack del cliente existe
2. Firebase Console → clients → [clientId]
3. Campo: slackChannel (debe estar configurado)

**Solución:**
1. Si slackChannel está vacío:
   - Firebase Console → clients → [clientId]
   - Agregar campo: slackChannel: "#nombre-canal"
   - Guardar

2. Re-ejecutar digest:
   - /admin/cron → "Daily Digest" → "Run Now"

---

### ❌ "Edité brain prompt pero no cambió nada"

**Diagnóstico:**
1. Verificar guardaste cambios en Firebase
2. Verificar esperaste siguiente cron
3. Verificar editaste campo correcto

**Solución:**
1. Firebase Console → brain_prompts/meta
2. Verificar campo editado tiene nuevo valor
3. Trigger cron manual: /admin/cron → "Data Sync"
4. Esperar 60 segundos
5. Ir a /decision-board → verificar cambio

---

### ❌ "Cron manual dice 'Error' o no responde"

**Diagnóstico:**
1. Abrir console (F12)
2. Ver errores en Network tab
3. Ver errores en Console tab

**Posibles causas:**
- Timeout (cron tarda >2 min)
- Meta API rate limit
- Firebase connection issue

**Solución:**
1. Esperar 5 minutos
2. Reintentar
3. Si persiste: Verificar .env.local tiene tokens válidos
4. Verificar conexión a internet

---

### ❌ "UI se ve rota o falta CSS"

**Diagnóstico:**
- Hard refresh: Ctrl + Shift + R

**Solución:**
```bash
# Terminal:
npm run build
npm run dev

# Esperar que termine de compilar
# Abrir: http://localhost:3000
```

---

### ❌ "No veo opción de Cron Manual en admin"

**Solución:**
1. Verificar estás logueado como admin
2. Sidebar → "Administración"
3. Debe aparecer: "Cron Manual"
4. Si no aparece: cuenta no tiene permisos admin

---

## 🎯 CRITERIOS DE ÉXITO - Usuario

| Fase | ✅ Éxito | ❌ Falló |
|------|---------|---------|
| Login y Dashboard | Muestra KPIs correctos | KPIs en 0 o NaN |
| Decision Board | Alertas visibles | Sin alertas cuando debería haber |
| Ads Manager | Tabla carga completa | Tabla vacía o error |
| Creative Intel | Clusters y patrones | Sin datos |
| Cerebro | 4 tabs accesibles | Errores al cargar |
| Slack Digest | Mensaje llega | No llega o formato roto |
| Brain Prompts | Edición funciona sin deploy | Cambios no se reflejan |
| Crons Manuales | Ejecuta en <2 min | Timeout o error |
| Firestore | Datos actualizados | Datos antiguos (>2 días) |

---

## ⏱️ TIEMPOS ESTIMADOS

| Fase | Duración |
|------|----------|
| Fase 1: Login y Dashboard | 10 min |
| Fase 2: Decision Board | 15 min |
| Fase 3: Ads Manager | 15 min |
| Fase 4: Creative Intel | 15 min |
| Fase 5: Cerebro | 20 min |
| Fase 6: Slack Digest | 10 min |
| Fase 7: Brain Prompts | 15 min |
| Fase 8: Crons Manuales | 15 min |
| Fase 9: Firestore | 15 min |

**Total: ~2 horas** (testing completo desde UI)

---

## 📝 NOTAS PARA EL USUARIO

### ✅ Antes de Empezar
1. Asegurate que el dev server está corriendo: `npm run dev`
2. Tené a mano:
   - Acceso a Firebase Console (https://console.firebase.google.com)
   - Acceso a Slack del workspace
   - Cliente piloto: "Almacen de Colchones"
3. Abrí el navegador en modo incógnito (para testing limpio)

### ✅ Durante el Testing
1. Anotar cualquier error que veas (screenshot)
2. Revisar console (F12) si algo no carga
3. Comparar con sistema anterior si tenés screenshots
4. No editar múltiples cosas a la vez (probar 1 por 1)

### ✅ Después del Testing
1. Si todo funciona: ✅ **PRODUCTION READY**
2. Si hay bugs: Listar y priorizar por severity
3. Rollback: Git revert si es necesario

### 🎯 Cliente Piloto Recomendado
**"Almacen de Colchones"**
- Tiene: Meta + Google + GA4 + TiendaNube
- Perfecto para probar multi-canal
- Performance activo (genera alertas)

---

## ✨ ¿Qué Viene Después?

Una vez que este testing pasa:

### ✅ Phase 1 COMPLETO:
- MetaBrain funcionando
- Brain prompts editables
- Dashbo auto-sync
- Multi-canal ready

### 🚀 Phase 2 (Próximo):
- EcommerceBrain con datos reales (no mock)
- Históricos de 90 días
- Blended ROAS en dashboard UI
- Cross-channel insights visibles

---

**¡Éxito!** 🎉

Si completaste todas las fases sin errores críticos, Worker Brain V2 Phase 1 está **listo para producción**.
