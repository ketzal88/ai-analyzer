# Meta Ads Automation — Contexto de Conversación
> Generado desde chat de Claude Desktop (Worker Brain project) — 3 Marzo 2026
> Referencia: https://www.notion.so/31809f3901e081ffad0bf0ee3aa140c8

---

## Decisión de Arquitectura

Se decidió construir un **sistema standalone de Meta Ads automation**, separado de Worker Brain v2. Solo Meta por ahora (no Google Ads, no multi-platform). Tres capas:

1. **Data Sync:** Cloud Scheduler + Cloud Functions → Meta Ads API → Firestore cada 6h
2. **Rules Engine:** Reglas determinísticas configurables por cliente que pausan, escalan, alertan
3. **MetaAdsBrain Agent:** Agente AI (1-2x/semana) que analiza patrones, genera briefs, reportes narrativos

Distribución: Slack (alertas), Worker Dashboard (reportes), WhatsApp (críticas).

---

## Investigación Andromeda + GEM (2025-2026)

### Andromeda (Retrieval Engine)
- Sistema de retrieval **creative-first** que reemplazó audience-first matching
- Organiza ads en **Entity IDs** por similitud semántica (Creative Similarity Score > 60% = mismo Entity ID)
- Filtra billones de ads → ~1,000 candidatos en <300ms ANTES del auction
- **Branch-Cutting** deprioritiza clusters redundantes de creativos
- Implicación: **broad targeting + diversidad creativa >> micro-audiencias**
- Necesitás **8-15 conceptos genuinamente distintos** por campaña ASC (no 100 variaciones menores)

### GEM (Generative Ads Recommendation Model)
- Foundation model LLM-scale para recomendación de ads
- Arquitectura teacher-student: GEM entrena modelos rápidos para serving
- **Cross-platform learning:** insights de Instagram mejoran delivery de Facebook
- **Sequence-aware:** optimiza journeys de ads, no ads individuales
- Learning phase extendido a **7+ días** (era 3-4)
- Ediciones frecuentes resetean learning con penalidad mayor
- Day-trading campaigns (on/off, duplicar ad sets) ahora es significativamente dañino

### Delivery Pipeline (4 etapas)
1. Retrieval (Andromeda): Billones → ~1,000 candidatos
2. Ranking (GEM + modelos): Predice probabilidad de acción
3. Auction: Evalúa bid, relevancia, estimated action rate
4. Delivery: Optimización de placement, pacing, tracking

**Si el ad no pasa Stage 1 (Andromeda), targeting/bid/calidad son irrelevantes.**

---

## Sistema de Diagnóstico por Nivel

### Jerarquía: Campaña → Ad Set → Ad → Creativo
Siempre diagnosticar de arriba hacia abajo. Si la estructura está mal, no importa cuán bueno sea el creativo.

### Nivel Campaña
- ROAS, CPA, Spend vs Budget, Learning Phase status
- Max 5 campañas de conversión activas por cuenta
- Max 1-3 ad sets por campaña (consolidar para Andromeda)

### Nivel Ad Set
- CPM, Frequency, Reach vs Audience, Optimization Events/week
- Si un ad acapara >80% spend → posible Entity ID monopoly
- CPM + Frequency subiendo = audiencia agotada

### Nivel Ad — Diagnóstico por Formato

**Métricas universales (todos los formatos):** CTR, Outbound CTR, CPA, ROAS, Quality/Engagement/Conversion Rankings, Spend como señal de viabilidad.

**Video — Funnel de Atención:**
- HOOK: Hook Rate = 3s views ÷ impressions (>25% ok, >35% elite)
- HOLD: Hold Rate = ThruPlay ÷ 3s views (>40% ok, >60% elite)
- ACTION: CTR + CPA
- Árbol: Hook muerto → pausar. Hook bueno + Hold malo → re-editar body. Hold bueno + CTR malo → cambiar CTA. Todo bueno + CPA alto → problema LP.

**Imagen:**
- CTR (>1% bueno), CPC, Engagement Rate, Rankings
- Diagnóstico cruzado: misma imagen con distintos copies aísla variable

**Carousel:**
- CTR total, distribución de clicks por tarjeta, swipe rate
- Si >80% clicks en tarjeta 1 = no desliza = falta continuidad visual

---

## Creative DNA (Tagging Automático)

**NO usar naming conventions manuales.** Son frágiles, inconsistentes, no escalan.

