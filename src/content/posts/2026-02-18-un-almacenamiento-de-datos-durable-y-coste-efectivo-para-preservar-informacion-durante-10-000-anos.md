---
title: 'Project Silica: qué respalda la estimación de 10.000 años de datos en vidrio'
schema_version: 2
excerpt: Microsoft investiga escritura láser en vidrio para archivos digitales. La duración milenaria es una proyección experimental, no una observación directa.
author: Noticiencias
date: 2026-02-18
categories:
  - Tecnología
permalink: ciencia/2026-02-18-un-almacenamiento-de-datos-durable-y-coste-efectivo-para-preservar-informacion-durante-10-000-anos
tags:
  - almacenamiento de datos duradero
  - vidrio para almacenamiento
  - tecnología silica
image: ~/assets/images/2026-02-18-glass-storage-concept-original.webp
image_alt: 'Ilustración conceptual generada con IA de una placa de vidrio genérica; no muestra el dispositivo ni datos del experimento.'
source_url: https://microsoft.com/en-us/research/blog/project-silicas-advances-in-glass-storage-technology/
refinery_id: '849'
headlines_variants:
  question: ¿Cómo se puede preservar la información digital a largo plazo utilizando vidrio?
  benefit: Qué se ha probado y qué queda por demostrar para archivar datos en vidrio
investigation: false
featured: false
summary_points:
  - Project Silica investiga la escritura de datos en vidrio mediante pulsos láser de femtosegundos y lectura óptica.
  - Las pruebas de envejecimiento acelerado sustentan una proyección de larga duración; nadie ha observado esos datos durante 10.000 años.
  - El trabajo estudia vidrio de sílice fundida y borosilicato, con técnicas de escritura y lectura distintas.
  - El coste completo, la disponibilidad comercial y la conservación futura de equipos y formatos de lectura requieren evaluación adicional.
glossary:
  - term: voxel de fase
    definition: Un elemento tridimensional de datos creado induciendo cambios en la estructura del vidrio mediante pulsos láser ultracortos.
  - term: femtosegundo
    definition: Una cuatrillonésima de segundo (10⁻¹⁵ s), unidad de tiempo usada para los pulsos láser que escriben en el vidrio.
  - term: vidrio de borosilicato
    definition: Vidrio que contiene sílice y boro; el estudio lo utilizó para una de las técnicas de escritura, además de ensayar otra técnica en sílice fundida.
  - term: aprendizaje automático
    definition: Técnica de inteligencia artificial que permite optimizar la codificación de símbolos en el vidrio analizando patrones de datos.
  - term: cámara de lectura
    definition: Sistema óptico que captura las modificaciones del vidrio; el sistema descrito usa un microscopio automatizado, cámara y decodificación.
fact_check:
  - label: El estudio evalúa escritura láser y lectura óptica de datos almacenados en vidrio.
    status: confirmed
  - label: La duración de 10.000 años se observó directamente al conservar música durante ese período.
    status: unsupported
  - label: Una cámara sin microscopio ni sistema de decodificación basta para recuperar los datos del experimento.
    status: unsupported
why_it_matters:
  - La estabilidad del soporte y la capacidad de leer formatos y mantener equipos son problemas distintos para cualquier archivo de larga duración.
confidence: Moderada — investigación revisada por pares con resultados de laboratorio; la vida útil prolongada se extrapola de pruebas aceleradas.
sources:
  - title: Laser writing in glass for dense, fast and efficient archival data storage
    url: https://www.nature.com/articles/s41586-025-10042-w
    publisher: Nature
    role: primary
    doi: 10.1038/s41586-025-10042-w
  - title: Project Silica's advances in glass storage technology
    url: https://microsoft.com/en-us/research/blog/project-silicas-advances-in-glass-storage-technology/
    publisher: Microsoft Research
    role: secondary
corrected_at: '2026-11-01'
correction_summary: Se distinguió la duración proyectada de una prueba real, se corrigió la lectura y se precisó qué propiedad térmica mide la extrapolación, además de la definición de borosilicato.
requires_uncertainty_note: true
uncertainty_note: La vida útil de miles de años es una extrapolación experimental; no demuestra disponibilidad comercial ni garantiza que formatos y lectores sigan utilizables.
---

**Corrección, 31 de octubre de 2026; ampliada el 1 de noviembre.** Una versión anterior afirmó que se había conservado música durante 10.000 años y que bastaba una cámara para leer los datos. La duración es una proyección y el sistema de lectura incluye un microscopio y decodificación. También retiramos afirmaciones comerciales no demostradas y precisamos qué se extrapoló y cómo se llama el vidrio estudiado.

¿Qué haría falta para conservar un archivo digital durante miles de años? El soporte debe resistir, pero también deben sobrevivir las instrucciones, el equipo y los formatos necesarios para leerlo. [Project Silica](https://www.nature.com/articles/s41586-025-10042-w), de Microsoft Research, aborda la primera parte mediante escritura láser en vidrio.

## Cómo se guardan y leen los datos

Los investigadores emplean pulsos láser ultracortos para modificar regiones diminutas dentro del vidrio, llamadas vóxeles, y organizar datos en capas. El estudio describe dos tipos de modificación óptica y pruebas con sílice fundida y vidrio de borosilicato. Para recuperar la información se capturan imágenes con un **microscopio automatizado y una cámara** y se procesan mediante un decodificador. No basta con mirar la placa con una cámara cualquiera.

El equipo también estudió escritura paralela y métodos de codificación. Se trata de resultados de investigación obtenidos con equipos específicos: que el material se parezca al de algunos utensilios de cocina no significa que un utensilio doméstico sea, por sí solo, un dispositivo de archivo funcional.

## Qué significa «10.000 años»

La estimación procede de ensayos de envejecimiento acelerado y de un modelo que extrapola el comportamiento observado a períodos mucho más largos. En concreto, los autores estudiaron la estabilidad térmica de **vóxeles de fase en borosilicato**: midieron cómo decaían sus modificaciones a temperaturas elevadas y extrapolaron el tiempo característico de ese decaimiento. La estimación supera 10.000 años a 290 °C bajo las condiciones del modelo.

Ese resultado describe la estabilidad térmica de las marcas, no una prueba de recuperación íntegra de un archivo después de diez milenios. El estudio señala que la extrapolación no incluye factores externos como esfuerzos mecánicos o corrosión química; tampoco garantiza la supervivencia del sistema de lectura.

Microsoft ha mostrado demostraciones de preservación de contenidos, pero estas no han transcurrido durante milenios. Aun si el vidrio conserva las marcas, un archivo futuro necesita lectores operativos, software, información sobre los formatos y una estrategia para evitar pérdidas o roturas.

## Lo que queda por evaluar

El precio del material es solo una parte del costo: fabricar, escribir, leer, mantener y recuperar un archivo requiere infraestructura. Las fuentes consultadas no demuestran aquí un costo total menor para una institución latinoamericana ni una reducción ambiental frente a otras opciones. Esas comparaciones requieren condiciones y mediciones concretas.

<!-- source_identity: source_id=microsoft_research; source_name=Microsoft Research -->
