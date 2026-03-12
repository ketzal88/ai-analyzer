# SEO & Contenido — Manual Completo

## Por que SEO para E-commerce

SEO es el unico canal que genera trafico **gratis y compuesto**. Cada pagina bien posicionada trabaja 24/7 sin costo por clic. Horizonte: 3-12 meses para ver resultados, pero una vez posicionado, el trafico es estable.

**Complemento con Paid**: Meta/Google Ads = resultados inmediatos. SEO = base solida a mediano plazo. Un e-commerce maduro deberia tener 30-50% del trafico desde organico.

---

## SEO On-Page

### Estructura de URLs

```
BUENO: tienda.com/zapatillas-running-mujer
MALO:  tienda.com/products/12345
MALO:  tienda.com/categoria/sub/sub2/producto-nombre-muy-largo
```

**Reglas**: Cortas, descriptivas, con keyword principal, sin parametros innecesarios, guiones medios (no bajos).

### Title Tags (lo mas importante)

**Formula**: `[Keyword Principal] + [Modificador] | [Marca]`

| Pagina | Ejemplo |
|--------|---------|
| Home | Tienda Online de Zapatillas Running | MarcaX |
| Categoria | Zapatillas Running Mujer - Envio Gratis | MarcaX |
| Producto | Nike Air Zoom Pegasus 40 Mujer - Precio y Talles | MarcaX |
| Blog | Como Elegir Zapatillas para Correr: Guia Completa 2025 |

**Reglas**: Max 60 caracteres. Keyword al inicio. Unico por pagina.

### Meta Descriptions

**Formula**: `[Beneficio/gancho] + [Keyword] + [CTA]`

- Max 155 caracteres
- Incluir keyword naturalmente
- CTA: "Compra online", "Envio gratis", "Ver precios"
- Unica por pagina (no duplicar entre productos similares)

### Headings (H1-H3)

| Nivel | Uso | Ejemplo |
|-------|-----|---------|
| H1 | 1 por pagina, keyword principal | Zapatillas Running Mujer |
| H2 | Secciones principales | Mejores Marcas, Como Elegir, Precios |
| H3 | Sub-secciones | Nike, Adidas, Asics (dentro de Mejores Marcas) |

### Contenido de Paginas de Producto

- Descripcion unica de min 150 palabras (NO copiar del proveedor)
- Incluir keywords secundarias naturalmente
- Especificaciones en formato lista/tabla
- FAQ con preguntas reales de clientes (schema markup)
- Reviews/testimonios (schema markup)

### Contenido de Paginas de Categoria

- Texto introductorio de 200-300 palabras arriba de los productos
- Links internos a subcategorias
- FAQ de la categoria
- No bloquear con JavaScript la carga de productos

### Imagenes

- Alt text descriptivo con keyword: `alt="Zapatilla Nike Pegasus 40 Mujer Azul"`
- Formato WebP (30-50% mas liviano que JPG)
- Lazy loading para imagenes debajo del fold
- Tamaño max: 200KB por imagen
- Nombre de archivo descriptivo: `nike-pegasus-40-mujer-azul.webp`

---

## SEO Tecnico

### Core Web Vitals (objetivos)

| Metrica | Bueno | Necesita Mejora | Malo |
|---------|-------|----------------|------|
| LCP (Largest Contentful Paint) | <2.5s | 2.5-4s | >4s |
| INP (Interaction to Next Paint) | <200ms | 200-500ms | >500ms |
| CLS (Cumulative Layout Shift) | <0.1 | 0.1-0.25 | >0.25 |

### Verificacion tecnica mensual

- [ ] Google PageSpeed Insights: score >80 mobile
- [ ] Search Console: errores de rastreo
- [ ] Sitemap.xml actualizado y enviado
- [ ] Robots.txt no bloquea paginas importantes
- [ ] Sin paginas 404 en productos activos
- [ ] Canonical tags correctos (evitar contenido duplicado)
- [ ] Schema markup validado (Product, Review, FAQ, BreadcrumbList)
- [ ] HTTPS en todas las paginas
- [ ] Mobile-friendly test OK

### Schema Markup para E-commerce

| Tipo | Donde | Que incluye |
|------|-------|-------------|
| Product | Pagina de producto | name, image, price, availability, review |
| BreadcrumbList | Todas las paginas | Ruta de navegacion |
| FAQ | Categorias y productos | Preguntas frecuentes |
| Organization | Home | Logo, redes sociales, info contacto |
| Review/AggregateRating | Productos con reviews | Rating, cantidad de reviews |

### Errores comunes tecnicos

| Error | Impacto | Solucion |
|-------|---------|----------|
| Contenido duplicado | Diluye ranking | Canonicals, noindex en filtros |
| Paginas huerfanas | No se indexan | Links internos, sitemap |
| Redirect chains | Pierde link juice | Redirect directo (1 salto max) |
| Mixed content (HTTP/HTTPS) | Alerta seguridad | Forzar HTTPS en todo |
| Thin content | Penalizacion | Min 150 palabras por pagina |
| JavaScript rendering | Google no ve contenido | SSR o pre-rendering |

---

## Keyword Research

### Tipos de keywords para e-commerce

| Tipo | Intent | Ejemplo | Donde usar |
|------|--------|---------|------------|
| Transaccional | Compra | "comprar zapatillas running" | Producto, Categoria |
| Navegacional | Marca | "nike pegasus precio" | Producto |
| Informacional | Aprender | "mejores zapatillas para correr" | Blog |
| Comparativa | Decidir | "nike vs adidas running" | Blog |
| Local | Ubicacion | "zapatillas running buenos aires" | Landing local |

