# Meta Ads — Manual Completo de Operacion

## Como Funciona Meta Ads

Meta Ads es publicidad de **interrupcion**. El creativo lo es todo. El algoritmo (Andromeda) decide a quien mostrar en base al contenido del creativo. Sin buena senal de conversion (Pixel + CAPI), el algoritmo no aprende.

### Logica del Funnel

```
FRIO → Personas que nunca oyeron hablar de la marca (Awareness)
TIBIO → Interactuaron (visitaron sitio, vieron video) (Retargeting)
CALIENTE → Agregaron al carrito / iniciaron checkout (Conversion)
COMPRADOR → Ya compraron (Retencion / Upsell)
```

### Estructura: 3 Niveles

1. **Campana**: Objetivo (siempre Ventas/Sales para e-commerce) + presupuesto (CBO)
2. **Conjunto de anuncios (Ad Set)**: Audiencia + placements + presupuesto individual
3. **Anuncio (Ad)**: Creativo real (imagen/video/carrusel + copy + titulo + CTA)

---

## Pixel y CAPI

### Eventos obligatorios (por prioridad)

| Evento | Cuando dispara | Por que importa |
|--------|---------------|-----------------|
| `Purchase` | Compra completada | Senal principal de conversion |
| `InitiateCheckout` | Inicio de checkout | Intent alto |
| `AddToCart` | Agrega al carrito | Retargeting caliente |
| `ViewContent` | Ve pagina de producto | Retargeting tibio |
| `PageView` | Cualquier pagina | Audiencia base |

### Verificacion

1. Events Manager → Pixel → verificar eventos ultimas 24hs
2. Extension Chrome **Meta Pixel Helper**
3. **Event Match Quality (EMQ)**: objetivo >7 (verde). Si <5: revisar CAPI urgente
4. CAPI + Pixel juntos siempre. Verificar columna "Deduplication" activa.

---

## Estructura de Campanas Recomendada

### Campana 1: Adquisicion (60-70% del presupuesto)

```
ACQ | [Cliente] | [MES-ANO] | Ventas
  Ad Set 1: Broad (sin intereses) — Excluir compradores 180d
  Ad Set 2: Lookalike 1-3% de compradores — Excluir compradores 180d
  Ad Set 3: Intereses (opcional, como test)
```

### Campana 2: Retargeting (20-25%)

```
RTG | [Cliente] | [MES-ANO] | Retargeting
  Ad Set 1: Carrito abandonado 3 dias — Excluir compradores 7d
  Ad Set 2: Visitantes sitio 7 dias — Excluir AddToCart y compradores
  Ad Set 3: DPA (Dynamic Product Ads) — Catalogo conectado
```

### Campana 3: Retencion (10-15%)

```
RET | [Cliente] | [MES-ANO] | Upsell
  Ad Set 1: Compradores ultimos 90 dias — Productos complementarios
  Ad Set 2: Compradores +90 dias sin recompra — Oferta de reactivacion
```

### Convencion de nombres

`[TIPO] | [CLIENTE] | [MES-ANO] | [OBJETIVO]`

---

## Creatividades

### Tipos y cuando usar

| Tipo | Formato | Cuando usar |
|------|---------|------------|
| **Video (Reels/Stories)** | 9:16, 15-30s | Awareness, demostracion |
| **Imagen estatica** | 1:1 Feed, 9:16 Stories | Ofertas claras, retargeting |
| **Carrusel** | Multi-slide | Multiples productos, features |
| **DPA** | Automatico del catalogo | Retargeting con catalogo grande |
| **UGC** | Video/foto estilo cliente | Confianza, audiencias frias |

### Estructura de Video

```
0-3s: HOOK — Razon para no scrollear
3-10s: PROBLEMA o CONTEXTO
10-20s: PRODUCTO en accion / beneficio
20-30s: CTA — "Compra aca", "Ver en tienda"
```

### Checklist pre-publicacion

- [ ] Primeros 3 segundos enganchan? (hook claro)
- [ ] Producto visible antes del segundo 5?
- [ ] Funciona sin sonido? (subtitulado)
- [ ] Formato correcto? (9:16 Reels/Stories, 1:1 Feed)
- [ ] Copy complementa lo visual sin repetir?
- [ ] CTA claro?
- [ ] Link al producto/categoria correcto (NO a la home)?
- [ ] Pixel configurado en el anuncio?
- [ ] Landing carga rapido en mobile?

