# WhatsApp Marketing — Manual Completo

## Por que WhatsApp para E-commerce

- **Open rate >90%** (vs 25-40% email). El canal con mayor visibilidad.
- **Respuesta inmediata**: La gente lee WhatsApp en minutos, no horas.
- **Relacion directa**: Se siente personal, no masivo.

**ADVERTENCIA**: Es el canal mas invasivo. Mal usado = bloqueos + spam reports + numero baneado. Respetar reglas estrictamente.

---

## Compliance y Reglas

### Reglas de oro

1. **Opt-in obligatorio**: Solo enviar a personas que aceptaron recibir mensajes por WhatsApp. No importar listas de email/telefono sin consentimiento explicito.
2. **Opt-out facil**: Siempre incluir opcion para dejar de recibir ("Responde BAJA para no recibir mas").
3. **Frecuencia limitada**: Max 2-4 mensajes por semana. Menos es mas.
4. **Horarios**: Solo entre 9:00 y 20:00 hora local. Nunca fines de semana/feriados salvo emergencia.
5. **Relevancia**: Solo enviar si aporta valor real (oferta exclusiva, info de envio, recordatorio importante).
6. **Sin spam**: No reenviar cadenas, no mensajes genericos masivos, no links sospechosos.

### WhatsApp Business API vs WhatsApp Business App

| Feature | Business App | Business API |
|---------|-------------|-------------|
| Costo | Gratis | Pago (por conversacion) |
| Automatizacion | Basica (respuestas rapidas) | Completa (flows, chatbots, integraciones) |
| Difusion | Listas de hasta 256 contactos | Ilimitado (con opt-in) |
| Catalogo | Si | Si |
| Integraciones | Manual | CRM, e-commerce, email |
| Verificacion | Badge verde opcional | Badge verde (verificacion Meta) |
| Ideal para | Negocios chicos, <500 contactos | Negocios medianos/grandes, >500 contactos |

### Costos API (modelo por conversacion)

| Tipo | Quien inicia | Costo aprox (Argentina) |
|------|-------------|------------------------|
| Marketing | Negocio → usuario | ~$0.05-0.08 USD |
| Utility | Negocio → usuario (transaccional) | ~$0.02-0.03 USD |
| Authentication | Negocio → usuario (OTP) | ~$0.01-0.02 USD |
| Service | Usuario → negocio | Gratis (primeras 1000/mes) |

---

## Casos de Uso para E-commerce

### 1. Recuperacion de Carrito Abandonado

| Mensaje | Timing | Contenido |
|---------|--------|-----------|
| 1 | 1-2 horas | "Hola [nombre]! Vimos que dejaste [producto] en tu carrito. Queres que te lo guardemos? [link]" |
| 2 | 24 horas | "Ultimo aviso: tu [producto] sigue esperandote. Si compras hoy, envio gratis [link]" |

**Resultado esperado**: Recuperar 10-20% de carritos (mejor que email para urgencia).

### 2. Confirmacion de Pedido y Envio

| Mensaje | Trigger | Contenido |
|---------|---------|-----------|
| Confirmacion | Post-compra inmediato | "Tu pedido #[numero] fue confirmado! Te avisamos cuando salga" |
| En camino | Envio despachado | "Tu pedido esta en camino! Tracking: [link]" |
| Entregado | Entrega confirmada | "Recibiste tu pedido? Contanos como te fue [link review]" |

### 3. Ofertas Exclusivas (con mucho cuidado)

- Solo a segmentos que compraron antes o interactuaron recientemente
- Max 1-2 por semana
- Siempre con valor real (descuento exclusivo, acceso anticipado)
- Formato: Texto corto + imagen + link directo al producto/oferta

### 4. Atencion al Cliente

- Respuestas a consultas pre-venta (stock, talles, envio)
- Cambios y devoluciones
- Seguimiento post-venta
- **Regla**: Responder en <30 minutos durante horario laboral

### 5. Reactivacion de Clientes

- Clientes sin compra en 60-90 dias
- "Hola [nombre]! Hace tiempo que no te vemos. Tenemos novedades que te pueden gustar: [link]"
- Max 1 mensaje. Si no responde, no insistir.

---

## Automatizaciones

### Flow basico recomendado

```
TRIGGER: Nuevo suscriptor (opt-in)
  → Mensaje bienvenida inmediato
  → Esperar 24h
  → Si no compro: enviar bestsellers
  → Esperar 48h
  → Si no compro: enviar cupon primer compra
  → FIN (no insistir mas)
```

### Flow post-compra

```
TRIGGER: Compra completada
  → Confirmacion inmediata
  → Cuando se despacha: tracking
  → 3 dias post-entrega: satisfaccion + pedir review
  → 30 dias: cross-sell producto complementario
```

