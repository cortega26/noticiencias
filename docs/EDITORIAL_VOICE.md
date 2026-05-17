# Voz Editorial y Posicionamiento de Marca — Noticiencias

> **Status**: Borrador inicial — propuesto el 2026-05-17 para validación del editor.
> **Audiencia**: Editores humanos, Agentes de IA, diseñadores, ingenieros front-end.
> **Relación con otros documentos**:
>
> - Complementa `docs/EDITORIAL.md` (que cubre estilo de redacción: anglicismos, cursivas, tono de párrafo).
> - Está subordinado a `AGENTS.md` (laws técnicas) y `src/content.config.ts` (schema sellado).
> - Cuando este documento entre en conflicto con una decisión visual ya implementada, **gana este documento** y la implementación debe alinearse.

---

## 1. La Editorial Promise

> **Noticiencias hace que la ciencia que importa se sienta tan interesante como realmente es.**

> ⏰ **Pendiente de revisión — 2026-06-17.** Esta Promise se mantiene tal cual por ahora. Queda abierta la pregunta de si "la ciencia que importa" es demasiado estrecha para cubrir contenido adyacente (editorial, opinión sobre internet/tech, cultura) que ya forma parte del portal. El arquetipo 3.5 cubre ese contenido mecánicamente, pero la Promise no lo nombra. Revisar al cumplirse un mes con datos reales de lectores y un inventario actualizado de qué se está publicando.

Esta frase es la única fuente de criterio para resolver decisiones editoriales, de diseño y de producto. Toda decisión —desde el copy de un botón hasta la jerarquía de la portada— debe poder defenderse contra esta frase. Si no se puede, la decisión está mal.

La promesa contiene una tensión deliberada que define toda la marca:

- **"Importa"** → No publicamos todo lo nuevo. Publicamos lo que cambia algo: una decisión clínica, una política pública, una infraestructura tecnológica, un modelo del mundo. La categoría editorial **"Qué cambia"** ya en la home es la manifestación correcta de este principio.
- **"Se sienta tan interesante"** → El trabajo editorial empieza por hacer la entrada irresistible: titular con gancho, dek que abre una pregunta, primer párrafo que enciende la curiosidad. La sorpresa, la emoción y la pregunta son herramientas legítimas y necesarias — sin ellas no hay lector, y sin lector no hay proyecto sostenible.
- **"Como realmente es"** → El gancho promete algo que el cuerpo entrega. La fuente original, el grado de incertidumbre y las limitaciones del estudio nunca se entierran. Son afordancias visuales de primera clase en la UI, no metadata oculta. Esto es lo que separa atracción legítima de clickbait.

### Principio operativo: **rigor en el método, curiosidad en la entrada**

El titular y el primer párrafo se ganan con sorpresa, _stakes_ o pregunta. El cuerpo se gana con fuentes, incertidumbre nombrada y evidencia a la vista. **Quien entra por curiosidad sale informado; quien entra escéptico sale convencido.**

Esta es deliberadamente la línea editorial de Quanta Magazine, The Atlantic (Ed Yong), Vox Science o el canon Sagan/Attenborough — divulgación de alto rigor con entrada emocional. No es la línea de Nature ni de arXiv (público demasiado nicho para sostener un medio masivo) ni la de portales de hype tecnológico (incumplen "como realmente es").

### Qué NO es Noticiencias

Definir lo que no somos es tan importante como lo que somos. Las decisiones grises se resuelven mirando este lado:

- No somos un **agregador social** (por eso los `#hashtag` en chips de tags violan la marca: pertenecen a un código visual de redes, no editorial).
- No somos un **portal de hype tecnológico** (por eso el "Detector de hype" tiene sentido como recurso, y los titulares en futuro condicional —"podría", "promete"— necesitan justificación editorial).
- No somos un **boletín académico** (por eso la jerga sin traducir, los abstracts copiados o la ausencia de un _takeaway_ humano son fallos editoriales).
- No somos un **medio de opinión** (por eso no hay columnistas con voz propia en la home: hay equipo editorial colectivo).

---

## 2. Tres Atributos de Voz

Cada pieza de texto en la web —titular, copy de botón, mensaje de error, label de formulario— se audita contra estos tres atributos, en este orden:

### 2.1 Curioso

