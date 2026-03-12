# Google Ads & Shopping — Manual Completo

## Como Funciona Google Ads para E-commerce

Google captura **demanda existente**. Cuando alguien busca "zapatillas running mujer", ya tiene intencion de compra. CVR mas alto que Meta, pero audiencia mas acotada.

**Combo correcto**: Meta genera demanda → Google la captura. Son complementarios.

### Formatos principales

| Formato | Que es | Cuando usar |
|---------|--------|------------|
| **Shopping** | Producto con foto+precio en resultados | Formato estrella e-commerce |
| **Search** | Anuncios de texto por keywords | Brand protection, intent alto |
| **Performance Max** | Combina Shopping+Search+Display+YouTube+Gmail | Principal recomendado 2024-2025 |
| **Demand Gen** | Visual en YouTube/Gmail/Discover | Retargeting visual (similar a Meta) |

---

## Google Merchant Center

### Flujo: Tienda → Feed → Merchant Center → Google Ads

| Plataforma | Conexion |
|-----------|----------|
| Shopify | App "Google & YouTube" — sincronizacion automatica |
| Tienda Nube | Marketing → Google Shopping — nativo |
| WooCommerce | Plugin "Google Listings & Ads" |

### Errores comunes

| Error | Causa | Solucion |
|-------|-------|----------|
| Precio no coincide | Feed ≠ sitio | Verificar sincronizacion |
| Imagen baja calidad | <800x800px | Imagenes minimo 800x800 |
| Titulo corto | Generico | Formula: [Marca]+[Tipo]+[Feature]+[Color/Talle] |
| URL no rastreable | Sitio/robots | Verificar pagina indexable |
| Sin GTIN | Falta codigo barras | Agregar o marcar identifier_exists=no |

### Optimizacion del feed

**Titulo** (lo mas importante): `[Marca] + [Tipo de Producto] + [Caracteristica] + [Color/Talle]`
- Malo: "Remera Azul"
- Bueno: "Nike Remera Dri-FIT Running Hombre Azul Talle M"

**Imagenes**: Min 800x800, fondo blanco, sin texto, producto centrado
**Precio**: Exacto al del sitio
**Descripcion**: Min 150 palabras con keywords naturales

---

## Estructura de Campanas

### 1. Performance Max (principal)

```
pMax — [Cliente] — [Mes] — General
  Asset Group 1: Categoria principal (fotos, videos, titulares, descripciones)
    Audience Signals: compradores (Customer Match), visitantes (remarketing), in-market
  Asset Group 2: Categoria secundaria
```

**Audience Signals = sugerencias, NO restricciones.** Google puede expandir.

### 2. Search Brand (proteccion de marca)

```
Search Brand — [Cliente] — Proteccion
  Keywords: [marca] exact + "marca" phrase + variaciones
```

CPC muy barato, ROAS muy alto. Sin esta campana, competidores roban tu trafico.

### 3. Search Non-brand (intent alto)

```
Search Non-Brand — [Cliente] — [Categoria]
  Ad Group 1: [producto] + comprar (phrase + exact)
  Ad Group 2: [producto] + [beneficio]
  Keywords negativas: gratis, segunda mano, como hacer, diy
```

---

## RSA (Responsive Search Ads)

Cargar 10+ titulares (30 chars) y 4 descripciones (90 chars). Tipos: marca, producto, beneficio, urgencia, social proof, CTA, keyword insertion.

**Quality Score objetivo: 7+** (relevancia + CTR esperado + experiencia landing)

---

## Metricas

### ROAS break-even por margen

| Margen | ROAS minimo | ROAS objetivo |
|--------|------------|---------------|
| 20% | 5.0x | 7x+ |
| 30% | 3.3x | 5x+ |
| 40% | 2.5x | 4x+ |
| 50% | 2.0x | 3x+ |

### CTR por formato

| Formato | Bueno | Excelente |
|---------|-------|-----------|
| Shopping/pMax | >1.5% | >3% |
| Search Non-brand | >5% | >8% |
| Search Brand | >10-15% | >20% |

### Impression Share

- Keywords principales: >60%
- Keywords marca: >80% (ideal >95%)

---

## Configuracion de Conversiones

**Opcion 1 (recomendada)**: Importar desde GA4 (purchase → Key Event → importar en Ads)
**Opcion 2**: Tag directo Google Ads en pagina de confirmacion

**Verificar siempre**: Tag Assistant + compra de prueba + confirmar en panel conversiones (24hs)

---

## Optimizacion

### pMax semanal
- ROAS check 7 dias vs objetivo
- Merchant Center: errores nuevos?
- pMax Insights: que funciona
- Si ROAS bueno 7+ dias: escalar +10-20%

### Search semanal
- Search Terms Report: agregar buenas keywords + negativas
- Quality Score de principales (>7?)
- CTR check

---

## Errores Comunes

| Error | Solucion |
|-------|----------|
| No revisar Merchant Center | Diagnosticos mensual minimo |
| Sin keywords negativas | Search Terms Report semanal |
| Feed desactualizado | Sincronizacion automatica |
| Sin conversion tracking | Verificar ANTES de lanzar |
| Escalar >50% de golpe | Max +20% por semana |
| No separar Brand Search | Siempre campana separada |
| Titulos genericos | Invertir en formula de titulo |

---

## Alertas y Diagnostico

| Situacion | Accion |
|-----------|--------|
| Productos desaprobados GMC | Revisar diagnosticos, corregir |
| ROAS < objetivo 3 dias | Revisar feed, landing, competencia |
| CTR <1% Shopping | Mejorar imagenes, precios, titulos |
| Impression Share cae | Revisar presupuesto y Quality Score |
| Conversiones = 0 | Verificar tag urgente |
| ROAS Brand cae | Competidor pujando, revisar Auction Insights |

---

## Checklists

### Inicio de mes
- [ ] ROAS y CPA mes anterior por campana
- [ ] Merchant Center sin errores
- [ ] Tag conversion activo (compra prueba si dudas)
- [ ] Presupuesto diario vs objetivos mensuales
- [ ] Impression Share Brand >80%
- [ ] Assets pMax actualizados si hay novedades

### Semanal
- [ ] Search Terms Report → agregar negativas
- [ ] ROAS semanal vs objetivo
- [ ] Merchant Center errores nuevos?
- [ ] Anuncios desaprobados?
- [ ] Quality Score principales

### Cierre de mes
- [ ] Reporte: ROAS, CPA, Clics, Impresiones, CTR, IS por campana
- [ ] Aprendizajes: mejor campana, mejores keywords
- [ ] Productos con 0 impresiones (error feed?)
- [ ] Ajustes presupuesto mes siguiente
