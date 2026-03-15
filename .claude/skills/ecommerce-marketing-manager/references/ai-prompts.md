# AI Prompts Guide — Biblioteca Completa

## Como Usar Esta Guia

Cada prompt esta listo para copiar y pegar. Reemplazar los valores entre `[corchetes]` con datos reales. Funcionan con ChatGPT, Claude, Gemini o cualquier LLM.

**Regla de oro**: Cuanto mas contexto des, mejor el resultado. Siempre incluir: industria, producto, audiencia, objetivo, restricciones.

---

## Meta Ads — Prompts

### Generar Copy de Anuncios

```
Sos un copywriter experto en Meta Ads para e-commerce en Argentina.

Producto: [nombre del producto]
Precio: $[precio]
Audiencia: [descripcion de la audiencia target]
Objetivo: [ventas / trafico / leads]
Tono: [profesional / informal / urgente / aspiracional]
Promocion: [descuento, envio gratis, etc. — o "sin promocion"]

Genera 5 variaciones de copy para anuncios de Meta Ads:
1. Hook directo (problema → solucion)
2. Social proof (testimonios/numeros)
3. Urgencia (oferta limitada)
4. Storytelling (antes/despues)
5. Pregunta que genera curiosidad

Para cada variacion incluir:
- Texto principal (max 125 caracteres visible antes de "Ver mas")
- Titulo (max 40 caracteres)
- Descripcion (max 30 caracteres)
- CTA sugerido (Comprar, Ver mas, Registrarse, etc.)
```

### Analizar Performance de Anuncios

```
Analiza estos resultados de Meta Ads y dame recomendaciones especificas:

Periodo: [fecha inicio] a [fecha fin]
Presupuesto diario: $[monto]
Objetivo de campana: [ventas / leads / trafico]

Metricas:
- CTR: [X%]
- CPC: $[X]
- CPM: $[X]
- ROAS: [X]x
- CPA: $[X]
- Frecuencia (7d): [X]
- Hook Rate (si video): [X%]
- Hold Rate (si video): [X%]

Benchmarks de referencia: CTR bueno >1%, ROAS objetivo [X]x, CPA objetivo <$[X]

Responde con:
1. Diagnostico: que esta pasando (bueno y malo)
2. Problema principal identificado
3. 3 acciones concretas ordenadas por impacto
4. Que NO tocar por ahora
```

### Briefear Disenador para Creativos

```
Necesito un brief para el disenador de ads de Meta. Formato: [imagen / video / carrusel]

Producto: [nombre y descripcion breve]
Audiencia: [quien lo va a ver]
Objetivo del anuncio: [generar clic / generar compra / generar awareness]
Mensaje principal: [que queremos comunicar]
Tono visual: [limpio / colorido / premium / casual / urgente]

Genera un brief con:
1. Concepto visual (que se deberia ver)
2. Texto en imagen (si aplica, max 20% de la imagen)
3. Formato y tamaños (1:1 feed, 9:16 stories/reels)
4. Referencia de estilo (describir look & feel)
5. Elementos obligatorios (logo, precio, CTA)
6. Para video: estructura segundo a segundo (hook 0-3s, problema 3-10s, producto 10-20s, CTA 20-30s)
```

---

## Google Ads — Prompts

### Generar Keywords

```
Sos un especialista en Google Ads para e-commerce en Argentina.

Producto/Categoria: [descripcion]
Competidores principales: [listar 2-3]
Presupuesto mensual: $[monto]

Genera:
1. 15 keywords transaccionales (intent de compra) con match type sugerido
2. 10 keywords informacionales (para blog/content)
3. 15 keywords negativas obligatorias
4. 5 keywords de marca a proteger
5. Estimar CPC aproximado por grupo

Formato tabla: keyword | match type | intent | CPC estimado | prioridad
```

### Optimizar Titulos de Shopping Feed

