---
title: 'Un rojo no es igual para todos: qué propone Apple para calibrar el color'
schema_version: 2
date: 2026-10-29
corrected_at: '2026-11-01'
correction_summary: 'Se acotó la función de igualación a lo descrito por Apple, se retiraron las promesas de adaptación individual y percepción universal, y se atribuyeron los detalles del portátil al reportaje consultado.'
author: Noticiencias AI
categories:
  - Tecnología
tags:
  - apple
  - macbook
  - color
  - pantalla
  - visión
excerpt: Apple CMF 2026 es una función de igualación de color usada para calibrar pantallas; no ajusta automáticamente la imagen a los ojos de cada persona.
image: ~/assets/images/2026-10-29-calibracion-color-friedrich-haag.jpg
image_alt: 'Un colorímetro mide una pantalla roja durante una calibración en 2020; no es una demostración de Apple CMF 2026. Foto: Friedrich Haag / Wikimedia Commons, CC BY-SA 4.0; recortada.'
source_url: https://theverge.com/1022347/apple-macbook-supports-new-cmf
refinery_id: '4797'
headlines_variants:
  question: ¿Por qué varía la percepción del color y qué propone Apple?
  benefit: Qué cambia con el modelo de calibración Apple CMF 2026
summary_points:
  - Apple CMF 2026 es una función de igualación de color usada en la calibración de ciertas pantallas; no mide ni adapta automáticamente la imagen a la visión individual.
  - El observador colorimétrico CIE 1931 es una referencia estándar, pero no representa por separado la visión de cada persona.
  - Según Apple, su función CMF 2026 busca mejorar la coherencia visual entre pantallas, sin eliminar las diferencias entre observadores.
  - The Verge informa de su incorporación al MacBook Pro con pantalla PROLED XDR; la documentación de Apple consultada describe su aplicación en Studio Display XDR.
  - Apple participa en trabajos de normalización con la CIE, pero eso no significa que su función ya sea un estándar de la industria.
glossary:
  - term: CIE 1931
    definition: Un modelo matemático, estándar internacional por casi un siglo, utilizado para calibrar pantallas y asegurar la consistencia del color, pero basado en un conjunto limitado de datos de visión humana.
  - term: OLED
    definition: Acrónimo de 'Diodos Orgánicos de Emisión de Luz', una tecnología de pantalla avanzada conocida por sus negros profundos y colores vibrantes.
  - term: Fósforos KSF
    definition: Un tipo de elementos luminiscentes utilizados en algunas tecnologías de pantallas LED para mejorar la calidad y el espectro del color.
  - term: Puntos cuánticos
    definition: Nanocristales semiconductores que emiten luz de colores específicos cuando son excitados, usados en pantallas modernas para lograr una gama de colores más amplia y precisa.
  - term: Apple CMF 2026
    definition: Un conjunto de funciones de igualación de color desarrollado por Apple que representa matemáticamente cómo percibimos los colores, para mejorar la consistencia visual entre pantallas; no mide la visión de cada usuario.
  - term: Conos
    definition: Células fotorreceptoras sensibles al color ubicadas en la retina del ojo, responsables de la visión en color y la agudeza visual.
fact_check:
  - label: La percepción del color es un asunto personal y biológico, y la sensibilidad de los conos puede cambiar con la edad.
    status: confirmed
  - label: El modelo CIE 1931 no podía compensar las variaciones individuales en la visión humana, lo cual es una deficiencia para las tecnologías de pantalla avanzadas.
    status: confirmed
  - label: Apple CMF 2026 es un conjunto de funciones de igualación diseñado para mejorar la coherencia visual entre pantallas.
    status: confirmed
  - label: The Verge informa de que el MacBook Pro con pantalla PROLED XDR admite Apple CMF 2026.
    status: confirmed
  - label: Apple participa en trabajos de normalización con la CIE para desarrollar un estándar de la industria.
    status: confirmed
why_it_matters:
  - Los modos compatibles ofrecen otra referencia para flujos profesionales; la coincidencia percibida aún depende del observador, la pantalla y las condiciones de visualización.
  - Un modelo común puede facilitar comparaciones entre tecnologías de pantalla, pero su desempeño y la percepción individual requieren evaluación.
