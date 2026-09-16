# ROADMAP — De los spikes a la operación

> Alcance: los 6 planes de dirección en `plans/` (001–006), planificados
> contra el commit `8af478b` (2026-09-15) sobre el repo front-end
> `noticiencias`. El back-end (`noticiencias_news_collector`) no fue
> auditado; donde un plan lo toca, se marca como supuesto a confirmar.
>
> Este archivo cumple cuatro funciones a la vez:
>
> 1. **Backlog** — qué falta, en qué orden, con su estado (§2, §3).
> 2. **Guía** — cómo ejecutar cada Wave sin improvisar (§4).
> 3. **Scoreboard** — tablero de avance que se actualiza al cerrar cada plan (§3).
> 4. **Trazabilidad** — de hallazgo → spike → ADR → build → deploy (§5, §6).
>
> Si este archivo se promueve a la raíz como `ROADMAP.md`, actualizar los
> enlaces relativos (`001-*.md` → `plans/001-*.md`).

## §1. Waves — agrupación de ejecución

Los 6 spikes son independientes entre sí (sin dependencias duras; solo
comparten `plans/README.md` para las filas de estado). Las Waves optimizan
la atención de revisión, no un orden técnico: cada Wave agrupa spikes que se
revisan con el mismo "sombrero" y cuyos resultados alimentan a la Wave
siguiente.

### Wave 1 — Señal y promesa mayor (arrancar aquí)

| Plan | Título                   | Por qué va primero                                                                                                                                              |
| ---- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 003  | Traffic analytics spike  | Su respuesta (qué medir y con qué) ordena 004/005 y desbloquea la pregunta diferida de ADR-0008. Es el spike más barato (S–M) con mayor poder de secuenciación. |
| 001  | Newsletter backend spike | La promesa incumplida más visible (página + guía de hype + homepage venden un boletín que no existe). P1.                                                       |

Paralelizables entre sí. Criterio de salida: ADRs 0009 y 0011 en `Proposed`
y revisados por el maintainer.

### Wave 2 — Confianza operativa

| Plan | Título                  | Por qué va en segundo lugar                                                                                                                                                             |
| ---- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 002  | Corrections loop spike  | Cierra el ciclo reporte→corrección visible que `transparencia.md` promete. P1, pero su build toca proceso editorial humano: conviene decidirlo con la cabeza fría de Wave 1 ya cerrada. |
| 006  | Social graduation spike | Modo espejo de 002: otro "sumidero invisible" (ledger en rama `social-state`, dashboard sin superficie social). Misma lente de revisión (observabilidad antes de automatizar).          |

Paralelizables entre sí. Criterio de salida: ADR 0010 en `Proposed` + decisión
de reframe 006 registrada (auditoría retroactiva en vez de ADR-0012; ver §6).
Nota de eficiencia: 002-difiere-notificación-lector necesita 001 vivo; el
defer de feedback social de 006 necesita 003 + reframe/auditoría (ya no
"graduación"). Registrar esos hilos en §6 al cerrar.

### Wave 3 — Contenido y superficie

| Plan | Título                 | Por qué va al final                                                                                                                      |
| ---- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 004  | Series fate spike      | Decisión binaria barata (S) que rinde más con datos de 003 (¿se lee por secciones?).                                                     |
| 005  | Recursos library spike | El brief de 3 guías se escribe mejor sabiendo qué proveedor de email (001) y qué métricas (003) existirán para distribuirlas y medirlas. |

Paralelizables entre sí. Criterio de salida: veredicto registrado (004) y
brief aprobado (005).

### Wave 4 — Builds (planes 007–008 redactados; resto al cerrar sus spikes)

Orden de builds decidido (revisión Wave 1, §6): 007 (003-build, observabilidad
aditiva, sin prerrequisitos) → 008 (001-build, puerta: pregunta abierta 3
resuelta) → 002-build → 006-reframe (auditoría retroactiva + observabilidad, candidato plan 009) → 005-guías → 004-veredicto. 007 y 008
nunca en paralelo (ambos tocan `src/config.yaml` + `CommonMeta.astro:11`).
Regla: ningún build arranca sin su ADR en `Accepted`.

