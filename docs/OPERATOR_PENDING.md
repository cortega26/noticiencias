# Operador — pendientes de cierre

Status: Activo
Actualizado: 2026-09-23
Alcance: acciones que solo el operador puede ejecutar (dashboards, cuentas,
datos reales). El código y la documentación de cada ítem ya están en `main`.

Cómo usar: ejecuta los pasos, marca el estado y anota la evidencia en la
tabla final. Al cerrar un ítem, actualiza también su referencia en el ledger
del programa (`docs/products/audit-2026-09/IMPLEMENTATION_LEDGER.md`) o en el
roadmap que corresponda.

## 1. Analítica operativa (desbloquea el growth loop)

Sin esta sección, la instrumentación de las Waves 8 y del cierre de eventos
está activa pero no produce decisiones: no hay dimensiones que leer.

### 1.1 GA4: dimensiones personalizadas + evento clave (FU-022)

- [ ] Administrar → Definiciones personalizadas → **Dimensiones
      personalizadas** (ámbito _Evento_), crear las 13:
      `link_domain`, `search_term`, `results_count`, `form_id`,
      `article_path`, `target_path`, `related_kind`, `series_slug`,
      `topic_slug`, `category_slug`, `network`, `position`, `error_type`.
- [ ] Administrar → Eventos → marcar **`newsletter_submit`** como evento
      clave (o `newsletter_success` si se prefiere el resultado aceptado).
- Verificación: las dimensiones aparecen en Explorar (puede tardar ~24 h);
  el evento clave muestra el badge en la lista de eventos.
- Referencias: `docs/ANALYTICS_OPERATOR_CHECKLIST.md` §2,
  `docs/EDITORIAL_METRICS.md`.

### 1.2 Verificación post-deploy de GA4 + Consent Mode (plan 009)

- [ ] Seguir `docs/ANALYTICS_OPERATOR_CHECKLIST.md` → "Verificación posterior
      al deploy": cookies `_ga` ausentes antes de consentir y presentes al
      aceptar, visita en Tiempo real, Search Console enlazada, retención de
      14 meses y Google Signals apagado.
- Verificación: los cinco puntos del checklist en verde, con captura o nota.

### 1.3 Conversión confirmada del boletín (FU-024)

- [ ] Comparar `newsletter_success` (aceptado, pendiente de doble opt-in) con
      los suscriptores **confirmados** de Buttondown y anotar la tasa de
      confirmación.
- Verificación: número de confirmados / número de `newsletter_success` en el
  mismo período.
- Referencias: `docs/EDITORIAL_METRICS.md` KPI 4.

## 2. Edge / seguridad

### 2.1 Transform Rule de CSP en Cloudflare (FU-017)

- [ ] Pegar la política byte-idéntica de
      `docs/DEPLOYMENT_SECURITY_HEADERS.md` en la Response Header Transform
      Rule del edge (incluye ya `connect-src https://buttondown.com`).
- Verificación:
  `curl -sI https://noticiencias.com/ | grep -i content-security-policy`
  debe contener `connect-src` con `https://buttondown.com`.

## 3. Entregables editoriales

### 3.1 Primer informe periódico de crecimiento (`transparencia.md:27`)

- [ ] Estaba bloqueado por "003-build + 1 período de datos"; 003-build está
      DONE, así que queda habilitado tras ~1 período con §1.1 hecho.
- Contenido mínimo: visitas, retorno 7/28 días, conversión del boletín,
  CTR de relacionadas y de fuente primaria, y segunda lectura, según
  `docs/EDITORIAL_METRICS.md` (citar fórmulas y limitaciones).
- Verificación: informe publicado/enlazado desde `transparencia.md`.

### 3.2 Plan 048: decisión del registry de enriquecimiento (≥200 registros)

- [ ] Mantener la cadencia de gold-labeling (cada 50 registros; hoy 44) y, al
      llegar a **≥200**, aplicar el evaluador `make enrichment-eval` y tomar
      la decisión adopt / no-adopt con los umbrales pre-fijados (topics
      precision ≥ 0.90, sin regresión en slices críticos).
- Verificación: decisión registrada en `docs/adr/0004-*` y baseline
  comparable en `reports/evaluation/`.

## 4. Benchmark LLM

- [ ] Cuando el endpoint de GLM responda (o al ejecutar el plan 084 de
      visión), reactivar el protocolo: generate de C → judge → cross-critic →
      grounded → bundle → **ranking ciego de 12 ítems (operador)** y aplicar
      §8 mecánicamente.
- Referencias: `docs/adr/0010-llm-routing.md`,
  `reports/evaluation/llm-routing-2026-09.md`.

## 5. Decisiones de producto (operador como product owner)

- [ ] **Plan 006 (social)**: la premisa original quedó invertida; decidir el
      reframe/auditoría en vez del spike (`plans/ROADMAP.md` §2).
- [ ] **Plan 005 (recursos)**: decidir si se scopea el spike de la biblioteca
      de recursos o se aparca.
- [ ] **Notificación a lectores de correcciones** (diferido de 002): decidir
      si se implementa; la mitad frontend (schema + render) ya está en
      producción.
- [ ] **Feedback de performance social a curaduría** (diferido de 006):
      bloqueado por el reframe de 006.

## Evidencia

| Ítem                               | Fecha | Resultado | Nota / enlace |
| ---------------------------------- | ----- | --------- | ------------- |
| 1.1 Dimensiones GA4 + evento clave |       |           |               |
| 1.2 Post-deploy plan 009           |       |           |               |
| 1.3 Conversión confirmada          |       |           |               |
| 2.1 Transform Rule CSP             |       |           |               |
| 3.1 Informe de crecimiento         |       |           |               |
| 3.2 Decisión plan 048              |       |           |               |
| 4. Benchmark ranking ciego         |       |           |               |
| 5. Decisiones de producto          |       |           |               |
