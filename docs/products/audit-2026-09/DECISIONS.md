# Noticiencias — Decision Log

Fecha inicial: 2026-09-22

Este documento conserva decisiones que deben sobrevivir a conversaciones, agentes y sesiones.

Formato:

```md
## DEC-XXX — Título

Date:
Status: Accepted / Superseded / Rejected
Context:
Decision:
Rationale:
Consequences:
```

---

## DEC-001 — La auditoría se ejecuta por waves

**Date:** 2026-09-22  
**Status:** Accepted

### Context

La auditoría contiene cambios editoriales, de contenido, UX, datos, SEO, analytics y retención.

### Decision

Implementar en waves coherentes y detenerse entre ellas para gate/revisión.

### Rationale

Evita diffs gigantes, mezcla de causas, regresiones difíciles de atribuir y pérdida de contexto.

### Consequences

Cada wave tiene rama recomendada, findings definidos, validación y reporte.

---

## DEC-002 — El backlog define objetivos, no obliga una implementación interna específica

**Date:** 2026-09-22  
**Status:** Accepted

### Decision

Los acceptance criteria son contrato. Las estructuras/campos sugeridos pueden adaptarse a la arquitectura existente.

### Consequences

El agente debe inspeccionar primero y documentar divergencias en vez de forzar abstracciones nuevas.

---

## DEC-003 — “Qué cambia” permite 0–3 items

**Date:** 2026-09-22  
**Status:** Accepted

### Decision

No hay mínimo de implicaciones.

### Rationale

Es preferible omitir una consecuencia que fabricar una relación plausible pero no respaldada.

### Consequences

Debe eliminarse cualquier validador o prompt que obligue a producir una cantidad mínima.

---

## DEC-004 — No se fuerza relevancia latinoamericana

**Date:** 2026-09-22  
**Status:** Accepted

### Decision

Una pieza puede explicar impacto regional solo cuando exista una relación directa y verificable.

### Rationale

Noticiencias sirve a lectores hispanohablantes, no debe forzar conexiones artificiales.

---

## DEC-005 — La fuente primaria tiene precedencia

**Date:** 2026-09-22  
**Status:** Accepted

### Decision

Cuando existe paper/fuente primaria verificada, tiene mayor jerarquía editorial que el medio secundario que originó el descubrimiento.

### Consequences

Los medios secundarios siguen pudiendo aparecer como contexto/cobertura.

---

## DEC-006 — El tipo de evidencia debe ser visible

**Date:** 2026-09-22  
**Status:** Accepted

### Decision

Noticiencias debe distinguir explícitamente humanos, animales, in vitro, computacional, observacional, mixed o unknown.

### Rationale

Especialmente en Salud, el usuario no debería tener que inferir el modelo experimental.

---

## DEC-007 — No duplicar contenido por responsive layout

**Date:** 2026-09-22  
**Status:** Accepted

### Decision

Responsive debe resolverse mediante layout/CSS/composición, no renderizando dos árboles semánticos equivalentes.

---

## DEC-008 — “Relacionado” requiere relación real

**Date:** 2026-09-22  
**Status:** Accepted

### Decision

Mientras el sistema solo pueda mostrar recientes, usar “Más reciente” o “Sigue leyendo”.

---

## DEC-009 — Transparencia de IA sin borrar responsabilidad editorial

**Date:** 2026-09-22  
**Status:** Accepted

### Decision

Distinguir asistencia de IA de revisión editorial. No crear identidades humanas ficticias.

---

## DEC-010 — La home es una portada curada, no un índice completo

**Date:** 2026-09-22  
**Status:** Accepted

### Decision

La home debe seleccionar y jerarquizar; el catálogo completo pertenece a categorías/temas/búsqueda.

---

## DEC-011 — “Seguir” implica persistencia o entrega

**Date:** 2026-09-22  
**Status:** Accepted

### Decision

No usar “Seguir”, “Guardar” o “Suscribirse” para simples enlaces de navegación.

---

## DEC-012 — Optimizar retorno y confianza, no volumen de publicaciones

**Date:** 2026-09-22  
**Status:** Accepted

### Decision

Las métricas de producto deben incluir retorno, profundidad, fuente primaria, segunda lectura y conversión a newsletter; pageviews no son north star suficiente.

---

# Nuevas decisiones

Añadir nuevas decisiones debajo de esta línea. No reescribir decisiones anteriores silenciosamente; si cambian, marcarlas `Superseded` y crear otra.

## DEC-013 — Ubicación real de los docs del programa

**Date:** 2026-09-23
**Status:** Accepted

### Context