El Creative DNA se genera automáticamente de 3 fuentes:
1. **Meta API:** formato, duración, thumbnail, texto, CTA, placement, rankings, retention data
2. **AI Vision sobre frames:** 4 frames para video, 1 análisis para imagen, primera+última para carousel. Clasifica: visual_style, angle, hook_type, elementos presentes, tono
3. **NLP sobre ad copy:** tipo de mensaje, presencia de números, largo, CTA type

Resultado: objeto JSON por creativo en Firestore con ~15 atributos que describe QUÉ ES el ad sin intervención humana.

Usos del Creative DNA:
- Pattern Analysis: correlacionar atributos con performance
- Diversity Audit: detectar falta de Entity IDs distintos para Andromeda
- Iteration Briefs: decir exactamente qué cambiar de un ad basado en dónde falla
- Predicción de fatiga: creative lifespan promedio por tipo + cliente
- Format Performance: comparar video vs imagen vs carousel por cliente

---

## Reglas Determinísticas Revisadas

### Universales (todos los formatos)
- Zero Traction: spend > $30, 0 clicks, 24h → PAUSE
- CPA Explosion: > 3x target, no learning, 72h+ → PAUSE
- Quality/Engagement/Conversion Rankings Below Average → ALERT específica
- Frequency > 3.0 + CTR WoW < -15% → fatiga
- < 3 ángulos distintos en Creative DNA → alerta diversidad

### Video específicas
- Hook Kill: Hook Rate < 20% + spend > $50 → PAUSE
- Body Débil: Hook > 25% + Hold < 30% → ALERT
- CTA Débil: Hook + Hold buenos + CTR < 0.8% → ALERT
- Drop-off medio: p25 alto pero p50 cae > 50% → ALERT

### Imagen específicas
- Imagen invisible: CTR < 0.5% + imp > 2000 → PAUSE
- Imagen atractiva sin conversión: CTR > 1.5% + CPA > 2x → ALERT LP

### Carousel específicas
- Primera tarjeta falla: CTR < 0.5% → ALERT
- No desliza: >80% clicks en T1 → ALERT continuidad

### Scaling (todos)
- Scale Up: ROAS 5d > target + last change > 72h → +20% budget (max 50%/semana)
- Rollback: ROAS drop > 25% sostenido 72h+ → revertir
- GEM necesita 72-96h post-cambio antes de evaluar impacto

---

## Cambios Necesarios al Brain Actual (DOCS_STRATEGY)

### AGREGAR (prioridad alta):
- Creative DNA automático (base de todo creative intelligence)
- Hold Rate como métrica (sin esto no sabés si el video retiene)
- Diagnóstico diferenciado por formato (video/imagen/carousel)
- Diversity Score (medir Entity IDs para Andromeda)

### AGREGAR (prioridad media):
- Iteration Briefs automáticos (qué cambiar exactamente)
- Drop-off Analysis para video (localizar punto de pérdida)
- Format Performance Analysis (qué formato priorizar)
- Predicción de fatiga por tipo de creativo

### MODIFICAR:
- Clasificación de 6 categorías: enriquecer con Creative DNA (POR QUÉ funciona, no solo métricas)
- Intent Engine: agregar formato como variable (video rinde más TOFU, carousel más BOFU)
- Glosario: agregar Hold Rate, Completion Rate, Diversity Score, Effective CTR, Swipe Rate
- Alertas: diferenciar por formato (fatiga de video ≠ fatiga de imagen)

---

## Principios de Diseño

1. Diagnosticar de arriba hacia abajo (campaña → creativo)
2. Datos, no ojos — métricas reemplazan opinión subjetiva
3. Formato importa — video, imagen, carousel se diagnostican diferente
4. Tagging automático con Creative DNA, no naming conventions
5. Reglas para lo urgente, agente para lo estratégico
6. Diversidad creativa = nuevo targeting (Andromeda)
7. Iterar quirúrgicamente — tocar solo lo que falla
8. Benchmarks propios > genéricos

---

## Documentación

- **Notion:** [Guía de Diagnóstico Meta Ads](https://www.notion.so/31809f3901e081ffad0bf0ee3aa140c8) — bajo Worker Brain
- **Notion:** Worker Brain v2 Ecosistema Multi-Canal — contexto general
- **Archivo anterior:** Meta_Ads_Andromeda_GEM_Documentacion.docx — deep dive en Andromeda/GEM y reglas revisadas

## Tracking Foundation
- Pixel + CAPI con deduplicación es requisito
- Key events: ViewContent, AddToCart, InitiateCheckout, Purchase
- Attribution: 7-day click / 1-day view
- ~20-25% de conversiones son repeat actions → usar First Conversion para CAC real