### Reglas de rotacion

- **3-5 anuncios activos** por ad set
- Rotar cuando lleva 2+ semanas y CTR cayo >30%

---

## Metricas e Interpretacion

### Por nivel

| Metrica | Malo | Aceptable | Bueno | Excelente |
|---------|------|-----------|-------|-----------|
| CTR (link) | <0.5% | 0.5-1% | 1-1.5% | >3% |
| Hook Rate (3s) | <20% | 20-30% | >30% | >40% |
| Hold Rate (completo) | <10% | 10-20% | >20% | >30% |
| Frecuencia (7d) | >5 (saturado) | 3-4 (monitorear) | 1-2 (normal) | — |

### ROAS por margen

| Margen bruto | ROAS minimo break-even |
|-------------|----------------------|
| 50% | 2x |
| 40% | 2.5x |
| 30% | 3.3x |
| 20% | 5x |

**Siempre cruzar Meta ROAS con GA4.** Diferencia normal: 10-20%. Si >30%: problema de atribucion.

---

## Optimizacion Semanal

### Primeros 3-5 dias: NO TOCAR NADA (fase de aprendizaje)

### Semana 1: Solo verificar
- Anuncios activos sin desaprobaciones
- Pixel registrando compras

### Semana 2+: Optimizar cada lunes
1. ROAS sobre objetivo? → SI: mantener o escalar +20-30%. NO: analizar CTR/CVR/CPM
2. Anuncios con CTR <0.5% + 1000 impresiones? → Apagar
3. Frecuencia >4 en 7 dias? → Ampliar audiencia o rotar creatividades
4. Anuncios desaprobados? → Corregir y reenviar

### Escalamiento

- **Vertical**: +20-30% presupuesto maximo. Esperar 3-5 dias antes de subir de nuevo
- **Horizontal**: Duplicar ad set que funciona, darle presupuesto nuevo, no tocar original

---

## Errores Comunes

| Error | Solucion |
|-------|----------|
| Tocar campanas en fase de aprendizaje | Respetar 5 dias sin cambios |
| Subir presupuesto >50% de golpe | Max 30% cada 3-5 dias |
| No renovar creatividades | Revisar frecuencia semanalmente |
| Confiar ciegamente en ROAS de Meta | Cruzar con GA4 siempre |
| Audiencias <500K personas (Argentina) | Ampliar o usar Broad |
| Pixel caido sin notarlo | Revisar Events Manager semanal |
| No excluir compradores del frio | Siempre excluir compradores recientes |
| Mandar trafico a la home | Siempre al producto o categoria |

---

## Andromeda (Sistema de Entrega de Anuncios)

### Como funciona

1. **Retrieval**: Filtra candidatos para cada usuario (historial, contenido, hora, dispositivo)
2. **Ranking**: Calcula eCPM = probabilidad de accion × puja × calidad del anuncio
3. **Entrega**: Gana el mayor eCPM

**Consecuencia**: Un creativo excelente gana subastas pagando MENOS. El creativo ES el targeting.

### Senales que usa Andromeda

| Senal | Via | Impacto |
|-------|-----|---------|
| Purchase | Pixel + CAPI | La mas valiosa |
| InitiateCheckout | Pixel + CAPI | Alta intencion |
| AddToCart | Pixel | Util con pocas compras |
| ViewContent | Pixel | Base para retargeting |
| Datos cliente (email, tel) | CAPI | Mejoran EMQ |

### Fase de aprendizaje

- Necesita **50 conversiones en 7 dias** para salir
- Rendimiento inestable durante el aprendizaje
- Cambios que reinician: presupuesto >30%, cambio audiencia, cambio objetivo, pausar/reactivar
- **Aprendizaje limitado**: Consolidar ad sets o bajar evento de optimizacion (AddToCart en vez de Purchase)

---

## GEM — Framework de Diagnostico Creativo

```
G — Good Content Rate  → Relevancia del creativo para la audiencia
E — Engagement Rate    → Genera accion? (CTR, Hook Rate, Hold Rate)
M — Meta Quality Score → Calidad tecnica (landing, feedback, politicas)
```

### Arbol de diagnostico