### Flow carrito abandonado

```
TRIGGER: Carrito abandonado (1h)
  → Recordatorio simple
  → Si no compro en 24h: recordatorio + beneficio
  → Si compro: detener flow
  → FIN (max 2 mensajes por carrito)
```

---

## Plataformas

### Opciones para Argentina/LATAM

| Plataforma | Tipo | Integracion | Precio |
|-----------|------|-------------|--------|
| **WhatsApp Business App** | Gratis, manual | Sin API | Gratis |
| **Perfit** | Email + WhatsApp | Tienda Nube nativo | Desde ~$30/mes |
| **Cliengo** | Chatbot + WhatsApp | Multi-plataforma | Desde ~$50/mes |
| **Sirena/Zenvia** | CRM + WhatsApp API | API oficial | Variable |
| **Twilio** | API pura | Desarrolladores | Pay-per-message |
| **MessageBird** | API + dashboard | API oficial | Pay-per-message |

### Integracion con E-commerce

- **Shopify**: Apps como Zoko, DelightChat, o custom via Twilio
- **Tienda Nube**: Perfit nativo, o Cliengo
- **WooCommerce**: Plugins como "WhatsApp Chat + Cart Recovery"

---

## Mensajes Efectivos

### Estructura

```
1. Saludo personalizado (nombre)
2. Contexto (por que le escribimos)
3. Valor (que gana)
4. CTA claro (link directo)
5. Opt-out (BAJA para dejar de recibir)
```

### Tipos de mensaje

| Tipo | Cuando | Ejemplo |
|------|--------|---------|
| Texto + Link | Ofertas, recordatorios | "Hola Maria! 20% OFF solo hoy: [link]" |
| Texto + Imagen | Lanzamiento producto | Foto del producto + texto + link |
| Catalogo | Multiples productos | Catalogo WhatsApp Business |
| Lista interactiva | Opciones multiples | "Que buscas? 1. Novedades 2. Ofertas 3. Ayuda" |
| Template (API) | Mensajes masivos | Templates aprobados por Meta |

### Reglas de copy

- Max 160 caracteres (ideal, no obligatorio)
- Lenguaje conversacional, como hablarias con un amigo
- Emojis: 1-2 max por mensaje
- NO todo mayusculas
- NO multiples signos de exclamacion
- Incluir nombre cuando sea posible

---

## Metricas

| Metrica | Malo | Aceptable | Bueno | Excelente |
|---------|------|-----------|-------|-----------|\
| Open Rate | <70% | 70-85% | 85-95% | >95% |
| Click Rate | <5% | 5-10% | 10-20% | >20% |
| Response Rate | <5% | 5-15% | 15-30% | >30% |
| Opt-out Rate | >2%/envio | 1-2% | <1% | <0.5% |
| Block Rate | >1% (urgente) | 0.5-1% | <0.5% | <0.2% |

**Si Block Rate >1%: PARAR inmediatamente.** Revisar frecuencia, relevancia, y opt-in.

---

## Errores Comunes

| Error | Consecuencia | Solucion |
|-------|-------------|----------|
| Enviar sin opt-in | Bloqueos, reporte spam | Solo opt-in verificado |
| Frecuencia excesiva | Opt-outs masivos | Max 2-4/semana |
| Horarios inapropiados | Molestia, bloqueos | Solo 9-20h dias habiles |
| Mensajes genericos | Baja respuesta | Personalizar siempre |
| No incluir opt-out | Viola politicas Meta | Siempre incluir BAJA |
| Usar para todo | Fatiga del canal | Solo mensajes de alto valor |
| No medir resultados | No saber si funciona | Trackear links con UTM |

---

## Checklists

### Antes de empezar
- [ ] Opt-in configurado y verificado
- [ ] Numero verificado con WhatsApp Business
- [ ] Horarios de envio definidos
- [ ] Templates aprobados (si usa API)
- [ ] Mensaje de opt-out incluido
- [ ] Catalogo cargado (si aplica)

### Mensual
- [ ] Open rate, click rate, block rate del mes
- [ ] Opt-outs vs nuevos suscriptores
- [ ] Flows automaticos funcionando?
- [ ] Respuestas pendientes atendidas?
- [ ] Contenido del proximo mes planificado
- [ ] Block rate <1%?

### Pre-envio masivo
- [ ] Segmento correcto?
- [ ] Opt-in verificado para todos?
- [ ] Horario apropiado?
- [ ] Link funciona y va al lugar correcto?
- [ ] Opt-out incluido?
- [ ] Template aprobado (API)?
- [ ] Test enviado a mi mismo?