---
title: IA crea proteasas desde cero conservando solo el núcleo catalítico
schema_version: 2
date: 2026-10-14
author: Noticiencias AI
categories:
  - Tecnología
tags:
  - proteasa
  - diseño de proteínas
  - inteligencia artificial
  - enzima
  - enfermedad neurológica
excerpt: Equipo de Baker usa IA para diseñar proteasas de novo que cortan proteínas diana —incluidas ligadas a enfermedades neurológicas— con aceleración 10⁹-10¹⁰x.
image: ~/assets/images/2026-10-14-researchers-use-ai-to-design-proteins-that-cut-up-other-proteins.png
image_alt: 'Ilustración generada con IA: Ilustración científica de una molécula de proteasa con forma de tijera, diseñada por inteligencia artificial, en un entorno oscuro y futurista, a punto de cortar una cadena de proteína genérica.'
source_url: https://arstechnica.com/science/2026/10/researchers-use-ai-to-design-proteins-that-cut-up-other-proteins/
refinery_id: '3712'
headlines_variants:
  question: ¿Puede la IA diseñar enzimas que la evolución tardó millones de años en perfeccionar?
  benefit: Proteasas programables abren ruta a terapias contra proteínas tóxicas en el cerebro
summary_points:
  - Investigadores del laboratorio de David Baker en la Universidad de Washington usaron herramientas de diseño de proteínas basadas en machine learning para crear proteasas desde cero, conservando solo el núcleo catalítico.
  - Diseñaron dos tipos de proteasas —una de cisteína y otra de zinc— y probaron 828 y 135 variantes respectivamente; el 19 % de las de cisteína mostraron actividad detectable.
  - Mediante evolución dirigida mejoraron la velocidad catalítica hasta acercarse a enzimas naturales, aunque la proteasa de zinc siguió siendo más lenta.
  - Las proteasas diseñadas cortaron específicamente proteínas asociadas a enfermedades neurológicas (alfa-sinucleína, tau, TDP-43) en ensayos bioquímicos controlados.
  - El estudio se publicó en Nature tras revisión por pares, pero los autores advierten que el software de diseño tiene solo unos años y faltan restricciones cinéticas y dinámicas integradas en el algoritmo.
glossary:
  - term: Enlace peptídico
    definition: Unión covalente que conecta aminoácidos en una cadena proteica; es químicamente muy estable y tardaría siglos en romperse por hidrólisis espontánea en agua.
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
  - label: El equipo diseñó proteasas desde cero conservando solo el núcleo catalítico y reemplazando el resto de la estructura
    status: confirmed
  - label: El 19 % de los diseños de proteasa de cisteína mostraron actividad detectable en la criba bioquímica inicial
    status: confirmed
  - label: La imposición de una molécula de agua en el sitio activo mejoró los resultados de la proteasa de zinc
    status: uncertain
  - label: La mejor variante de cisteína alcanzó una velocidad catalítica cercana a la de la enzima natural de levadura tras evolución dirigida
    status: uncertain
  - label: Las proteasas diseñadas cortan específicamente proteínas ligadas a enfermedades neurológicas (alfa-sinucleína, tau, TDP-43)
    status: uncertain
  - label: No se ha evaluado la especificidad off-target a escala proteómica en entorno celular real
    status: uncertain
  - label: El software de diseño de proteínas usado tiene solo unos años de desarrollo
    status: confirmed
  - label: La entrega de estas proteasas al cerebro requeriría terapia génica, vectores virales o ARNm, lo que añade complejidad, riesgo inmunogénico y regulatorio
    status: uncertain
why_it_matters:
  - Demuestra que es posible programar enzimas proteolíticas a medida para secuencias diana específicas, abriendo camino a herramientas de investigación y eventuales terapias dirigidas.
  - Evidencia que el diseño computacional de novo acelera drásticamente la creación de biocatalizadores funcionales comparado con la evolución natural, aunque aún requiere optimización experimental posterior.
  - 'Subraya la brecha entre actividad bioquímica in vitro y aplicabilidad terapéutica in vivo: entrega, inmunogenicidad y efectos off-target siguen sin resolverse.'