### Proceso de keyword research

1. **Semilla**: Listar productos, categorias, marcas, problemas que resuelven
2. **Expansion**: Google Suggest, People Also Ask, Ahrefs/Semrush, GSC queries existentes
3. **Filtro**: Volumen >100/mes, dificultad alcanzable, intent comercial
4. **Mapeo**: Asignar 1 keyword principal + 2-3 secundarias por pagina
5. **Priorizar**: High volume + low difficulty + high commercial intent = primero

### Herramientas

| Herramienta | Uso | Costo |
|-------------|-----|-------|
| Google Search Console | Keywords reales que ya traen trafico | Gratis |
| Google Keyword Planner | Volumenes aproximados | Gratis (con cuenta Ads) |
| Ahrefs/Semrush | Research completo, competencia, gaps | Pago |
| Ubersuggest | Alternativa mas economica | Freemium |
| AnswerThePublic | Preguntas de usuarios | Freemium |

---

## Estrategia de Contenido

### Pillar-Cluster Model

```
PILAR: "Zapatillas Running" (pagina de categoria)
  |
  ├── CLUSTER: "Mejores zapatillas running 2025" (blog)
  ├── CLUSTER: "Como elegir zapatillas running" (blog)
  ├── CLUSTER: "Zapatillas running para principiantes" (blog)
  ├── CLUSTER: "Nike vs Adidas: cual es mejor para correr?" (blog)
  └── CLUSTER: "Cuidados para zapatillas running" (blog)
```

Cada cluster linkea al pilar. El pilar linkea a los clusters. Esto construye **autoridad tematica**.

### Calendario de contenido

| Frecuencia | Tipo | Objetivo |
|-----------|------|----------|
| 2/mes | Blog post largo (1500+ palabras) | Trafico informacional, link building |
| 4/mes | Optimizacion paginas existentes | Mejorar rankings actuales |
| 1/mes | Landing especial (temporada, coleccion) | Capturar busquedas estacionales |

### Contenido que convierte (e-commerce)

1. **Guias de compra**: "Como elegir [producto]" → link a categoria
2. **Comparativas**: "[Producto A] vs [Producto B]" → links a ambos productos
3. **Listas**: "10 mejores [productos] para [uso]" → links a productos
4. **Tutoriales**: "Como usar/cuidar [producto]" → link a accesorios
5. **Estacionales**: "Regalos para [ocasion]" → links a seleccion

---

## Link Building

### Estrategias para e-commerce

| Estrategia | Dificultad | Impacto |
|-----------|------------|---------|
| Proveedores/marcas (pedir link) | Baja | Medio |
| Directorios de nicho | Baja | Bajo |
| Guest posting en blogs relevantes | Media | Alto |
| PR digital (notas en medios) | Alta | Muy alto |
| Contenido linkeable (guias, datos) | Media | Alto |
| Influencers con blog | Media | Medio-Alto |

### Links internos

- Desde blog a productos/categorias relevantes
- Breadcrumbs en todas las paginas
- Productos relacionados / "Tambien te puede interesar"
- Anchor text descriptivo (NO "click aqui")
- Max 100 links internos por pagina

---

## Google Search Console

### Reportes semanales

1. **Performance**: Clicks, impresiones, CTR, posicion promedio
2. **Queries**: Top keywords, posicion, CTR → optimizar pages con posicion 4-10
3. **Pages**: Top paginas, errores de cobertura
4. **Core Web Vitals**: Paginas con problemas

### Acciones mensuales GSC

- [ ] Revisar queries con impresiones altas pero CTR bajo → mejorar title/description
- [ ] Queries en posicion 4-10 → candidatas a optimizar (quick wins)
- [ ] Paginas excluidas → verificar que no son importantes
- [ ] Errores de rastreo nuevos → corregir
- [ ] Enviar sitemap actualizado si hay cambios significativos
- [ ] Mobile usability issues → corregir

---

## Metricas SEO

| Metrica | Malo | Aceptable | Bueno | Excelente |
|---------|------|-----------|-------|-----------|\
| Trafico organico MoM | Bajando | Estable | +5-10% | +15%+ |
| Posicion promedio | >20 | 10-20 | 5-10 | 1-5 |
| CTR organico | <1% | 1-3% | 3-5% | >5% |
| Paginas indexadas | <50% del sitio | 50-80% | >80% | >95% |
| Core Web Vitals | Rojo | Amarillo | Verde | Todo verde |

---

## Checklists

### Inicio de mes
- [ ] GSC: revisar performance mes anterior (clicks, CTR, posicion)
- [ ] Core Web Vitals: algun cambio?
- [ ] Errores de rastreo nuevos?
- [ ] Contenido del mes planificado (2-4 piezas)
- [ ] Keywords target del mes definidas
- [ ] Paginas a optimizar identificadas (posicion 4-10)

### Semanal
- [ ] GSC: queries nuevas con potencial
- [ ] Nuevo contenido publicado y indexado
- [ ] Links internos agregados a contenido nuevo
- [ ] Sin errores 404 nuevos

### Cierre de mes
- [ ] Reporte: trafico organico, keywords posicionadas, paginas top
- [ ] Comparar MoM y YoY
- [ ] Quick wins capturados (posicion 4-10 mejoradas)
- [ ] Contenido del mes siguiente planificado