La voz Noticiencias entra por la curiosidad. Sin gancho no hay clic, sin clic no hay lector, sin lector no hay proyecto. El primer borrador de cualquier titular o copy editorial debe pasar por un filtro de "¿esto haría que yo, lector hispano no especialista, me detuviera al scrollear?". Si la respuesta es no, se reescribe.

Cinco patrones legítimos de gancho:

1. **Curiosity gap real** — Tease lo sorprendente sin spoilear el cierre. _"Por qué los físicos llevan 50 años discutiendo una constante que nadie puede medir"_.
2. **Stakes nombrados** — Conecta el hallazgo con algo que le pasa al lector. _"Lo que el nuevo modelo de DeepMind cambia para tu próxima visita al médico"_.
3. **Contraintuitivo + dato** — Líder con la sorpresa concreta. _"El cerebro humano consume menos energía que una bombilla LED — y eso debería sorprender más de lo que parece"_.
4. **Pregunta editorial** — Una pregunta que el cuerpo responde. _"¿Por qué nadie habla del hallazgo que acaba de redefinir la edad del universo?"_.
5. **Emoción humana** — La historia detrás del dato. _"Caminó 1.000 km buscando pareja: lo que aprendimos siguiendo a un puma"_.

Adicionalmente, la claridad sigue siendo no-negociable como **propiedad** del texto, aunque no sea el primer atributo:

- Frases cortas. Sujeto + verbo + complemento.
- Una idea por párrafo.
- Cero jerga sin traducir en el primer párrafo.
- Si una palabra requiere glosario, va al `glossary` del frontmatter — no como nota a pie inventada.

**Falla:** "Vías de regreso" (módulo actual en la home). Es metafórico sin gancho, no nombra lo que hay detrás ni invita a abrirlo.
**Pasa:** "Recibe el boletín que el resto de la web te debe cada viernes" / "El RSS que tu lector lleva años pidiendo".

### 2.2 Riguroso

El rigor en Noticiencias se demuestra mostrando el método y los límites, no afirmando autoridad.

- Toda afirmación de magnitud o causalidad necesita fuente. El schema lo permite con `sources[]` y `source_url`. Sin esos campos llenos, un artículo no debería marcar `investigation: true`.
- La incertidumbre se nombra, no se omite: `uncertainty_note` debe usarse cuando el hallazgo es preliminar, observacional, o tiene n pequeña.
- El `editorial_score` y `confidence` del schema no son decoración: condicionan qué piezas pueden ir a portada (`featured`).

**Falla:** Titular afirmando un descubrimiento como hecho cuando el paper original lo presenta como hipótesis.
**Pasa:** Titular que distingue "se observó", "se propone", "se confirma".

**Cuando no hay paper detrás** (editorial, opinión, meta-comunicación, perfiles, análisis sobre internet/tech), "Riguroso" cambia de forma sin cambiar de espíritu:

- **Distingue hecho de opinión** explícitamente. Si afirmas que "X es problemático", aclara si es tu juicio editorial o un dato verificable.
- **Atribuye juicios** a quien los hace, no a "nadie". Si dices "se ha criticado X", di quién.
- **Transparenta el ángulo**. Una pieza editorial declara su perspectiva, no la disfraza de análisis neutral.
- **Honra la incertidumbre** igual que en ciencia: si una posición es minoritaria, dilo; si tu predicción puede fallar, marca por qué.

El test sigue siendo el mismo: un lector escéptico debe terminar la pieza convencido, no manipulado.

### 2.3 Útil

Un lector que termina un artículo debe poder hacer algo con lo que leyó: explicárselo a otra persona, cambiar una decisión, leer la fuente, o saber qué seguir vigilando.

- `summary_points` (2-5 viñetas) al inicio: el lector que solo lee eso se va informado.
- `why_it_matters` al cierre o destacado: conecta el hallazgo con el lector hispano.
- `series` cuando la historia tiene continuidad: damos un hilo para volver.

**Falla:** Artículo que termina sin enlazar a fuente original, a una serie relacionada, o a una acción posible.
**Pasa:** Artículo que cierra con "Lee el paper original" + "Esta historia es parte de la serie X" + "Próxima entrega: Y".

### 2.4 Línea roja: cuándo el gancho cruza a sensacionalismo

El atributo "Curioso" tiene una frontera concreta y no negociable. Cruzarla destruye la confianza y, a medio plazo, la base de lectores que se intenta construir. La frontera se codifica así:

| Atrae (sí)                                                                                                           | Sensacionalismo (no)                                                 |
| -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Curiosity gap real ("Por qué los físicos llevan 50 años discutiendo una constante que nadie puede medir")            | Curiosity gap traicionado ("No vas a creer lo que descubrieron")     |
| Stakes nombrados ("Lo que el nuevo modelo de DeepMind cambia para tu próxima visita al médico")                      | Stakes inventados ("Esto va a cambiar tu vida para siempre")         |
| Contraintuitivo + dato verificable ("El cerebro humano consume menos energía que una bombilla LED")                  | Hype vacío ("La IA que va a destruir Google")                        |
| Pregunta editorial respondida en el cuerpo ("¿Por qué nadie habla del hallazgo que redefinió la edad del universo?") | Pregunta manipuladora ("¿Sabías que esto te está matando?")          |
| Emoción humana atada a la historia ("Caminó 1.000 km buscando pareja: lo que aprendimos siguiendo a un puma")        | Emoción manufacturada ("Lo que pasó después te dejará sin palabras") |

Tres reglas que operacionalizan la línea:

1. **El titular promete lo que el cuerpo entrega.** Si el cuerpo no entrega la sorpresa que prometió el titular, no se publica. Este es el filtro editorial más importante de Noticiencias — fallarlo una vez destruye más confianza de la que diez aciertos construyen.
2. **Adjetivos especulativos** ("revolucionario", "increíble", "histórico", "asombroso", "milagroso") solo se usan **citando a una fuente identificada**, nunca como voz editorial. _"Los autores lo describen como 'revolucionario'"_ sí. _"Un descubrimiento revolucionario"_ no.
3. **Contrapeso de incertidumbre obligatorio.** Cuando el titular usa un _curiosity gap_ sobre un hallazgo preliminar, observacional o con n pequeña, `uncertainty_note` en el frontmatter pasa de opcional a obligatorio, y debe ser visible en la UI. El gancho legítimo se paga con la honestidad sobre los límites.

---

## 3. Cuatro Arquetipos de Artículo

No todos los artículos se ven igual ni se comportan igual. Cuatro arquetipos cubren el 100% del catálogo. Cada uno tiene **señales de frontmatter** que lo identifican y **una presentación visual canónica**.

### 3.1 Breaking — Hallazgo reciente, alta novedad

**Señales de frontmatter:**

- `date` dentro de los últimos 7 días.
- `summary_points` con 2-3 viñetas (no más).
- `sources[]` con ≥1 fuente primaria (paper, comunicado oficial).

**Presentación canónica:**

- Kicker: `BREAKING · {categoría}` en color `accent`.
- Sin `KeyTakeaways` desplegado: las 2-3 viñetas van inline bajo el dropcap.
- Botón "Lee la fuente original" prominente al final.

**Ejemplo de copy de titular:** verbo en presente, sustantivo concreto, sin adjetivos especulativos.

### 3.2 Explainer — Concepto, fenómeno o tecnología explicada

**Señales de frontmatter:**

- `summary_points` con 4-5 viñetas.
- `glossary[]` con ≥3 términos.
- `tags` que incluyen el concepto central como tema.

**Presentación canónica:**

- `KeyTakeaways` arriba del fold, antes del primer párrafo.
- Glosario lateral o desplegable en móvil.
- `RelatedReading` filtrado por mismo tag (no por categoría).

### 3.3 Investigación — Trabajo editorial propio o de profundidad

**Señales de frontmatter:**

- `investigation: true`.
- `sources[]` con ≥3 fuentes.
- `fact_check[]` poblado.
- `series` opcional pero frecuente.

**Presentación canónica:**

- Badge "Investigación Noticiencias" visible en card y en cabecera.
- Tipografía serif (Playfair Display) en titular, mayor tamaño.
- Bloque "Cómo lo verificamos" con `fact_check[]` desplegado al final.
- En la home: candidato natural a `featured` con `variant="lead"`.

### 3.4 Qué cambia — Consecuencia de un hecho ya conocido

**Señales de frontmatter:**

- `why_it_matters[]` con ≥2 puntos.
- `uncertainty_note` frecuente (los segundos órdenes son inciertos por definición).
- Categoría suele ser Política, Salud, Economía o Tecnología (no Ciencia pura).

**Presentación canónica:**