confidence: Moderada — estudio revisado por pares en Nature con validación experimental bioquímica y celular, pero resultados preliminares sin evaluación proteómica de especificidad ni datos in vivo; los autores señalan limitaciones del software de diseño y necesidad de restricciones cinéticas integradas.
sources:
  - title: Researchers use AI to design proteins that cut up other proteins
    url: https://arstechnica.com/science/2026/10/researchers-use-ai-to-design-proteins-that-cut-up-other-proteins/
    publisher: Ars Technica
    date: '2026-10-01'
requires_uncertainty_note: true
uncertainty_note: Las proteasas diseñadas funcionan en ensayos controlados pero no se ha evaluado su especificidad en proteoma completo ni su entrega terapéutica in vivo.
social:
  publish: true
  id: 9a09e1b22ff8c30026d9fcaeabfaeaed7e81d26078843dd156fc6b25a63c4525
---

Un enlace peptídico, el pegamento que une los aminoácidos en una proteína, es terco: en agua pura tardaría siglos en romperse solo. La vida no tiene esa paciencia. En su lugar, evolucionó un puñado de tijeras moleculares —las proteasas— que aceleran el corte millones de veces. Ahora, un equipo del laboratorio de David Baker en la Universidad de Washington ha hecho algo que la evolución tardó eones en pulir: usó herramientas de diseño de proteínas basadas en _machine learning_ para construir proteasas desde cero, conservando solo el núcleo catalítico y reemplazando todo el resto. Las enzimas resultantes pueden programarse para cortar una proteína concreta —incluidas algunas ligadas a enfermedades neurológicas—. El trabajo se publica en _Nature_.

## Por qué cuesta tanto cortar una proteína

Imagina una cadena donde cada eslabón es un aminoácido. El cierre entre eslabones es el enlace peptídico: un grupo amino y uno ácido que se condensan expulsando agua. Químicamente, es una trampa de estabilidad. Sin ayuda, la hidrólisis espontánea —el agua rompiendo ese enlace— tiene una vida media de varios cientos de años. Para que ocurra en milisegundos, hace falta un catalizador que junte la molécula de agua y el enlace en la geometría exacta, y que además estabilice el estado de transición.

La naturaleza encontró dos soluciones principales. En las proteasas de zinc, un ion Zn²⁺ coordina el enlace peptídico, el agua y residuos clave de la enzima; el zinc polariza el agua, vuelve nucleófilo al oxígeno y este ataca el carbono del enlace. En las proteasas de cisteína, es un residuo de cisteína de la propia enzima el que ataca, formando un intermediario covalente transitorio que luego el agua hidroliza. En ambos casos, la precisión es milimétrica: unos pocos aminoácidos deben colocarse en el sitio activo con la orientación correcta, y el resto del plegamiento debe sostener esa arquitectura.

## Qué hicieron los investigadores: atajo al diseño

El grupo de Baker partió de dos proteasas naturales bien caracterizadas: una proteasa de zinc del sistema digestivo de un cangrejo de río y una proteasa de cisteína de levadura. Conocían la estructura y los residuos catalíticos esenciales. El reto era diseñar _de novo_ el andamiaje que sostuviera esos residuos y, a la vez, creara una bolsa de unión específica para una secuencia diana elegida por ellos.

Usaron un flujo de trabajo en tres etapas. Primero, **RFdiffusion2** generó la cadena principal (_backbone_) de la proteína imponiendo restricciones: los residuos catalíticos tenían que converger en el sitio activo y la secuencia objetivo tenía que encajar junto a ellos. Segundo, **ProteinMPNN** rellenó esa cadena principal con aminoácidos concretos, optimizando plegamiento, formación del sitio catalítico y complementariedad con el sustrato. Tercero, **AlphaFold3** predijo la estructura de los diseños para filtrar los que no se parecían a lo planeado. Ninguno de los modelos resultantes tenía homólogos claros en bases de datos públicas: eran proteínas nuevas.