`README.md` y `WAVE_EXECUTION_PROMPT.md` citan `docs/product/audit-2026-09/`,
pero los ficheros existen (untracked) en `docs/products/audit-2026-09/`.

### Decision

Conservar `docs/products/audit-2026-09/` como ubicación canónica y no
moverlos en Wave 0. Las referencias internas que digan `docs/product/`
deben leerse como `docs/products/`.

### Rationale

Mover ficheros autorados por el operador sin instrucción explícita añade
ruido; documentar la divergencia elimina la suposición para waves futuras.

### Consequences

Wave 1+ debe usar rutas `docs/products/...`. Si el operador prefiere
`docs/product/`, mover en una wave dedicada y actualizar DEC-013 a
`Superseded`.

## DEC-014 — P0-10 se implementa mínimo sobre main; PR #201 rebasea después

**Date:** 2026-09-23
**Status:** Accepted

### Context

PR #201 (`feat/trust-tone`, abierto, CI rojo por flake FU-001) ya cambia
`nosotros.md` (“No rastreamos” → “Sin rastreo publicitario”) y reescribe
`privacidad.md`. P0-10 exige alinear ese mismo copy en `main`.

### Decision

Wave 1 implementa P0-10 mínimo sobre `main` (alinear “Acerca de”/política
con la implementación, sin reescribir la política). PR #201 rebasea
después y resuelve el conflicto trivial de la línea coincidente.

### Rationale

La wave no se bloquea por un PR externo en rojo; el fix mínimo satisface
los acceptance criteria sin duplicar la reescritura de #201.

### Consequences

Revisar en #201 que su reescritura de `privacidad.md` preserve las
divulgaciones requeridas (GA4 antes de consentir, eventos, retención
14 meses, Cloudflare) — follow-up de revisión, no de Wave 1.

## DEC-015 — Par rail/sidebar aceptado como patrón responsive

**Date:** 2026-09-23
**Status:** Accepted

### Context

P0-07: `PostLayout` renderiza `ArticleRail` dos veces (inline `lg:hidden`

- sidebar `hidden lg:block`). El servidor no conoce el viewport; unificar
  en un solo nodo exigiría reubicación por JS en cliente (peor: más código
  navegador, riesgo de layout shift, contra LAW-F3).

### Decision

El par rail/sidebar se acepta: una sola variante es visible por viewport,
`display:none` la excluye también del árbol de accesibilidad (un solo
árbol semántico para AT). Lo que se elimina en P0-07 es la duplicación
visible real: la sección `Fuentes` del rail duplicaba al TrustPanel en
todos los viewports. `tests/article-sources-single.test.ts` lo custodia.

### Consequences

Futuras secciones del rail deben elegir un único dueño visible por
viewport; si TrustPanel ya muestra un dato, el rail no lo repite.

## DEC-016 — `experimental` como tipo de evidencia + lecciones del checker

**Date:** 2026-09-23
**Status:** Accepted

### Context

P0-02 listaba valores iniciales sin `experimental`; el estudio Herculano
(réplicas físicas + rayos X) no encaja en humans/animals/in_vitro/
computational/observational. Además `check-contract-sync.js` no tolera
comentarios `//` dentro del `z.object` (envenenan el campo siguiente) ni
mapeaba `str`-Enums de Python.

### Decision

1. Añadir `experimental` al enum (experimento físico de laboratorio, p. ej.
   réplicas + imagen), documentado en el espejo backend.
2. Comentarios de schema a module scope (precedente `SOCIAL_ID_RE`).
3. El checker mapea `class X(str, Enum)` a string.

### Consequences

P1-04 (Wave 4) puede usar `evidence_subject_type` para los chips
metodológicos. P0-01 y P0-02 comparten commit (archivos entrelazados);
la atomicidad por finding se preserva en ledger, no en hashes.

## DEC-017 — TrustPanel como superficie única de ficha y accountability

**Date:** 2026-09-23
**Status:** Accepted

### Context

P0-03 pedía un “componente reutilizable” de ficha; P0-09, P2-02 y P2-07
piden señales visibles al final del artículo. TrustPanel ya rendía
confianza, incertidumbre, fact-check y fuentes.

### Decision

Extender TrustPanel en vez de crear componentes nuevos (anti-patrón:
wrappers genéricos / tercera capa). Secciones condicionales, sin
placeholders: corrección → confianza → incertidumbre → modelo →
publicación → método/revisión → accountability → fact-check → primaria →
cobertura → sabidos → pendientes.

### Consequences

Wave 4+ reutiliza estos campos (chips, pre-body) sin duplicar fuentes de
verdad. Si el panel crece demasiado, dividir por secciones con datos,
no por componentes paralelos.
