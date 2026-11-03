---
title: IA crea proteasas desde cero conservando solo el núcleo catalítico
schema_version: 2
date: 2026-10-14
corrected_at: '2026-10-31'
correction_summary: 'Se separaron los resultados de dos estudios sobre proteasas y se corrigieron cifras de diseños y sus límites experimentales.'
author: Noticiencias AI
categories:
  - Tecnología
tags:
  - proteasa
  - diseño de proteínas
  - inteligencia artificial
  - enzima
  - enfermedad neurológica
excerpt: Dos estudios usan diseño computacional para crear proteasas que cortan secuencias elegidas. Los resultados son experimentales y no demuestran un tratamiento.
image: ~/assets/images/2026-10-14-proteasa-dokki-9ynm-rcsb.png
image_alt: 'Representación molecular de la proteasa de cisteína diseñada Dokki_15, basada en su estructura cristalográfica, no de una reacción. RCSB PDB, entrada 9YNM; datos de Bera, Choi y colaboradores. CC0 1.0.'
source_url: https://arstechnica.com/science/2026/10/researchers-use-ai-to-design-proteins-that-cut-up-other-proteins/
refinery_id: '3712'
headlines_variants:
  question: ¿Puede la IA diseñar enzimas que la evolución tardó millones de años en perfeccionar?
  benefit: Qué muestran los experimentos con proteasas diseñadas y cuáles son sus límites
summary_points:
  - Investigadores del laboratorio de David Baker en la Universidad de Washington usaron herramientas de diseño de proteínas basadas en machine learning para crear proteasas desde cero, conservando solo el núcleo catalítico.
  - En dos estudios, 13 de 69 diseños de proteasas de cisteína y el 36 % de 135 diseños de metaloproteasas mostraron actividad en las pruebas descritas.
  - En metaloproteasas, cuatro sustituciones aumentaron la aceleración de la hidrólisis hasta más de diez mil millones de veces frente a la reacción sin catalizador.
  - Diseños de metaloproteasas cortaron TDP-43, amiloide beta y amiloide sérico A en pruebas experimentales; esto no demuestra eficacia como tratamiento.
  - Los resultados proceden de dos artículos de Nature; uno también probó proteasas de cisteína en células de mamífero.
glossary:
  - term: Enlace peptídico
    definition: Unión covalente que conecta aminoácidos en una cadena proteica; es químicamente muy estable y puede tardar siglos en romperse por hidrólisis espontánea en agua neutra.
  - term: Proteasa
    definition: Enzima que cataliza la hidrólisis de enlaces peptídicos, rompiendo proteínas en fragmentos más pequeños.
  - term: Proteasa de cisteína
    definition: Tipo de proteasa que usa un residuo de cisteína en su sitio activo para atacar el enlace peptídico y formar un intermediario covalente temporal.
  - term: Proteasa de zinc
    definition: Tipo de proteasa que emplea un ion zinc para coordinar el enlace peptídico y una molécula de agua, activando esta última para cortar el enlace.
  - term: Evolución dirigida
    definition: 'Método de ingeniería de proteínas que imita la selección natural: se generan mutaciones aleatorias y se seleccionan las variantes con la función deseada.'
  - term: Especificidad off-target
    definition: Capacidad de una enzima para actuar sobre sustratos no deseados; en terapias proteolíticas, cortar proteínas distintas a la diana puede causar efectos tóxicos.
fact_check:
  - label: En el trabajo sobre proteasas de cisteína, 13 de 69 diseños mostraron actividad en la selección experimental.
    status: confirmed
  - label: En el estudio de metaloproteasas, el 36 % de 135 diseños cortaron sus péptidos diana en el enlace seleccionado.
    status: confirmed
  - label: Los diseños de zinc se probaron contra TDP-43, amiloide beta y amiloide sérico A; esto no demuestra un tratamiento para enfermedades humanas.
    status: confirmed
  - label: La seguridad y la especificidad de los diseños frente a todas las proteínas del organismo humano están establecidas.
    status: uncertain