## §2. Backlog — estado y orden recomendado

Orden global recomendado (cruza las Waves por leverage):

| #   | Ítem                                                                         | Tipo       | Estado                                                                                          |
| --- | ---------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------- |
| 1   | 003 traffic analytics spike                                                  | spike      | DONE 2026-09-15 (ADR-0011 Proposed)                                                             |
| 2   | 001 newsletter backend spike                                                 | spike      | DONE 2026-09-15 (ADR-0009 Proposed)                                                             |
| 3   | 002 corrections loop spike                                                   | spike      | DONE 2026-09-15 (ADR-0010 Proposed)                                                             |
| 4   | 006 social graduation spike                                                  | spike      | BLOCKED — flag `true` desde 2026-09-14, premisa respondida; reframe pendiente (§6)              |
| 5   | 004 series fate spike                                                        | spike      | TODO                                                                                            |
| 6   | 005 recursos library spike                                                   | spike      | TODO                                                                                            |
| 7   | ADRs 0009–0011: revisión y `Accepted`/rechazo (+ reframe 006 en vez de 0012) | decisión   | BLOQUEADO por 1–6                                                                               |
| 8   | Builds 007 (003-build) y 008 (001-build)                                     | build      | TODO (007 listo para ejecutar tras ADR-0011 Accepted; 008 tras ADR-0009 Accepted + Q3 resuelta) |
| 9   | Primer informe periódico de crecimiento (`transparencia.md:27`)              | entregable | BLOQUEADO por 003-build + 1 período de datos                                                    |
| 10  | Notificación a lectores de artículos corregidos (defer de 002)               | entregable | BLOQUEADO por 001-build + 002-build                                                             |
| 11  | Feedback de performance social a curaduría (defer de 006)                    | entregable | BLOQUEADO por 003-build + 006-reframe (auditoría)                                               |

Ítems diferidos heredados de los planes (no perder): guías #4+ y
traducciones (005), índice público `/correcciones/` (002), elementos
interactivos en guías (005, solo con evidencia), exclusión de ruta del
Worker revisitada con datos reales (003/ADR-0008), adaptadores de nuevas
redes tras un mes estable (006), copy A/B del formulario (001, necesita 003).

## §3. Scoreboard — actualizar al cerrar cada plan

Un ejecutor marca `DONE` solo cuando la fila de Done criteria de su plan
está completa. Mantener una fila por plan; no borrar filas, solo avanzar
el estado.

| Plan | ADR/brief objetivo                    | Estado  | Rama                                   | Commit/PR                                 | Verificado por                                                                                                                                                                          | Fecha cierre |
| ---- | ------------------------------------- | ------- | -------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 001  | `docs/adr/0009-newsletter-backend.md` | DONE    | `advisor/001-newsletter-backend-spike` | `714caa9` + PR #169 (revisión/acceptance) | advisor re-run: lint+validate+doc-drift+test:audit(648) OK; alcance 1 archivo; sin secretos                                                                                             | 2026-09-15   |
| 002  | `docs/adr/0010-correction-policy.md`  | DONE    | `advisor/002-correction-policy-spike`  | `c617fc0` + PR #171 (revisión/acceptance) | advisor re-run: lint+validate+doc-drift+test:audit OK; alcance 1 archivo; record R2 verificado línea por línea; sin PII                                                                 | 2026-09-15   |
| 003  | `docs/adr/0011-traffic-analytics.md`  | DONE    | `advisor/003-traffic-analytics-spike`  | `00f0b50` + PR #170 (revisión/acceptance) | advisor re-run: lint+validate+doc-drift+test:audit(648) OK; alcance 1 archivo; sin secretos                                                                                             | 2026-09-15   |
| 004  | veredicto en `plans/README.md`        | TODO    | —                                      | —                                         | —                                                                                                                                                                                       | —            |
| 005  | `docs/recursos-library-brief.md`      | TODO    | —                                      | —                                         | —                                                                                                                                                                                       | —            |
| 006  | `docs/adr/0012-social-graduation.md`  | BLOCKED | —                                      | —                                         | STOP correcto del ejecutor: `SOCIAL_PUBLISH_ENABLED=true` desde 2026-09-14 (verificado por advisor vía API) + 2 posts con opt-in → el piloto YA publica sin checklist ni observabilidad | 2026-09-15   |

