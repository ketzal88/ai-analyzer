# Glosario de Metricas — Referencia Rapida

## Metricas de Adquisicion (Paid Media)

| Metrica | Definicion | Formula | Benchmark |
|---------|-----------|---------|-----------|
| **ROAS** | Return on Ad Spend | Revenue / Spend | Depende del margen (ver tabla abajo) |
| **CPA** | Costo por Adquisicion (compra) | Spend / Conversiones | Menor al margen bruto del producto |
| **CPL** | Costo por Lead | Spend / Leads | Varia por industria ($5-50) |
| **CPC** | Costo por Clic | Spend / Clics | Meta: $0.30-1.50 / Google: $0.50-3.00 |
| **CPM** | Costo por Mil Impresiones | (Spend / Impresiones) × 1000 | Meta: $5-15 / Google: $3-10 |
| **CTR** | Click-Through Rate | Clics / Impresiones × 100 | Meta: >1% / Google Search: >5% |
| **CVR** | Conversion Rate (de clic a compra) | Conversiones / Clics × 100 | 2-5% (depende del canal) |
| **Impression Share** | Porcentaje de impresiones capturadas | Impresiones / Impresiones elegibles × 100 | Brand: >80% / Non-brand: >60% |
| **Frequency** | Veces que un usuario vio el anuncio | Impresiones / Alcance | 1-3 (normal) / >4 (fatiga) |
| **Reach** | Personas unicas que vieron el anuncio | Usuarios unicos alcanzados | Depende del presupuesto |

### ROAS Break-Even por Margen

| Margen Bruto | ROAS Minimo (break-even) | ROAS Objetivo |
|-------------|-------------------------|---------------|
| 20% | 5.0x | 7x+ |
| 30% | 3.3x | 5x+ |
| 40% | 2.5x | 4x+ |
| 50% | 2.0x | 3x+ |
| 60% | 1.7x | 2.5x+ |

---

## Metricas de Video (Meta Ads)

| Metrica | Definicion | Formula | Benchmark |
|---------|-----------|---------|-----------|
| **Hook Rate** | Personas que vieron 3+ segundos | 3s Views / Impresiones × 100 | >25% bueno, >35% excelente |
| **Hold Rate** | De los que engancharon, cuantos completaron | ThruPlays / 3s Views × 100 | >20% bueno, >30% excelente |
| **Completion Rate** | Vieron el video completo | p100 / Video Plays × 100 | >15% bueno |
| **Drop-off Point** | Donde se pierde mas audiencia | Mayor caida entre p25/p50/p75/p100 | Diagnostico, no benchmark |
| **ThruPlay** | Vio 15s o el video completo (lo que sea menor) | Conteo automatico Meta | — |

---

## Metricas de E-commerce

| Metrica | Definicion | Formula | Benchmark |
|---------|-----------|---------|-----------|
| **Revenue** | Ingresos totales | Suma de ventas | Objetivo mensual del negocio |
| **AOV** | Average Order Value | Revenue / Ordenes | Depende de la industria |
| **Orders** | Cantidad de pedidos | Conteo de transacciones | — |
| **Cart Abandonment Rate** | Carritos no completados | (Carritos - Compras) / Carritos × 100 | 60-80% (normal) |
| **CVR Sitio** | Conversion rate del sitio | Compras / Sesiones × 100 | 1-3% |
| **Bounce Rate** | Sesiones de una sola pagina | Bounces / Sesiones × 100 | <40% bueno |
| **Revenue per Session** | Ingreso por sesion | Revenue / Sesiones | >$1 bueno (varia) |
| **Items per Order** | Productos por pedido | Items vendidos / Ordenes | >1.5 bueno |

---

## Metricas de Cliente / Retencion

