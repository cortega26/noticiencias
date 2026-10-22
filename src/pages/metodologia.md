---
title: 'Metodología Editorial'
permalink: /metodologia/
layout: ../layouts/MarkdownLayout.astro
excerpt: 'Cómo elegimos, preparamos y publicamos cada artículo: automatización para vigilar muchas fuentes, una persona que decide qué se publica y las fuentes a la vista.'
---

Internet está lleno de titulares de ciencia exagerados. **Noticiencias** nació para lo contrario: contar qué se ha descubierto de verdad, con qué respaldo y con qué límites, en un español claro y con las fuentes a la vista.

No somos un agregador que copia titulares ni un blog de opinión. Combinamos herramientas automáticas —que vigilan muchas fuentes y preparan borradores— con una decisión humana de integración antes de publicar. Esa decisión no implica necesariamente una revisión humana independiente de cada afirmación: identificamos a un revisor de contenidos solo cuando existe constancia de esa revisión. Así es como trabajamos.

---

## Qué cuidamos en cada artículo

Tres ideas guían todo lo que hacemos.

**Ir hacia la evidencia, no hacia el rumor.** Partimos de medios científicos de referencia, salas de prensa de universidades y centros de investigación, y repositorios de preprints. Desde ahí, cuando la nota remite a un estudio, buscamos el original para enlazarlo; la ficha de cada artículo indica si se apoya en una fuente primaria o solo en la cobertura de un medio.

**Contar los matices.** Un hallazgo sin contexto engaña. Decimos en qué se basa —cuánta gente participó, si se probó en personas, animales o simulaciones— y qué dudas plantea la propia comunidad científica.

**Dejar el rastro.** No te pedimos que confíes a ciegas. Enlazamos las fuentes que usamos, añadimos el DOI del estudio cuando existe y mostramos el estado de la evidencia cuando está documentado, para que puedas comprobar el trabajo por tu cuenta.

---

## Cómo llega un artículo hasta aquí

1. **Selección.** Un sistema propio recopila fuentes en ejecuciones programadas los lunes, miércoles y viernes a las 06:00 UTC, además de permitir ejecuciones manuales. Revisa alrededor de sesenta fuentes: revistas y medios de divulgación con buena reputación, salas de prensa universitarias, blogs de laboratorios de investigación y servidores de preprints como arXiv y bioRxiv. Ordena los hallazgos por relevancia y descarta el ruido y las publicaciones dudosas.

2. **Lectura y traducción.** Recogemos el contenido a través de los canales RSS oficiales y respetando las condiciones de cada sitio. Guardamos los datos del estudio —autores, institución, DOI— y unos modelos de lenguaje preparan una primera versión en español, con sus apartados: «Lo esencial», «Qué cambia» y un glosario de términos difíciles.

3. **Controles automáticos.** El crítico técnico comprueba la traducción y la integridad del texto. Si persisten problemas después de hasta dos reparaciones acotadas, el trabajo se detiene. El crítico editorial contrasta el borrador con la evidencia disponible: las afirmaciones materiales sin respaldo o la paráfrasis cercana que sigan sin resolverse después de una reparación dejan el trabajo en espera. Una fuente incompleta o una incertidumbre expresada honestamente no constituyen, por sí solas, esos defectos. Si un titular sigue siendo sensacionalista o carece de respaldo después de sus intentos de corrección, también queda en espera.

   Si un control editorial o de titulares falta, se omite o falla por un problema técnico, queda **sin verificar**: no se registra como una revisión superada. En ese caso solo puede prepararse una propuesta en borrador pendiente de revisión humana. El contraste de afirmaciones con las fuentes consultadas no aporta, por sí mismo, corroboración independiente.

4. **Revisión y publicación.** Las propuestas editoriales del recolector llegan como cambios al repositorio web. Para cada artículo nuevo o reescritura sustancial, el flujo exige una revisión humana final del titular, el cuerpo y los metadatos, junto con la evidencia y los asuntos pendientes. Completar y registrar esa revisión depende del responsable editorial; ni una propuesta en borrador ni los controles automáticos la sustituyen. Identificamos a un revisor solo cuando consta esa revisión. La integración aprobada en la rama principal activa las comprobaciones y la publicación del sitio; el historial registra qué cambió.

5. **La ficha de fuentes.** Cada artículo se publica con su recuadro **«Fuentes y límites»**, que enlaza la fuente registrada. Según la información disponible, también muestra el estado de la evidencia, sus límites, el método de traducción y enlaces a fuentes primarias.

---

## Qué significa «respaldado por la fuente»

Los controles de afirmaciones comparan el texto con las fuentes consultadas. Que una fuente respalde una afirmación no demuestra por sí solo que el hallazgo sea definitivo, reproducible o aplicable a otros contextos. Tampoco equivale a una comprobación independiente ni a una revisión humana individual. Una valoración editorial de confianza no reemplaza la lectura de la evidencia y sus límites.

## Cuando algo cambia

La ciencia avanza corrigiéndose a sí misma, y nuestro periodismo también.

- Si un estudio que cubrimos se retracta, se corrige o se actualiza, editamos el artículo y lo explicamos en una nota visible.
- El código que procesa los datos y la propia web son de código abierto en [GitHub](https://github.com/cortega26/noticiencias). Si ves un error o quieres proponer una mejora en una traducción, puedes abrir un issue o enviar una propuesta.

---

### Ciencia sin hype

Las decisiones editoriales no se subordinan a la publicidad. Actualmente no mostramos anuncios programáticos y estamos [evaluando vías de financiación](/patrocinios/) sin comprometer nuestra independencia. Puedes seguir nuestras publicaciones mediante [RSS](/rss.xml) o consultar el [archivo](/blog/).