Estados: TODO | IN PROGRESS (con fecha de inicio) | DONE | BLOCKED (motivo en una línea) | REJECTED (justificación en una línea).
Salud de la Wave: una Wave está sana si ningún plan lleva >7 días en
IN PROGRESS sin actualización y ningún BLOCKED carece de dueño.

## §4. Guía — cómo ejecutar una Wave

1. **Abrir la Wave**: anunciar qué planes entran y quién revisa (los spikes
   001/003 piden lente de privacidad; 002/006, lente editorial/ops; 004/005,
   lente de contenido).
2. **Despachar ejecutores** (uno por plan, en paralelo dentro de la Wave):
   cada uno lee su plan completo, corre el drift check contra `8af478b`, y
   respeta los STOP conditions — ante deriva o premisa respondida, se
   reporta, no se improvisa.
3. **Ramas**: `advisor/NNN-<slug>` según cada plan; commits convencionales
   (`docs: ...`). No push/PR salvo indicación del operador.
4. **Puertas de verificación por plan**: `npm run lint`,
   `npm run validate:content`, `npm run check:doc-drift`, `npm run test:audit`
   (todos `declared`: leídos de `package.json`/`AGENTS.md`, no ejecutados
   durante el análisis — un fallo en checkout limpio es baseline roto, no
   regresión del ejecutor).
5. **Cerrar el plan**: marcar DONE en §3 y en `plans/README.md` solo con
   todos los Done criteria cumplidos; enlazar rama/commit en el scoreboard.
6. **Cerrar la Wave**: verificar su criterio de salida (§1) y registrar
   hilos diferidos en §6 antes de abrir la siguiente.
7. **Reglas duras**: ningún secreto (nombres de credenciales sí, valores
   nunca); páginas de política (`privacidad.md`, `transparencia.md`) no se
   editan en spikes (solo se proponen textos); cambios de schema
   (`src/content.config.ts`) son contrato cross-repo y pertenecen a builds,
   no a spikes.

## §5. Trazabilidad — cadena por plan

Formato de registro (una línea por eslabón, con enlaces cuando existan):

`- [plan] → spike <rama/commit> → ADR <estado> → build <plan/PR> → deploy <fecha> → verifica <comando>`

| Plan | Hallazgo origen                                                                          | Spike                | ADR/brief (estado)                                                             | Build | Deploy/efecto |
| ---- | ---------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------ | ----- | ------------- |
| 001  | Boletín prometido sin backend (`config.yaml:85` vacío; hype-guide promete envío viernes) | `714caa9` 2026-09-15 | 0009 Proposed (Buttondown)                                                     | —     | —             |
| 002  | Correcciones prometidas sin salida visible (intake R2 sí, display no)                    | `c617fc0` 2026-09-15 | 0010 Proposed (frontmatter `corrections:`, Opción A)                           | —     | —             |
| 003  | Cero señal de tráfico; pregunta diferida ADR-0008                                        | `00f0b50` 2026-09-15 | 0011 Proposed (Cloudflare WA)                                                  | —     | —             |
| 004  | `/series/` placeholder con 0 posts usando `series:`                                      | —                    | veredicto (pendiente)                                                          | —     | —             |
| 005  | `/recursos/` con 1 sola página; sección con relleno                                      | —                    | brief (pendiente)                                                              | —     | —             |
| 006  | Publisher piloto con freno (`SOCIAL_PUBLISH_ENABLED` off) y sin observabilidad           | STOP 2026-09-15      | 0012 no escrito — premisa invertida: flag `true` + 2 posts opt-in ⇒ ya publica | —     | —             |