| Metrica | Definicion | Formula | Benchmark |
|---------|-----------|---------|-----------|
| **LTV** | Lifetime Value | Revenue promedio × Compras promedio × Vida util | >3x CAC |
| **CAC** | Costo de Adquisicion de Cliente | Spend total / Clientes nuevos | <LTV/3 |
| **LTV:CAC Ratio** | Rentabilidad del cliente | LTV / CAC | >3:1 bueno, >5:1 excelente |
| **Repeat Purchase Rate** | Tasa de recompra | Clientes con 2+ compras / Total clientes × 100 | >20% bueno |
| **Days Between Purchases** | Frecuencia de compra | Promedio de dias entre 1ra y 2da compra | Depende del producto |
| **Churn Rate** | Tasa de perdida de clientes | Clientes perdidos / Total clientes × 100 | <5% mensual |
| **NPS** | Net Promoter Score | % Promotores - % Detractores | >50 excelente |

---

## Metricas de Email

| Metrica | Definicion | Formula | Benchmark |
|---------|-----------|---------|-----------|
| **Open Rate** | Tasa de apertura | Aperturas unicas / Enviados × 100 | >25% bueno, >40% excelente |
| **Click Rate** | Tasa de clics | Clics unicos / Enviados × 100 | >3% bueno, >5% excelente |
| **CTOR** | Click-to-Open Rate | Clics unicos / Aperturas unicas × 100 | >10% bueno, >15% excelente |
| **Unsubscribe Rate** | Tasa de baja por envio | Bajas / Enviados × 100 | <0.2% bueno |
| **Bounce Rate (email)** | Emails no entregados | Rebotes / Enviados × 100 | <2% bueno |
| **Spam Rate** | Reportes de spam | Spam reports / Enviados × 100 | <0.08% (obligatorio) |
| **List Growth Rate** | Crecimiento de lista | (Nuevos - Bajas) / Total × 100 | >2% mensual bueno |
| **Email Revenue** | Ingresos atribuidos a email | Revenue tracking 5d post-click | 20-30% del revenue total |

**Nota iOS**: Apple Mail Privacy Protection infla open rates desde 2021. Cruzar con click rate para engagement real.

---

## Metricas de SEO

| Metrica | Definicion | Fuente | Benchmark |
|---------|-----------|--------|-----------|
| **Organic Traffic** | Visitas desde busqueda organica | GA4 | Crecimiento MoM >5% |
| **Keyword Rankings** | Posicion en resultados de busqueda | GSC / Ahrefs | Top 10 para principales |
| **Organic CTR** | CTR en resultados de busqueda | GSC | >3% bueno, >5% excelente |
| **Indexed Pages** | Paginas indexadas por Google | GSC | >80% del sitio |
| **Domain Authority** | Autoridad del dominio | Ahrefs/Moz | Relativo a competencia |
| **Backlinks** | Links entrantes de otros sitios | Ahrefs | Calidad > cantidad |
| **Core Web Vitals** | Performance del sitio | PageSpeed | LCP <2.5s, INP <200ms, CLS <0.1 |

---

## Metricas de WhatsApp

| Metrica | Definicion | Benchmark |
|---------|-----------|-----------|
| **Open Rate** | Tasa de lectura del mensaje | >90% |
| **Click Rate** | Tasa de clics en links | >10% bueno |
| **Response Rate** | Tasa de respuesta | >15% bueno |
| **Opt-out Rate** | Bajas por envio | <1% |
| **Block Rate** | Bloqueos del numero | <0.5% (>1% = parar) |

---

## Metricas Consolidadas (Cross-Channel)

| Metrica | Definicion | Formula |
|---------|-----------|---------|
| **Blended ROAS** | ROAS combinado de todos los canales paid | Revenue ecommerce / (Spend Meta + Spend Google) |
| **MER** | Marketing Efficiency Ratio | Revenue total / Gasto total marketing |
| **% Revenue por Canal** | Distribucion de ingresos | Revenue canal / Revenue total × 100 |
| **nCAC** | New Customer Acquisition Cost | Spend total / Clientes nuevos |

**Regla de deduplicacion**: Ecommerce = source of truth para revenue. No sumar revenue de Meta + Google + Email (cada uno se lo atribuye).
