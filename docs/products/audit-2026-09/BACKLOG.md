# Noticiencias — Backlog canónico de mejora editorial, UX y Growth

Fecha: 2026-09-22

## North Star

Noticiencias debe convertirse en un filtro editorial científico en español al que el lector vuelve porque:

- entiende rápidamente qué ocurrió;
- sabe qué tan sólida es la evidencia;
- distingue hallazgo de interpretación;
- puede ir a la fuente primaria;
- entiende qué todavía no sabemos;
- encuentra contenido genuinamente relacionado;
- percibe criterio editorial, no producción automática.

## Reglas globales

- Un finding no autoriza refactors no relacionados.
- No inventar datos científicos o editoriales.
- Preservar URLs/canonical/RSS/sitemap salvo plan explícito.
- Mantener compatibilidad legacy cuando sea razonable.
- Los acceptance criteria son contrato; la implementación propuesta es orientativa.
- Si la arquitectura real exige otra solución, preservar el objetivo y documentar la decisión.

---

# P0 — Confianza, rigor y errores de producto

## P0-01 — Fuente científica primaria obligatoria y visible

**Wave:** 2  
**Status inicial:** TODO  
**Depends on:** ninguno  
**Blocks:** P0-03, P1-04  
**Risk:** High

### Problem

Algunos artículos identifican como “Fuente” únicamente un medio secundario aunque exista paper/DOI/publicación primaria.

### Desired behavior

Distinguir metadata equivalente a:

- `primary_source`
- `primary_source_url`
- `doi`
- `journal`
- `publication_date`
- `secondary_sources`

Cuando exista fuente primaria verificada, debe tener mayor jerarquía que medios secundarios.

Si no existe o no pudo verificarse, declararlo explícitamente; no inventarlo.

### Non-goals

- Rehacer todo el modelo editorial.
- Backfill ciego de todo el catálogo sin verificación.

### Acceptance criteria

- [ ] Artículo con DOI muestra paper + DOI.
- [ ] Artículo sin DOI no fabrica uno.
- [ ] Fuentes secundarias siguen disponibles.
- [ ] Fuente primaria tiene mayor jerarquía.
- [ ] Legacy sigue renderizando.
- [ ] RSS/SEO no se rompe.

---

## P0-02 — Tipo de evidencia obligatorio

**Wave:** 2  
**Status inicial:** TODO  
**Depends on:** ninguno  
**Blocks:** P0-03, P1-04  
**Risk:** High

### Problem

Puede no quedar claro si un estudio fue hecho en humanos, animales, células, simulaciones u otro contexto.

### Desired behavior

Campo estructurado equivalente a:

`evidence_subject_type`

Valores iniciales:

- humans
- animals
- in_vitro
- computational
- observational
- mixed
- unknown

Permitir detalles: especie, N, fase clínica, duración y contexto experimental.

Para Salud, `unknown` debe producir guardrail fuerte y nunca permitir presentación clínica engañosa.

### Acceptance criteria

- [ ] Tipo de evidencia visible.
- [ ] Salud no presenta preclínico como clínico.
- [ ] Legacy tiene fallback seguro.
- [ ] No se infiere especie/N sin evidencia.
- [ ] Tests cubren valores válidos/unknown.

---

## P0-03 — Ficha científica estándar

**Wave:** 3  
**Status inicial:** TODO  
**Depends on:** P0-01, P0-02  
**Blocks:** ninguno  
**Risk:** Medium

### Desired behavior

Componente reusable al final del artículo con campos disponibles:

- tipo de estudio;
- sujetos/muestra;
- peer reviewed / preprint / conference / otro;
- fuente primaria;
- DOI;
- institución;
- limitación principal;
- fecha;
- fuentes secundarias.

No renderizar placeholders vacíos.

### Acceptance criteria

- [ ] Componente reutilizable.
- [ ] Datos provienen de metadata.
- [ ] Campos ausentes no generan ruido.
- [ ] Mobile correcto.
- [ ] No duplica innecesariamente información.

---

## P0-04 — QA editorial: Herculano

**Wave:** 1  
**Status inicial:** TODO  
**Depends on:** ninguno  
**Risk:** Low

### Scope

Revisar específicamente:

- papiro vs. pergamino;
- `attenuación` → `atenuación`;
- “Vesubio eruptó” u otras formulaciones torpes;
- afirmaciones sobre accesibilidad tecnológica;
- coherencia entre conclusiones y limitaciones de la fuente.