```
ROAS bajo o cayendo
    │
    ▼
CTR > 1%?
├── SI → E esta bien. Creativo engancha.
│   ├── CVR sitio OK? → SI → Problema de senal/atribucion (M) → Revisar Pixel/CAPI/EMQ
│   └── CVR sitio OK? → NO → Problema de landing/producto (M) → Revisar UX, precio, stock
│
└── NO → Creativo no engancha
    ├── Hook Rate > 25%? → SI → Problema de propuesta (G) → Cambiar copy/CTA/angulo
    └── Hook Rate > 25%? → NO → Problema de inicio (E) → Cambiar primeros 3 segundos
```

### Aplicacion semanal (cada lunes, anuncios con >2000 impresiones)

| Anuncio | CTR | Hook Rate | ROAS | GEM | Accion |
|---------|-----|-----------|------|-----|--------|
| Video_A_v1 | 1.8% | 32% | 4.2x | G✅ E✅ M✅ | Escalar |
| Imagen_B | 0.3% | — | 1.1x | E❌ | Cambiar hook/CTA |
| Carrusel_C | 2.1% | — | 1.8x | M❌ | Revisar landing |

---

## Checklists

### Inicio de mes
- [ ] Campanas activas correctamente
- [ ] Pixel + CAPI sin errores, EMQ >7
- [ ] Presupuesto definido y distribuido
- [ ] 2-3 anuncios nuevos subidos
- [ ] Sin anuncios desaprobados pendientes
- [ ] Audiencias retargeting con tamano suficiente
- [ ] Frecuencia semana anterior revisada

### Optimizacion semanal (lunes)
- [ ] ROAS semana vs objetivo
- [ ] CPA por campana dentro del rango
- [ ] CTR por anuncio: apagar <0.5% con +1000 impresiones
- [ ] Frecuencia: alertar si >4 en 7 dias
- [ ] Ad sets en aprendizaje limitado?
- [ ] Pixel sigue registrando compras?

### Cierre de mes
- [ ] Exportar reporte: Revenue, ROAS, CPA, CPM, CTR, Frecuencia
- [ ] Mejor creativo del mes (mayor CTR + mejor ROAS)
- [ ] Mejor segmento del mes
- [ ] Comparar Revenue Meta vs GA4 (diferencia <20%?)
- [ ] Documentar aprendizajes
- [ ] Definir creatividades a pausar y renovar

### Andromeda + GEM mensual
- [ ] EMQ >7 en Events Manager
- [ ] CAPI pasando email, telefono, nombre
- [ ] GEM analysis de todos los anuncios con >2000 impresiones
- [ ] Documentar top 3 y bottom 3 anuncios del mes
- [ ] Briefear disenador con aprendizajes
- [ ] Ningun ad set en Aprendizaje Limitado
- [ ] Evaluar consolidacion de campanas

---

## Protocolo Temporadas Altas

### Que pasa: CPM sube 50-200%, audiencias se saturan mas rapido, ventana de decision mas corta

### Protocolo 4 semanas

| Semana | Acciones |
|--------|----------|
| -4 | Definir oferta, aumentar presupuesto frio +20%, briefear disenador, segmentar email |
| -2 | Creatividades listas, campanas en borrador, teaser/awareness, primer email calentamiento |
| -1 | Verificar Pixel/CAPI, sitio aguanta trafico, verificar stock, presupuesto 3-5x normal, war room |
| Dia evento | Publicar 00:00, email apertura, monitorear cada 2-3h, escalar si ROAS OK, pausar si sitio cae |
| Post (2-3d) | Bajar presupuesto, email last call, reporte flash, documentar |

---

## Diagnostico de Emergencias

### ROAS cayo >30% en 3 dias
1. Pixel registra compras? → No: problema tecnico urgente
2. Sitio funciona? → Revisar velocidad, checkout, stock
3. Frecuencia subio? → Fatiga creativa, rotar
4. CPM subio? → Competencia/temporada, mejorar creativo
5. CTR mantenido pero CVR sitio bajo? → Problema del sitio, no de Meta

### Anuncios desaprobados
- Palabras prohibidas, categorias especiales sin declaracion, imagen >20% texto, URLs rotas
- Corregir → solicitar revision manual → si rechaza repetidamente, crear anuncio nuevo

### 0 conversiones en 48+ horas
1. Anuncios activos (no pausados)?
2. Presupuesto disponible?
3. Pixel: llegan eventos Purchase?
4. Compra de prueba → verificar en Events Manager
5. Si prueba no registra → problema de Pixel, no de campana
