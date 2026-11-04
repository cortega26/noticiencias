---
title: 'Google analiza instrucciones dirigidas a asistentes de IA en páginas web'
schema_version: 2
date: 2026-04-24
corrected_at: '2026-11-02'
correction_summary: 'Se acotaron las conclusiones al archivo y método estudiados por Google, se retiraron ejemplos hipotéticos presentados como casos observados y se precisó que no todas las instrucciones descritas eran necesariamente ocultas.'
author: Noticiencias AI
categories:
  - Tecnología
tags:
  - inyección indirecta
  - common crawl
  - google threat intelligence
excerpt: Un análisis de Google encontró intentos de dirigir asistentes de IA mediante instrucciones en páginas web; sus resultados no abarcan toda la internet.
image: ~/assets/images/2026-04-24-indirect-prompt-injection-original.webp
image_alt: 'Ilustración conceptual generada con IA de una página web con instrucciones ocultas en una capa subyacente que desvían la respuesta de un asistente de IA'
source_url: https://security.googleblog.com/2026/04/ai-threats-in-wild-current-state-of.html
series: 'IA en la práctica'
refinery_id: 'AI threats in the wild: The current state of prompt injections on the web'
headlines_variants:
  question: ¿Cómo pueden las páginas web intentar manipular a los asistentes de IA?
  benefit: Entender la inyección indirecta ayuda a interpretar los límites de los asistentes que consultan fuentes externas.
requires_uncertainty_note: true
summary_points:
  - Google analizó una muestra de la web pública en busca de patrones de inyección indirecta de instrucciones.
  - Encontró desde bromas y directrices para resúmenes hasta intentos de promoción, robo de datos o destrucción.
  - Los hallazgos no prueban que los intentos hayan tenido éxito; el método y la muestra tienen límites.
glossary:
  - term: Inyección indirecta
    definition: Intento de alterar el comportamiento de una IA mediante instrucciones incluidas en contenido externo que procesa.
  - term: Common Crawl
    definition: Archivo de páginas web rastreadas que ofrece capturas periódicas para investigación.
fact_check:
  - label: Google examinó patrones de inyección indirecta en archivos de Common Crawl.
    status: confirmed
  - label: Google observó un aumento relativo del 32 % en detecciones de la categoría maliciosa entre noviembre de 2025 y febrero de 2026.
    status: confirmed
  - label: El análisis permite medir todos los ataques contra asistentes de IA en internet.
    status: uncertain
why_it_matters:
  - Los asistentes que consultan páginas o documentos pueden encontrarse con instrucciones que entran en conflicto con lo que les pidió su usuario.
confidence: Moderada — se describe un análisis de Google con alcance y método limitados, no una medición global de ataques exitosos.
sources:
  - title: 'AI threats in the wild: The current state of prompt injections on the web'
    url: https://security.googleblog.com/2026/04/ai-threats-in-wild-current-state-of.html
    publisher: Google Security Blog
    date: '2026-04-23'
    role: primary
  - title: 'Not what you’ve signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection'
    url: https://arxiv.org/abs/2302.12173
    publisher: arXiv
    date: '2023-02-23'
    role: primary
    doi: 10.48550/arXiv.2302.12173
uncertainty_note: El análisis cubrió patrones conocidos en un archivo parcial de la web y puede omitir otras técnicas y plataformas.
---

**Corrección y actualización, 2 de noviembre de 2026.** El titular anterior podía sugerir que todas las instrucciones encontradas estaban ocultas. Google describe ejemplos de distintos tipos; al menos uno estaba en el código fuente y era invisible para el lector. También se acotaron previamente las conclusiones al archivo y método estudiados.

Un asistente de IA que consulta una página web puede encontrar texto dirigido a él en lugar de información para responder al usuario. Si trata esas instrucciones externas como órdenes, podría alterar su respuesta o intentar una acción no solicitada. Esa técnica se conoce como **inyección indirecta de instrucciones**.

Un [trabajo de 2023 de Greshake y colaboradores](https://arxiv.org/abs/2302.12173) ya había explorado el problema mediante demostraciones en aplicaciones conectadas a modelos de lenguaje. Esas pruebas muestran que la técnica puede funcionar en los sistemas y condiciones examinados; no miden por sí solas su frecuencia en la web ni confirman los hallazgos posteriores de Google. El análisis de Google aborda otra pregunta: qué instrucciones de este tipo aparecen en un archivo de páginas públicas.

En abril de 2026, [investigadores de Google](https://security.googleblog.com/2026/04/ai-threats-in-wild-current-state-of.html) publicaron un análisis de este tipo de intentos en la web pública. Encontraron instrucciones con propósitos diversos, desde bromas hasta intentos de promover negocios, extraer datos o borrar archivos. Encontrar una instrucción no demuestra que un asistente la haya obedecido.

## Cómo buscaron

El equipo examinó capturas de Common Crawl, un archivo de páginas públicas, principalmente en inglés. Primero buscó patrones conocidos; después empleó un modelo para clasificar los textos y revisó manualmente los resultados. Los investigadores advierten que este método puede pasar por alto instrucciones que no coincidan con los patrones buscados.

También hay falsos positivos: una página que explica una técnica puede incluir ejemplos sin intentar atacar a nadie. Distinguir ese contexto de un intento real forma parte de la dificultad.

## Qué encontraron y qué no puede concluirse

Google agrupó los intentos observados en bromas, indicaciones para resúmenes, promoción en buscadores, disuasión de agentes y casos maliciosos orientados a extraer información o destruir archivos. La empresa describió muchos ejemplos como experimentos individuales y señaló que no observó una cantidad significativa de ataques avanzados de exfiltración en la muestra.

En la categoría maliciosa, las detecciones aumentaron un 32 % relativo entre noviembre de 2025 y febrero de 2026, según Google. Ese dato describe las detecciones del análisis, no el número de ataques exitosos ni la evolución de toda internet. El archivo no cubre la mayor parte de las redes sociales y el método no es exhaustivo.

La conclusión práctica es acotada: cuando un asistente incorpora información externa, necesita tratarla como contenido de una fuente y no asumir que es una instrucción legítima del usuario. Comprobar las fuentes de una respuesta ayuda a evaluarla, aunque no elimina por sí solo este riesgo.

<!-- source_identity: source_id=google_security_blog; source_name=Google Security Blog -->