### Acceptance criteria

- [ ] Material identificado correctamente.
- [ ] Errores ortográficos conocidos corregidos.
- [ ] No hay conclusión que contradiga limitaciones.
- [ ] URL/canonical/metadata preservados.

---

## P0-05 — QA biomédico: células productoras de insulina

**Wave:** 1  
**Status inicial:** TODO  
**Depends on:** ninguno  
**Risk:** High

### Scope

Determinar desde fuente primaria:

- qué fue in vitro;
- qué fue in vivo;
- organismo/modelo receptor;
- duración;
- endpoint;
- si hubo humanos.

### Acceptance criteria

El lector puede responder inequívocamente:

- [ ] “¿Esto fue probado en personas?”
- [ ] “¿Qué organismo/modelo se utilizó?”
- [ ] No hay contradicción entre in vivo y “falta validación animal”.
- [ ] Claims corregidos contra fuente primaria.

---

## P0-06 — “Qué cambia” opcional y basado en evidencia

**Wave:** 2  
**Status inicial:** TODO  
**Depends on:** ninguno  
**Blocks:** P1-05, P2-02  
**Risk:** High

### Desired behavior

`Qué cambia` permite 0–3 items. No existe mínimo.

Eliminar requisitos de conexión regional forzada.

### Prohibido

- inventar impacto regional;
- extrapolar acceso futuro;
- convertir “podría” en “permitirá”;
- rellenar cupos.

### Acceptance criteria

- [ ] Pipeline acepta 0, 1, 2 y 3 items.
- [ ] Tests cubren cardinalidades.
- [ ] Ninguna validación exige mínimo.
- [ ] Bloque desaparece si no aporta valor.

---

## P0-07 — Eliminar contenido duplicado del DOM

**Wave:** 1  
**Status inicial:** TODO  
**Depends on:** ninguno  
**Risk:** Medium

### Investigate

Determinar si se debe a desktop/mobile duplicate rendering, SSR/hydration, composición o CSS.

### Acceptance criteria

- [ ] Un único árbol semántico por bloque.
- [ ] Headings principales no duplicados.
- [ ] Screen reader no recibe duplicados.
- [ ] HTML indexable no duplica contenido.
- [ ] Desktop/mobile mantienen diseño correcto.

---

## P0-08 — Semántica real de “Relacionado”

**Wave:** 1  
**Status inicial:** TODO  
**Depends on:** ninguno  
**Blocks:** P2-01  
**Risk:** Low

### Desired behavior

Si el algoritmo no garantiza relación semántica, renombrar temporalmente a “Más reciente” o “Sigue leyendo”.

### Acceptance criteria

- [ ] No se usa “Relacionado” para un simple feed de recientes.
- [ ] No cambia URL ni contenido del artículo.
- [ ] Copy consistente en todas las plantillas.

---

## P0-09 — Responsabilidad editorial visible

**Wave:** 3  
**Status inicial:** TODO  
**Depends on:** ninguno  
**Risk:** Medium

### Desired behavior

Metadata opcional:

- reviewer_name
- reviewer_role
- reviewer_profile_url
- review_date

Copy preciso, por ejemplo:

`Síntesis asistida por IA · revisión editorial: X`

solo si ocurrió realmente.

### Acceptance criteria

- [ ] IA y revisión humana se distinguen.
- [ ] No se fabrica identidad humana.
- [ ] Fallback institucional es veraz.
- [ ] Legacy sigue renderizando.

---

## P0-10 — Claims de privacidad alineados con implementación

**Wave:** 1  
**Status inicial:** TODO  
**Depends on:** ninguno  
**Risk:** High

### Audit

- GA4;
- Cloudflare;
- cookies;
- Consent Mode;
- local storage;
- newsletter analytics.

### Acceptance criteria

- [ ] “Acerca de” y política coinciden con implementación.
- [ ] No se usa “no rastreamos” si hay medición de comportamiento.
- [ ] Analítica se distingue de publicidad comportamental.
- [ ] No se introduce un banner de consentimiento sin necesidad verificada.

---

# P1 — Producto, UX y conversión

## P1-01 — Reconstruir jerarquía de home

**Wave:** 5  
**Status inicial:** TODO  
**Depends on:** P1-04, P1-05  
**Risk:** High

### Target architecture

