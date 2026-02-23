# Estrategia Meta con IA: Guia para Paid Media
Esta documentacion explica como integrar el **AI Analyzer** en el flujo de trabajo diario de gestion de pauta.

---

## 1. El Flujo de Trabajo (Workflow)
El sistema no reemplaza al Media Buyer, sino que actua como un **Analista Jr. 24/7** que audita cada cuenta.

1.  **Mañana (09:00 - 10:00 AM)**: Revisar el reporte automático en Slack.
    *   **KPI Snapshot**: Resumen acumulado del mes (Gasto, CPA, ROAS).
    *   **Alert Digest**: Listado de acciones recomendadas por la IA basadas en la data de hoy.
2.  **Durante el día**: Reaccionar a las `Alertas Críticas` inmediatas.
    *   Si recibes un `Budget Bleed`, entra a Meta y apaga el asset.
    *   Si recibes una `Scaling Opportunity`, evalúa si el stock/operación permite escalar presupuesto.
    *   Si recibes una alerta de `Account Health`, verifica el estado de la cuenta en Meta Business Manager.
3.  **Semanalmente**: Auditoria de Creativos en el `Creative Intel`.
    *   Filtra por "High Opportunity" para encontrar ganadores infra-presupuestados.
    *   Revisa la **clasificacion automatica** de cada creativo (ver seccion 7).
    *   Usa el boton "Generate Variants" para pedirle a la IA nuevas ideas de copy basadas en lo que ya esta funcionando.

---

## 2. Entendiendo los Semaforos
*   Verde (Bajo Riesgo): Eficiencia solida. Mantener o Escalar.
*   Amarillo (Atencion): Desviaciones ligeras, fatiga incipiente o riesgo de reinicio de aprendizaje. Monitorear.
*   Rojo (Critico): Gasto sin resultados o pico de CPA insostenible. **Accion requerida.**

---

## 3. Configuracion por Cliente (Tuning)
Cada cliente es un mundo. Un e-commerce de $50 USD de ticket no se optimiza igual que una captacion de Leads inmobiliarios.

*   **E-commerce**: Prioriza `Purchases` y `ROAS`. El algoritmo es agresivo detectando "Fugas de Presupuesto".
*   **Lead Gen**: Prioriza el volumen y costo por Lead. El algoritmo ignora el valor de carrito y se enfoca en la estabilidad del CPL.
*   **Ajuste de Sensibilidad**: Si recibes demasiadas alertas de Fatiga, puedes subir el `Frequency Threshold` a 5 o 6 en la seccion de Administracion.

### Perfil de Negocio (Nuevo)
Ahora cada cliente tiene un **Perfil de Negocio** configurable desde Administracion > Editar Cliente:

*   **Modo de Crecimiento** (`conservative` / `balanced` / `aggressive`): Define que tan sensible es el sistema a variaciones de metricas. En modo agresivo, tolera mas volatilidad antes de alertar.
*   **Tolerancia a Fatiga** (`low` / `medium` / `high`): Ajusta los umbrales de frecuencia. Un cliente con tolerancia alta no recibira alertas hasta frecuencias mas elevadas.
*   **Velocidad de Escalamiento** (`slow` / `moderate` / `fast`): Controla las alertas de reinicio de aprendizaje. En modo rapido, el sistema tolera cambios de presupuesto mas grandes.
*   **Prioridad de Embudo** (`tofu` / `mofu` / `bofu`): Le dice al sistema que etapa del embudo priorizar en el analisis y recomendaciones.
*   **LTV (Lifetime Value)**: Valor de vida del cliente, usado para calcular ROAS real.

---

## 4. Mejores Practicas de Escalamiento
La IA esta programada para detectar el **Riesgo de Reinicio de Aprendizaje**.
*   Meta recomienda no cambiar el presupuesto mas de un 20% por dia.
*   Nuestra alerta saltara si haces un cambio de >30%.
*   **Consejo**: Si quieres duplicar el presupuesto, hazlo en pasos de 20% cada 48hs para mantener las metricas estables.

---

## 5. El Motor de Intencion (Intent Engine)
El sistema clasifica cada anuncio en una etapa del embudo basada en su comportamiento relativo al resto de la cuenta:

*   **TOFU (Top of Funnel)**: Contenido de prospeccion. Alto alcance, CTR moderado pero baja tasa de conversion directa.
*   **MOFU (Middle of Funnel)**: Contenido de consideracion. Buen engagement y senales de intencion pero volumen irregular de ventas.
*   **BOFU (Bottom of Funnel)**: Contenido de cierre. Alta tasa de conversion y CPA eficiente. Es donde el algoritmo busca escalar.

### Como se calcula?
No es arbitrario. La IA utiliza un **Score de Intencion** (0 a 1) ponderando:
1.  **FITR (30%)**: Compras sobre Clics (la calidad del click).
2.  **CR (25%)**: Compras sobre Impresiones.
3.  **CPA (25%)**: Eficiencia de costo.
4.  **CTR (20%)**: Relevancia del anuncio.

**Importante:** Se aplica una **Penalidad de Volatilidad** si el anuncio tiene pocas impresiones (< 2000), bajando su score automaticamente para evitar conclusiones apresuradas con poca data.

---

## 6. Glosario de Metricas IA
*   **Hook Rate (3s view / Imp)**: Que tan efectivo es el inicio del video para detener el scroll.
*   **Efficiency Score**: Un puntaje de 0 a 100 que cruza ROAS, CPA y Estabilidad.
*   **Structural State**: Analiza si la cuenta esta muy fragmentada (muchos adsets con poco presupuesto) o consolidada de forma optima.

---

## 7. Clasificacion Automatica de Creativos (Nuevo)
El sistema clasifica automaticamente cada creativo en una de **6 categorias** basandose en su rendimiento:

| Categoria | Que significa | Accion sugerida |
|-----------|--------------|-----------------|
| **Dominante Escalable** | Alto gasto + CPA eficiente. Tu mejor creativo. | Escalar presupuesto gradualmente |
| **Ganador Saturandose** | Fue eficiente pero muestra fatiga (frecuencia alta, CPA subiendo). | Rotar variantes, bajar presupuesto |
| **BOFU Oculto** | Poco presupuesto pero excelentes metricas de conversion. Joya escondida. | Subir presupuesto inmediatamente |
| **TOFU Ineficiente** | Mucho gasto + poca eficiencia. Quema presupuesto. | Pausar o reestructurar |
| **Zombie** | Gasto minimo, resultados minimos. No aporta. | Pausar o refrescar creativo |
| **Nuevo (Data Insuficiente)** | Menos de 48h activo o <2000 impresiones. | Esperar antes de decidir |

Esta clasificacion aparece en el **Creative Intel** y te permite priorizar rapidamente que creativos necesitan atencion.

---

## 8. Salud de Cuenta (Account Health) (Nuevo)
El sistema monitorea automaticamente el **estado de tu cuenta de Meta Ads** cada 2 horas:

*   **Estado de cuenta**: Detecta si la cuenta pasa de activa a deshabilitada, no liquidada, o con cualquier problema.
*   **Spend Cap (Tope de gasto)**: Te alerta cuando el gasto acumulado se acerca al tope configurado en Meta (>80% del limite).
*   **Transiciones**: Si el estado de la cuenta cambia, recibes una alerta inmediata en Slack.

Esto te evita sorpresas como descubrir a las 3 PM que tu cuenta fue pausada por Meta a las 9 AM.