Archivo: al cerrar cada eslabón se completa su celda y nunca se reescribe
hacia atrás (si un ADR se supersede, se añade fila, no se borra historia).

## §6. Decision log — decisiones y supuestos

| Fecha      | Decisión / supuesto                                                                                                                                                                                                                                                                                                                                                   | Contexto             | Estado                                                         |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | -------------------------------------------------------------- |
| 2026-09-15 | Spikes primero, builds después (ningún build sin ADR `Accepted`)                                                                                                                                                                                                                                                                                                      | Este roadmap         | vigente                                                        |
| 2026-09-15 | Back-end no auditado: sus contratos se toman de los docs del front-end como supuestos                                                                                                                                                                                                                                                                                 | Alcance del análisis | vigente — confirmar en builds 002/004/006                      |
| 2026-09-15 | Rechazados: dark mode/features genéricos, migrar buscador, consolidar repos (ADR-0007 lo zanjó)                                                                                                                                                                                                                                                                       | `plans/README.md`    | vigente                                                        |
| 2026-09-15 | Arquitectura: ACEPTAR ADR-0009 (Buttondown) y ADR-0011 (Cloudflare WA) — afirmaciones load-bearing verificadas contra docs oficiales (embed endpoint + double-opt-in mandatorio; beacon cookieless/free + CSP exacto) y contra código (Partytown default true, privacidad País :27). Sin cambios bloqueantes                                                          | Revisión Wave 1      | vigente — falta `Proposed` → `Accepted` del maintainer         |
| 2026-09-15 | Orden de builds: 003-build primero (observabilidad aditiva, sin dependencia externa), 001-build después (puerta: pregunta abierta 3 — humano dueño, billing, cuenta — resuelta ANTES del merge). No paralelizar builds: ambos tocan `src/config.yaml` + `CommonMeta.astro:11`. Wave 2 spikes (002+006) en paralelo en cualquier momento: solo crean ADRs, cero solape | Revisión Wave 1      | vigente                                                        |
| 2026-09-15 | Hallazgo: `SOCIAL_PUBLISH_ENABLED=true` desde 2026-09-14 (verificado vía API por advisor) + 2 posts con `social.publish` ⇒ el publisher YA está live sin checklist ni observabilidad. Plan 006 BLOCKED tras STOP correcto del ejecutor; reframe propuesto: auditoría retroactiva de lo publicado desde el 14-09 + observabilidad, en vez de checklist de graduación   | Ejecución Wave 2     | vigente — decidir reframe (candidato plan 009) antes de Wave 3 |
| 2026-09-16 | Revisión PR #174: 006-reframe propagado (salida Wave 2, orden Wave 4, ítems 7/11 ya no referencian graduación/0012); plan 008 con gate de cierre live (edge CSP en ambos hosts + envío en producción, sin DONE sin ello); fila 002 calificada con PR #171                                                                                                             | Revisión Wave 2      | vigente                                                        |

## §7. Riesgos vivos de la ejecución

- **Deriva entre spike y build**: cada plan trae drift check contra
  `8af478b`; si el build arranca meses después, revalidar premisas (el
  endpoint puede haberse llenado, series haberse poblado).
- **Fatiga de revisión**: 4 ADRs de golpe; las Waves la dosifican — no abrir
  Wave 2 sin cerrar la revisión de Wave 1.
- **Promesas a medias**: el riesgo que originó 001/002 (prometer sin
  operar) puede repetirse si un ADR se acepta y su build no se agenda —
  el ítem 8 del backlog existe para eso.
- **Colisiones en `plans/README.md`**: único archivo compartido por los 6
  spikes; los ejecutores en paralelo coordinan su actualización o la deja
  el revisor al cerrar la Wave.