1. Header
2. Hero editorial
3. Newsletter CTA
4. Esta semana
5. Serie/Dossier destacado
6. Del archivo
7. Metodología/confianza
8. Newsletter final
9. Footer

Hero: 1 principal + 2 secundarias.  
Esta semana: máximo 6.  
Del archivo: máximo 3.

### Acceptance criteria

- [ ] Home notablemente más corta.
- [ ] Primera pantalla comunica propuesta de valor.
- [ ] ≤9 historias promovidas antes de contenido secundario.
- [ ] Mobile evita scroll excesivo previo al primer CTA.
- [ ] Categorías siguen existiendo fuera de home.

---

## P1-02 — Etiquetas de actualidad honestas

**Wave:** 5  
**Status inicial:** TODO  
**Depends on:** P1-01  
**Risk:** Low

### Acceptance criteria

- [ ] Ningún bloque promete actualidad incompatible con sus fechas.
- [ ] Evergreen se identifica como archivo/selección.
- [ ] “Última edición” solo se usa si existe una edición real.

---

## P1-03 — Simplificar taxonomía/navegación

**Wave:** 5  
**Status inicial:** TODO  
**Depends on:** ninguno  
**Risk:** High

### Precondition

Inventariar categorías, tags, rutas, redirects, sitemap, RSS e internal links.

### Acceptance criteria

- [ ] Navegación primaria ≤6 entradas de contenido.
- [ ] No hay padre/hijo compitiendo al mismo nivel.
- [ ] URLs históricas siguen funcionando.
- [ ] Canonical/redirects correctos.

---

## P1-04 — Cabecera del artículo orientada a evidencia

**Wave:** 4  
**Status inicial:** TODO  
**Depends on:** P0-01, P0-02  
**Risk:** Medium

### Desired order

Categoría + fecha  
Título  
Bajada  
Chips metodológicos (máx. 3–4)  
Imagen

### Acceptance criteria

- [ ] Evidencia importante visible temprano.
- [ ] Máx. 3–4 chips iniciales.
- [ ] No parece dashboard.
- [ ] Mobile accesible.

---

## P1-05 — Simplificar bloques previos al cuerpo

**Wave:** 4  
**Status inicial:** TODO  
**Depends on:** P0-06  
**Risk:** Medium

### Desired behavior

Consolidar en:

- `Lo esencial`: máx. 3 bullets.
- `Por qué importa`: opcional, 1–2 párrafos cortos.

### Acceptance criteria

- [ ] No hay 8 bullets introductorios.
- [ ] El cuerpo comienza antes.
- [ ] “Por qué importa” puede desaparecer.
- [ ] No se pierde información crítica.

---

## P1-06 — Newsletter inline temprano

**Wave:** 6  
**Status inicial:** TODO  
**Depends on:** P1-01  
**Risk:** Medium

### Acceptance criteria

- [ ] Suscripción sin navegación extra.
- [ ] Estados loading/error/success accesibles.
- [ ] Integración de proveedor preservada.
- [ ] Sin layout shift importante.
- [ ] Copy comunica frecuencia y valor.

---

## P1-07 — Landing del newsletter orientada a conversión

**Wave:** 6  
**Status inicial:** TODO  
**Depends on:** P1-06  
**Risk:** Medium

### Include

- propuesta de valor;
- frecuencia;
- muestra/ejemplo;
- historias representativas;
- qué incluye cada edición;
- archivo si existe;
- formulario;
- privacidad básica.

### Acceptance criteria

Antes de dar email el usuario entiende:

- [ ] qué recibe;
- [ ] cuánto;
- [ ] cuándo;
- [ ] diferencia con el sitio;
- [ ] cómo luce una edición.

---

## P1-08 — “Seguir temas” solo si existe seguimiento real

**Wave:** 6  
**Status inicial:** TODO  
**Depends on:** ninguno  
**Blocks:** P2-05  
**Risk:** Low

### Acceptance criteria

- [ ] Simple navegación usa “Temas/Explorar”.
- [ ] “Seguir/Suscribirse/Guardar” solo si hay persistencia o entrega real.

---

## P1-09 — Sanear headlines legacy visibles

**Wave:** 5  
**Status inicial:** TODO  
**Depends on:** ninguno  
**Risk:** Medium

### First deliverable

Inventario de títulos problemáticos clasificados por:

- factual issue;
- hype;
- capitalization;
- misleading causality;
- acceptable.

### Acceptance criteria

- [ ] No hay sustitución ciega.
- [ ] Home no promueve títulos flagrantemente hype.
- [ ] URLs no cambian al cambiar títulos.
- [ ] Metadata/canonical preservada.

---

## P1-10 — Series como dossiers

**Wave:** 6  
**Status inicial:** TODO  
**Depends on:** ninguno  
**Risk:** Medium

### Each series should expose

- título;
- descripción;
- número de artículos;
- última actualización;
- “empieza aquí”;
- listado ordenado;
- identidad/imagen si existe.

### Acceptance criteria

- [ ] Serie se percibe como colección editorial.
- [ ] No es solo una página de tags.
- [ ] Mobile correcto.

---

# P2 — Retención, diferenciación y growth

## P2-01 — Related-content semántico

**Wave:** 7  
**Status inicial:** TODO  
**Depends on:** P0-08  
**Risk:** High

### Candidate signals

1. entidades compartidas;
2. fenómeno;
3. campo/estudio;
4. tags;
5. categoría;
6. metodología;
7. actualidad.

### Acceptance criteria

- [ ] “Últimos posts” no domina ranking.
- [ ] Casos de prueba muestran relación razonable.
- [ ] Fallback explícito cuando no hay suficiente similitud.

---

## P2-02 — “Qué sabemos / Qué no sabemos”

**Wave:** 3  
**Status inicial:** TODO  
**Depends on:** P0-06  
**Risk:** Medium

### Acceptance criteria

- [ ] 1–3 afirmaciones respaldadas cuando existan.
- [ ] 1–3 limitaciones/preguntas abiertas cuando existan.
- [ ] Ambos campos pueden omitirse.
- [ ] No se rellena layout con especulación.

---

## P2-03 — Funnel editorial en GA4

**Wave:** 8  
**Status inicial:** TODO  
**Depends on:** P1-06, P2-01  
**Risk:** Medium

### Minimum events

- article_view
- article_50
- article_90
- primary_source_click
- related_article_click
- newsletter_impression
- newsletter_start
- newsletter_submit
- series_click
- topic_click

### Acceptance criteria

- [ ] Funnel reconstruible.
- [ ] No PII.
- [ ] Eventos documentados.
- [ ] Nombres/params consistentes.

---

## P2-04 — KPIs de retención/editorial

**Wave:** 8  
**Status inicial:** TODO  
**Depends on:** P2-03  
**Risk:** Low

### Deliverable

`docs/EDITORIAL_METRICS.md`

Definir:

- returning visitor rate;
- 7-day return;
- 28-day return;
- newsletter conversion;
- related-content CTR;
- primary-source CTR;
- article completion;
- second-article rate.

### Acceptance criteria

- [ ] Definición.
- [ ] Fórmula.
- [ ] Evento fuente.
- [ ] Interpretación.
- [ ] Limitaciones.

---

## P2-05 — Seguimiento real de temas

**Wave:** 7  
**Status inicial:** TODO  
**Depends on:** P1-08, P2-06  
**Risk:** High

### MVP options

- email por tema;
- RSS temático;
- preferencias de newsletter.

No requiere cuenta inicialmente.

### Acceptance criteria

- [ ] “Seguir” produce persistencia o entrega real.
- [ ] No se necesita cuenta si existe alternativa más simple.
- [ ] Unsubscribe/unfollow claro.

---

## P2-06 — Hubs temáticos de alta calidad

**Wave:** 7  
**Status inicial:** TODO  
**Depends on:** P1-03  
**Risk:** Medium

### Candidate blocks

- explicación;
- última actualización;
- historias esenciales;
- cronología;
- artículos recientes;
- series relacionadas;
- FAQ;
- newsletter/RSS.

### Acceptance criteria

- [ ] No crear hubs vacíos.
- [ ] Solo temas con masa crítica.
- [ ] Internal linking coherente.
- [ ] No canibalizar categorías sin plan.

---

## P2-07 — Historial visible de correcciones

**Wave:** 3  
**Status inicial:** TODO  
**Depends on:** ninguno  
**Risk:** Low

### Metadata

- corrected_at
- correction_summary

### Acceptance criteria

- [ ] Correcciones sustantivas visibles.
- [ ] Typos menores no requieren historial público.
- [ ] Trazabilidad persiste en metadata.