Para la proteasa de cisteína probaron 12 _backbones_ y 69 secuencias cada uno (828 diseños). Para la de zinc, probaron 135 diseños totales, con y sin imponer una molécula de agua en la posición catalítica.

## Qué funcionó y qué no

La primera criba fue bioquímica: fusionaron cada proteasa diseñada a su secuencia diana y a una proteína fluorescente; si la fluorescencia se liberaba, había corte.

- **Proteasa de cisteína**: 13 de 69 diseños (19 %) mostraron actividad detectable. Todos eran considerablemente más lentos que la enzima natural de levadura.
- **Proteasa de zinc sin agua impuesta**: 14 de 89 con actividad débil. El modelado reveló que el agua solía ocupar mal el sitio activo, bloqueando la reacción.
- **Proteasa de zinc con agua impuesta**: los diseños restantes (cerca de 46) incluían la molécula de agua en el sitio activo; la fuente no detalla cuántos mostraron actividad, aunque indica que la imposición de agua mejoró el resultado.

Luego vino la optimización. Identificaron residuos cercanos al sitio activo que no participaban directamente en la catálisis y los mutaron sistemáticamente. La mejor variante de cisteína aceleró la hidrólisis **10⁹ veces** respecto a la reacción sin enzima, manteniendo alta especificidad. La versión v2 de la proteasa de zinc mejoró **30 veces** sobre el diseño inicial y alcanzó una aceleración de **10¹⁰ veces**. En ambos casos, la especificidad se conservaba: cortaban donde se les había programado.

## La prueba en enfermedad: cortar lo que importa

Como demostración final, rediseñaron proteasas de zinc para atacar proteínas implicadas en trastornos neurológicos. Lograron una proteasa que cortaba la proteína objetivo en un entorno celular. El estudio no detalla qué proteínas específicas ni en qué tipo celular; la noticia original señala apenas que se trató de proteínas asociadas a enfermedades neurológicas.

## Lo que el trabajo no resuelve (y por qué importa)

Aquí es donde la historia se pone interesante —y donde la prudencia es necesaria.

1. **Actividad vs. estructura**. Las herramientas actuales son excelentes esculpiendo la geometría estática: ponen los átomos en el lugar correcto. Pero la catálisis vive en la dinámica: vibraciones, redes de hidrógeno, reorganización de agua, tunelamiento de protones. Esos detalles no se capturan con restricciones puramente estructurales. Por eso las enzimas diseñadas empezaron siendo malas catalizadoras y hubo que rescatar la actividad con mutaciones aleatorias —el viejo método de prueba y error que la IA prometía superar.

2. **Entrega y sistema inmune**. Una proteasa es una proteína grande. Llegar al cerebro cruzando la barrera hematoencefálica es notoriamente difícil. Si el objetivo está dentro de la neurona, hace falta introducir el gen que codifica la proteasa (terapia génica, vectores virales, ARN mensajero), lo que añade capas de complejidad, riesgo inmunogénico y regulación.

3. **Especificidad en proteoma completo**. El trabajo muestra especificidad contra la secuencia diana en ensayos controlados. No se ha evaluado _off-target_ a escala proteómica: qué otras proteínas podrían ser cortadas accidentalmente en un entorno celular real.

4. **No es preprint, pero es un primer paso**. El artículo pasó revisión por pares en _Nature_. Sin embargo, los propios autores señalan que el software de diseño tiene solo unos años. Falta incorporar restricciones cinéticas y dinámicas en el propio algoritmo, no como parche posterior.

## Qué queda abierto

La pregunta que queda flotando no es si se pueden diseñar proteasas —ya se ha demostrado que sí—. La pregunta es **cuándo lograremos decirle a la IA "quiero una enzima que corte esta secuencia a esta velocidad" y que lo resuelva sin que tengamos que hacer evolución dirigida a ciegas después**. Mientras tanto, cada diseño exitoso es una lección: la estructura es necesaria, pero no suficiente. La vida lo supo hace millones de años; la IA apenas está aprendiendo a leer el resto de la partitura.

<!-- source_identity: source_id=ars_technica; source_name=Ars Technica Science -->