why_it_matters:
  - Demuestra que es posible programar enzimas proteolíticas a medida para secuencias diana específicas, abriendo camino a herramientas de investigación y eventuales terapias dirigidas.
  - El diseño computacional permite explorar nuevas estructuras, pero sus resultados requieren comprobación y optimización experimental.
  - 'Subraya la brecha entre actividad bioquímica in vitro y aplicabilidad terapéutica in vivo: entrega, inmunogenicidad y efectos off-target siguen sin resolverse.'
confidence: Moderada — dos estudios revisados por pares en Nature informan ensayos bioquímicos y celulares; sus aplicaciones terapéuticas permanecen sin demostrar.
sources:
  - title: De novo design of cysteine proteases
    url: https://www.nature.com/articles/s41586-026-11143-w
    publisher: Nature
    date: '2026-10-14'
    role: primary
    doi: 10.1038/s41586-026-11143-w
  - title: Computational design of metalloproteases
    url: https://www.nature.com/articles/s41586-026-11167-2
    publisher: Nature
    date: '2026-10-14'
    role: primary
    doi: 10.1038/s41586-026-11167-2
  - title: Researchers use AI to design proteins that cut up other proteins
    url: https://arstechnica.com/science/2026/10/researchers-use-ai-to-design-proteins-that-cut-up-other-proteins/
    publisher: Ars Technica
    date: '2026-10-14'
    role: secondary
requires_uncertainty_note: true
uncertainty_note: Los resultados proceden de experimentos de laboratorio; no establecen seguridad clínica, eficacia terapéutica ni especificidad frente a todas las proteínas del organismo.
social:
  publish: true
  id: 9a09e1b22ff8c30026d9fcaeabfaeaed7e81d26078843dd156fc6b25a63c4525
---

**Corrección, 31 de octubre de 2026.** La versión anterior atribuyó 828 diseños al ensayo de cisteína, combinó cifras de dos trabajos y mencionó proteínas diana que los resúmenes de los estudios no identifican entre las ensayadas. Corregimos esas afirmaciones y añadimos las dos publicaciones originales.

Diseñar una enzima que corte una secuencia concreta de aminoácidos es una tarea distinta de pedirle a una computadora que dibuje una proteína. La estructura debe plegarse y, además, situar sus componentes químicos de forma que la reacción ocurra. Dos estudios publicados en _Nature_ describen proteasas diseñadas con herramientas computacionales y probadas en el laboratorio.

## Dos problemas, dos diseños

Las proteasas cortan enlaces que unen aminoácidos. Ambos equipos emplearon métodos de diseño de proteínas para generar estructuras nuevas alrededor de sitios activos, pero estudiaron mecanismos diferentes: uno depende de cisteína y el otro utiliza zinc. Los diseños se contrastaron después mediante experimentos, un paso necesario porque una estructura predicha no garantiza que una enzima funcione.

En el trabajo sobre cisteína, **13 de 69 diseños** mostraron actividad en la selección descrita. Los investigadores midieron aceleraciones de hasta 30 millones de veces frente a la reacción sin enzima y probaron diseños en células de mamífero. El resumen del estudio señala que sigue existiendo una diferencia de actividad respecto de las proteasas naturales más activas.

En el estudio de metaloproteasas, **el 36 % de 135 diseños** cortó su péptido diana en el enlace elegido. La mejor variante inicial aceleró la reacción más de cien millones de veces respecto de la reacción sin catalizador; cuatro sustituciones aumentaron esa cifra a más de diez mil millones. La comparación es con la reacción sin enzima, no con la velocidad de evolución de la naturaleza.

## Qué significa para la investigación

El grupo de metaloproteasas también diseñó enzimas que cortaron experimentalmente TDP-43, amiloide beta y amiloide sérico A, proteínas relacionadas con enfermedades humanas. Otro conjunto de ensayos exploró el control de señales celulares mediante proteínas activadas por proteasas. Son demostraciones de laboratorio: cortar una proteína en estas condiciones no demuestra que una enzima trate una enfermedad ni que sea segura en personas.

Antes de cualquier uso clínico habría que estudiar, entre otras cuestiones, cómo llegar al tejido deseado, si la enzima corta otras proteínas y qué efectos provoca. El trabajo abre herramientas para investigar esas preguntas; no ofrece todavía una terapia para enfermedades neurológicas.

<!-- source_identity: source_id=ars_technica; source_name=Ars Technica Science -->