- Módulo dedicado en home (`contextPosts` ya existe en `DailyDesk.astro`).
- Kicker: `QUÉ CAMBIA · {ámbito}` — donde `{ámbito}` es Política, Salud, Industria, Vida cotidiana.
- `why_it_matters` destacado visualmente, no enterrado en prosa.

### 3.5 Editorial — Voz propia del portal

**Cuándo se usa:** todo contenido que no es reporte traducido de un hallazgo externo. Cubre dos familias:

1. **Meta del portal** — bienvenidas, anuncios, correcciones, declaraciones de metodología, transparencia, política editorial, obituarios y perfiles del equipo.
2. **Voz editorial sobre temas en órbita de la ciencia** — opinión y análisis sobre internet, tecnología, gobernanza de plataformas, derechos digitales, políticas públicas de IA, cobertura mediática de la ciencia, cultura digital. Periodismo de internet/tech que no es estrictamente científico pero que el portal ya cubre y va a seguir cubriendo.

**Señales de frontmatter:**

- Categoría `Editorial` (preferida) o, para piezas de internet/tech editorial, la categoría temática (`Tecnología`) **acompañada** de un `tags` que incluya `editorial`.
- `investigation: false` (no es trabajo investigativo propio: es voz).
- `author` identificado explícitamente ("Equipo Editorial", o nombre concreto cuando sea columna firmada). Nunca "Noticiencias AI" en este arquetipo.
- `sources[]` opcional. Si la pieza apoya su argumento en datos externos, se citan; si es pura opinión sobre un tema, no se exigen.
- `source_url` no aplica (no hay traducción de fuente externa). Si aparece poblado en un Editorial, hay un error de pipeline o de clasificación.

**Presentación canónica:**

- Badge "Editorial Noticiencias" visible en card y cabecera, distinto del badge "Investigación Noticiencias" del 3.3.
- Tipografía serif (Playfair Display) en titular, en un tamaño más íntimo que Breaking — texto algo menor, más blanco alrededor, dek más largo.
- **Sin TrustPanel completo:** solo se muestra `uncertainty_note` si está poblado. El bloque "Fuentes y verificación" se omite cuando no hay `sources[]`. Decisión derivada: el componente `TrustPanel` debe respetar la ausencia de `sources[]` y no inventar una fuente desde `source_url` cuando este no exista.
- El autor sale más arriba en la cabecera (la voz propia hace que el firmante importe).
- En home: candidato a `featured` solo si la pieza merece visibilidad propia (anuncio importante, posición editorial sobre tema candente). No por defecto.

**Voz adaptada:** ver el párrafo final de la sección 2.2 — "Riguroso" cambia de forma sin cambiar de espíritu cuando no hay paper detrás. "Curioso" y la línea roja se aplican igual: un editorial sobre TikTok puede usar curiosity gap real (_"Por qué TikTok es el producto más opaco que se haya regulado"_), pero no curiosity gap traicionado (_"No vas a creer lo que esconde TikTok"_).

---

## 4. Implicaciones de Diseño Inmediatas

Las decisiones siguientes se derivan directamente de las secciones 1-3. No son opinión visual: son consecuencia de la promesa. Cualquier desviación necesita ser argumentada por escrito.

| #   | Decisión                                                                                                                                                                                     | Razón                                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| D1  | Eliminar el `#` literal de los chips de tags (`ArticleCard.astro:121`)                                                                                                                       | Código visual social, contradice "no somos agregador social"                     |
| D2  | Unificar `Tags.astro` y los chips inline de `ArticleCard` en un solo átomo `<TagPill />`                                                                                                     | Un único lenguaje de tag = sensación de oficio editorial                         |
| D3  | Renombrar "Vías de regreso" → "Boletín semanal" o "Sigue la edición"                                                                                                                         | Falla el atributo "Claro"                                                        |
| D4  | `sources[]` y `source_url` deben ser visibles en cada artículo, no a un clic de distancia                                                                                                    | "Evidencia a la vista"                                                           |
| D5  | `uncertainty_note` debe tener un componente visible cuando esté poblado (badge o callout). Pasa de opcional a obligatorio cuando el titular usa un _curiosity gap_ sobre hallazgo preliminar | Atributo "Riguroso" + contrapeso del atributo "Curioso" (sección 2.4)            |
| D6  | `investigation: true` debe disparar diferencias visuales reales (badge, tipografía, posición en home), no solo metadata                                                                      | Sin diferenciación visible, marcar `investigation` no cuesta nada y pierde valor |
| D7  | El módulo "Qué cambia" merece tratamiento visual diferenciado del resto de cards (no solo `variant="compact"`)                                                                               | Es un arquetipo, no una sub-lista                                                |
| D8  | Botones legacy `.btn`/`.btn-primary` en `src/styles/global.css` se deprecan a favor de `ds/atoms/Button.astro` con `rounded-md` editorial                                                    | Un solo sistema visual                                                           |