```
Optimiza estos titulos de productos para Google Shopping:

Producto 1: [titulo actual]
Producto 2: [titulo actual]
Producto 3: [titulo actual]

Reglas:
- Formula: [Marca] + [Tipo de Producto] + [Caracteristica] + [Color/Talle]
- Max 150 caracteres
- Incluir keywords de busqueda naturales
- Especifico > generico
- NO usar todo mayusculas ni caracteres especiales

Para cada producto dame: titulo optimizado + justificacion
```

### Generar RSAs (Responsive Search Ads)

```
Genera un Responsive Search Ad para Google Ads:

Keyword principal: [keyword]
Pagina de destino: [URL]
Propuesta de valor: [que ofrece el negocio]
Promocion activa: [descuento/envio gratis/ninguna]

Genera:
- 15 titulares (max 30 caracteres cada uno) variando:
  * 3 con keyword principal
  * 3 con beneficios
  * 3 con CTA
  * 2 con social proof / numeros
  * 2 con urgencia
  * 2 con marca
- 4 descripciones (max 90 caracteres cada una)
- 3 sugerencias de extensiones (sitelinks, callouts, structured snippets)
```

---

## Email Marketing — Prompts

### Generar Subject Lines

```
Genera 10 subject lines para un email de [tipo: promocion / newsletter / lanzamiento / carrito abandonado / win-back]:

Producto/Oferta: [descripcion]
Audiencia: [compradores recurrentes / nuevos / inactivos]
Tono: [urgente / casual / exclusivo / informativo]
Restricciones: Max 50 caracteres, sin TODO MAYUSCULAS, sin "GRATIS"

Para cada subject line incluir:
- Subject
- Preheader (complementario, no repetitivo, max 90 chars)
- Tipo de apelacion (urgencia, curiosidad, beneficio, social proof, personalizacion)
```

### Generar Secuencia de Welcome Flow

```
Diseña una secuencia de bienvenida de 5 emails para un e-commerce de [industria]:

Marca: [nombre]
Tono: [formal / casual / premium]
Cupon de bienvenida: [si/no, monto]
Productos estrella: [listar 3-5]

Para cada email incluir:
1. Timing (cuando se envia)
2. Subject line + preheader
3. Estructura del contenido (secciones)
4. CTA principal
5. Objetivo del email (engagement, educacion, venta)
6. Condicion de salida (si compro, detener?)
```

### Analizar Metricas de Email

```
Analiza estos resultados de email marketing:

Plataforma: [Klaviyo / Perfit]
Periodo: [mes]
Tamano de lista: [X suscriptores]

Campanas del mes:
- Campana 1: [nombre] — Open [X%], Click [X%], Revenue $[X]
- Campana 2: [nombre] — Open [X%], Click [X%], Revenue $[X]
- Campana 3: [nombre] — Open [X%], Click [X%], Revenue $[X]

Flows activos:
- Welcome: Open [X%], Click [X%], CVR [X%]
- Carrito: Open [X%], Click [X%], Recuperacion [X%]
- Post-compra: Open [X%], Click [X%]

Benchmarks: Open bueno >25%, Click bueno >3%, CTOR bueno >10%

Responde con:
1. Evaluacion general (salud del canal)
2. Top performer y por que
3. Peor performer y como mejorarlo
4. 3 acciones para el proximo mes
5. Segmento a priorizar
```

---

## SEO & Contenido — Prompts

### Generar Articulo de Blog SEO

```
Escribe un articulo de blog optimizado para SEO:

Keyword principal: [keyword]
Keywords secundarias: [2-3 keywords]
Audiencia: [quien lo va a leer]
Intencion de busqueda: [informacional / comparativa / guia de compra]
Largo objetivo: [1500-2000 palabras]
Producto/categoria a linkear: [pagina destino]

Estructura:
1. H1 con keyword principal
2. Intro (hook + preview del contenido, 100 palabras)
3. 4-6 secciones H2 con keywords secundarias
4. Tips practicos o lista de recomendaciones
5. FAQ (3-5 preguntas de People Also Ask)
6. Conclusion con CTA a producto/categoria

Reglas: Tono conversacional, parrafos cortos (<4 lineas), incluir datos/numeros, links internos naturales.
```