confidence: Moderada — Es un reportaje periodístico que describe una nueva característica de un producto y su potencial impacto, basado en la información proporcionada por el fabricante y el análisis de un experto. No es un estudio científico revisado por pares.
sources:
  - title: Apple’s new laptop supports one of the coolest features for color pros
    url: https://theverge.com/1022347/apple-macbook-supports-new-cmf
    publisher: The Verge
  - title: Medir la calibración de las pantallas de Apple
    url: https://support.apple.com/es-es/105101
    publisher: Apple
    role: primary
requires_uncertainty_note: true
uncertainty_note: Apple CMF 2026 es una función propia de la compañía; no hemos verificado una adopción como estándar de la industria ni medido su rendimiento de forma independiente.
social:
  publish: true
  id: 293c7fb95b9765616bcbf0d97d3488c7474c3bebc4621cc5f7a5320c4a0dbe9a
---

**Corrección y actualización, 1 de noviembre de 2026.** Una versión anterior decía que Apple CMF 2026 adaptaba la imagen a los ojos de cada usuario y garantizaba una percepción universal. Es una función de igualación para calibración, no una medición individual. También distinguimos lo que documenta Apple de los detalles del portátil informados por The Verge y retiramos afirmaciones que anticipaban una percepción universal.

¿Has notado alguna vez que un color se ve ligeramente diferente en dos pantallas distintas, o incluso que lo que para ti es un rojo vibrante, para otra persona parece menos intenso? Aunque los fabricantes de pantallas se esfuerzan por la precisión, la realidad es que la percepción del color es un asunto profundamente personal y biológico. Para los profesionales que viven de la imagen, esta variabilidad es un problema constante. Ahora, una nueva función en las últimas laptops de Apple busca mejorar la consistencia entre pantallas mediante un modelo de calibración; no ajusta cada imagen a la visión individual.

## Por qué el color puede variar entre pantallas

Una referencia ampliamente utilizada en colorimetría es el **observador CIE 1931**, un modelo matemático de respuesta visual estandarizada. Sirve para comparar mediciones de color, pero no describe por separado la visión de cada observador.

Las tecnologías de pantalla como _OLED_, LED con fósforos KSF y puntos cuánticos pueden emitir espectros distintos. Dos pantallas calibradas al mismo _punto blanco D65_ pueden parecer similares a una persona y diferentes a otra. Apple señala esta variabilidad como una limitación relevante al comparar pantallas con distintos espectros.

## Un ojo, un mundo: la biología de la percepción

Las personas pueden diferir en la sensibilidad de los conos —células que participan en la visión del color— y esa sensibilidad puede cambiar con la edad. El observador estándar no mide esas diferencias individuales. Apple ha desarrollado **Apple CMF 2026**, un conjunto de funciones de igualación que, según la compañía, busca mejorar la coherencia visual entre pantallas de tecnologías diferentes.

Apple documenta su uso en el monitor Studio Display XDR. [The Verge informa](https://theverge.com/1022347/apple-macbook-supports-new-cmf) de que también está disponible en el MacBook Pro con PROLED XDR Display, con modos de referencia para profesionales. La documentación de Apple consultada para esta nota describe el monitor; no hemos comprobado por separado las especificaciones del portátil. La función no garantiza que dos personas perciban idénticamente el mismo color ni que todas las pantallas coincidan.

## Un estándar prometedor, pero aún propio

Apple CMF 2026 es una función propia de la compañía. Según [Apple](https://support.apple.com/es-es/105101), la empresa participa en trabajos de normalización con la CIE para desarrollar un estándar de la industria; eso no acredita que su propuesta haya sido adoptada. The Verge informa de que el portátil ofrece además modos de referencia basados en CIE 1931.

El equipo también admite calibraciones personalizadas y modos de referencia para contenido _HDR_ (alto rango dinámico) y _SDR_ (rango dinámico estándar). También cuenta con la función _True Tone_, que ajusta automáticamente el color y el brillo de la pantalla a la luz ambiental. Sin embargo, esta es una característica de equipos de gama alta, lo que implica una inversión considerable.

## La evolución de la ciencia del color

La calibración puede mejorar la coherencia entre pantallas, pero las diferencias de percepción siguen existiendo. Un modelo compartido no mide los ojos de cada espectador ni garantiza una percepción universal. Evaluaciones independientes y el proceso de normalización permitirán valorar el alcance de la propuesta.

<!-- source_identity: source_id=the_verge; source_name=The Verge -->