Cada una de estas decisiones es candidata a issue/PR independiente. La numeración sirve como referencia estable.

---

## 5. Lo que rompe la promesa hoy (auditoría inicial)

Auditoría rápida del estado actual al 2026-05-17. Sirve como baseline para medir progreso.

- **Tags con `#`** (`ArticleCard.astro:121`) — D1.
- **Inconsistencia de chips** (`ArticleCard` vs `Tags.astro`) — D2.
- **Copy sin gancho** ("Vías de regreso", "Guías de lectura" en `DailyDesk.astro`) — falla "Curioso": describe en lugar de invitar.
- **`investigation: true` sin tratamiento visual diferenciado** — falla "Riguroso" y desperdicia un campo de schema.
- **`sources[]` y `uncertainty_note` poco visibles en la lectura del artículo** — falla "Evidencia a la vista".
- **Dos sistemas de botones coexistiendo** (`.btn` legacy + `ds/atoms/Button.astro`) — fragmentación visual.
- **Sin diferenciación clara entre arquetipos** en la home: todas las cards usan la misma escala visual con sutiles `variant="lead|standard|compact|row"`, pero el lector no sabe leer la diferencia porque no hay códigos visuales reconocibles (kickers tipados, badges de arquetipo).

---

## 6. Cómo usar este documento

**Antes de proponer una pieza de contenido nueva:**

- Identificar el arquetipo (sección 3). Si no encaja en ninguno, parar y consultar al editor.
- Verificar que el frontmatter exigido por el arquetipo esté completo.
- Pasar el titular y el dek por los tres atributos de voz (sección 2).

**Antes de proponer un cambio de UI:**

- Identificar qué afirmación de la sección 1-3 justifica el cambio.
- Si el cambio contradice una decisión D1-D8 de la sección 4, escribir el contraargumento antes de implementar.
- Cruzar con `AGENTS.md` para validar que la implementación respeta los límites técnicos (no islas, capas DS → template → pages, schema sellado).

**Cuando este documento se sienta desactualizado:**

- No editarlo unilateralmente. Es un documento de marca: las modificaciones requieren acuerdo editorial.
- Abrir issue describiendo la fricción observada.
- Proponer la edición como cambio rastreado en git, con razón en el commit message.

---

## 7. Métricas para validar la promesa

La voz editorial no se mide por adjetivos sino por comportamiento de lectores. Las métricas siguientes son las que importan, en orden:

1. **Tiempo medio en artículo** (≥60s = lectura real).
2. **Bounce rate en home** (referencia: <60% es bueno para portada).
3. **CTR a fuente original** desde artículos (proxy de "Evidencia a la vista" funcionando).
4. **Suscripciones al boletín por sesión** (proxy de "Útil" funcionando).
5. **Retorno semanal** (proxy de la promesa entera).

Sin instrumentación (Plausible, GA o equivalente) en `BaseLayout.astro`, estas métricas no existen. Instrumentar es prerrequisito de cualquier rediseño que se quiera defender con datos.

---

## 8. Correspondencia con el pipeline editorial del backend

El front-end no genera contenido. Los titulares, deks, cuerpos y metadatos llegan ya escritos desde el repo `noticiencias_news_collector`, donde un pipeline de prompts LLM produce cada artículo. Para que la voz definida en este documento se cumpla **antes** de llegar al front-end, los prompts del backend deben hablar el mismo idioma. Esta sección documenta esa correspondencia para que las dos puntas se mantengan alineadas en el tiempo.

### 8.1 Mapa de prompts activos