### Optimizar Meta Tags

```
Optimiza los meta tags de estas paginas de e-commerce:

Pagina 1: [URL] — Actualmente: Title "[actual]" / Description "[actual]"
Pagina 2: [URL] — Actualmente: Title "[actual]" / Description "[actual]"
Pagina 3: [URL] — Actualmente: Title "[actual]" / Description "[actual]"

Keywords target por pagina: [listar]
Marca: [nombre]

Para cada pagina:
- Title optimizado (max 60 chars, keyword al inicio)
- Meta Description (max 155 chars, incluir CTA)
- Justificacion del cambio
```

---

## Reportes — Prompts

### Reporte Mensual para Cliente

```
Genera un reporte mensual de marketing digital con estos datos:

Cliente: [nombre]
Periodo: [mes/año]
Objetivo de revenue: $[X]

RESULTADOS:
Meta Ads: Spend $[X], Revenue $[X], ROAS [X]x, CPA $[X], CTR [X%]
Google Ads: Spend $[X], Revenue $[X], ROAS [X]x, CPA $[X], CTR [X%]
Email: Enviados [X], Open Rate [X%], Click Rate [X%], Revenue $[X]
E-commerce: Revenue total $[X], Pedidos [X], AOV $[X], CVR sitio [X%]

Estructura del reporte:
1. Resumen ejecutivo (1 parrafo, resultado vs objetivo)
2. Performance por canal (tabla comparativa)
3. Top 3 logros del mes
4. Top 3 areas de mejora
5. Acciones para el proximo mes (3-5 concretas)
6. Presupuesto sugerido proximo mes

Tono: profesional pero accesible, con recomendaciones accionables.
```

### Reporte Flash Post-Evento

```
Genera un reporte flash post-evento con estos datos:

Evento: [Hot Sale / Black Friday / Dia de la Madre / etc.]
Duracion: [X dias]

RESULTADOS:
Revenue total: $[X] (vs evento anterior: $[X])
Pedidos totales: [X]
AOV: $[X]
Inversion total ads: $[X]
ROAS consolidado: [X]x
Mejor canal: [Meta/Google/Email]
Mejor creativo: [descripcion]
Producto mas vendido: [nombre]

Genera:
1. Headline del resultado (1 linea)
2. Comparativa vs evento anterior (tabla)
3. Top 3 aprendizajes
4. Que replicar en el proximo evento
5. Que cambiar
```

---

## Estrategia — Prompts

### Plan Mensual Completo

```
Genera un plan de marketing digital mensual para e-commerce:

Negocio: [industria, productos principales]
Revenue objetivo: $[X]
Presupuesto ads: $[X]
Canales activos: [Meta, Google, Email, SEO, WhatsApp]
Fechas clave del mes: [listar eventos, promociones, feriados]
Aprendizajes del mes anterior: [que funciono, que no]

Genera:
1. Distribucion de presupuesto por canal (con justificacion)
2. Calendario semanal de acciones (semana 1-4)
3. Campanas a lanzar por canal
4. Contenido a producir (ads, emails, blog)
5. Metricas a monitorear y frecuencia
6. Riesgos y plan de contingencia
```

### Diagnostico de Performance

```
Actua como un CMO de e-commerce experimentado. Diagnostica esta situacion:

Situacion: [describir el problema — ej: "ROAS cayo 40% en las ultimas 2 semanas"]

Datos disponibles:
- Meta: CTR [X%], CPM $[X], ROAS [X]x, Frecuencia [X]
- Google: CTR [X%], ROAS [X]x, Impression Share [X%]
- Email: Open Rate [X%], Click Rate [X%]
- Sitio: CVR [X%], Bounce Rate [X%], Velocidad [X]s
- Cambios recientes: [listar cualquier cambio en campanas, sitio, precios, etc.]

Responde como un arbol de decision:
1. Hipotesis principal
2. Que verificar para confirmar/descartar
3. Si se confirma: acciones inmediatas (24h)
4. Si se descarta: siguiente hipotesis
5. Acciones preventivas para que no se repita
```