| Prompt                            | Archivo                                                        | Rol en el pipeline                                                                                                                                     |
| --------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `translator`                      | `noticiencias_news_collector/config/prompts.yaml`              | Traducción fiel del inglés. No editorializa.                                                                                                           |
| `editor`                          | `noticiencias_news_collector/config/prompts.yaml`              | Reescribe la traducción como artículo Noticiencias. Implementa los seis patrones de apertura legítima.                                                 |
| `editor_critic`                   | `noticiencias_news_collector/config/prompts.yaml`              | Gate de calidad del cuerpo: evalúa 7 criterios (hook, clarity, structure, rigor, voice, shareability, closing). Bloquea publicación si falla.          |
| `headline`                        | `noticiencias_news_collector/config/prompts.yaml`              | Genera `direct`, `question`, `benefit`, `excerpt`. Aplica los cinco patrones de gancho de la sección 2.1 + lista negra de adjetivos de la sección 2.4. |
| `headline_critic`                 | `noticiencias_news_collector/config/prompts.yaml`              | Gate de calidad del titular: valida fidelidad gancho-cuerpo y línea roja de sensacionalismo. Bloquea publicación si falla; hasta 2 reintentos.         |
| `auditor`                         | `noticiencias_news_collector/config/prompts.yaml`              | Score-card informativo, no bloquea. Alimenta el campo `editorial_score` del frontmatter.                                                               |
| `EDITORIAL_COUNCIL_SYSTEM_PROMPT` | `noticiencias_news_collector/news_collector/config/prompts.py` | Consejo de 4 roles (Científico, Escéptico, Curioso, Editor) con rúbricas específicas alineadas a este doc.                                             |

### 8.2 Correspondencia atributos de voz ↔ prompts

| Atributo (sección 2)                 | Dónde se hace cumplir                                                                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Curioso**                          | `headline.system` (5 patrones), `editor.system` (6 aperturas legítimas), `headline_critic.system` (línea roja), Consejo Editorial rol "Curioso"              |
| **Riguroso**                         | `translator.system` (fidelidad), `editor.system` (preservación de matices de incertidumbre), `editor_critic.rigor_score`, Consejo Editorial rol "Científico" |
| **Útil**                             | `editor.system` (Shareability, repertorio de cierres), `editor_critic.shareability_score` y `closing_score`                                                  |
| **Línea roja sensacionalismo (2.4)** | `headline.system` (lista negra + reglas), `headline_critic.system` (gate), Consejo Editorial rol "Escéptico"                                                 |

### 8.3 Correspondencia arquetipos ↔ "Estructura Adaptativa" del editor

El prompt `editor.system` define 4 tipos de estructura (`Tipo A` a `Tipo D`). Se mapean 1:1 con los arquetipos de la sección 3 de este documento:

| Arquetipo (sección 3) | Tipo en `editor.system`                               | Señales de selección                                         |
| --------------------- | ----------------------------------------------------- | ------------------------------------------------------------ |
| Breaking (3.1)        | Tipo A — Estudio o hallazgo científico                | `date` reciente, `sources[]` primarias, `summary_points` 2-3 |
| Explainer (3.2)       | Tipo C — Tendencia, análisis o explicador             | `glossary[]` ≥3, `summary_points` 4-5                        |
| Investigación (3.3)   | Tipo A o B con flags                                  | `investigation: true`, `fact_check[]`, `sources[]` ≥3        |
| Qué cambia (3.4)      | Tipo D — Decisión institucional o política científica | `why_it_matters[]` ≥2, categoría Salud/Política/Industria    |

### 8.4 Cómo el front-end consume las señales nuevas

El `headline` ahora emite tres campos adicionales en su JSON de salida que el frontmatter puede transportar al front-end:

- `pattern_used` — el patrón de gancho usado (curiosity_gap, stakes, counterintuitive, question, human_emotion). Útil para analítica de CTR por patrón.
- `requires_uncertainty_note` — `true` si el gancho se apoya en hallazgo preliminar. El front-end debe destacar visualmente el `uncertainty_note` cuando este flag esté activo (decisión D5).
- `hook_body_fidelity_check` — una frase corta describiendo qué del cuerpo respalda la promesa del titular. Útil para auditoría editorial humana, no para mostrar al usuario.

Estos tres campos están definidos como **opcionales** en el `HeadlinesSchema` del backend, lo que mantiene compatibilidad con artículos cacheados anteriores.

### 8.5 Regla de mantenimiento

Cuando se modifique este documento en una forma que afecte voz, arquetipos o línea roja, **debe abrirse una PR cruzada al backend** que actualice los prompts correspondientes según esta tabla 8.2. Y a la inversa: si los prompts del backend se reescriben, este documento debe sincronizarse antes de mergear. Las dos puntas viven o mueren juntas.
