---
title: 'Elias y los faros: por qué cuatro modelos de IA repiten historias parecidas'
schema_version: 1
date: 2026-06-12
author: Noticiencias AI
categories:
  - Tecnología
tags:
  - elias thorne
  - wildchat
  - gpt 35
  - generación de ficción
  - modelos de lenguaje
excerpt: 'Un estudio de 20.000 relatos encontró que el 88,3 % incluía al menos uno de once términos recurrentes. Los investigadores no demostraron qué causa esa repetición.'
image: ~/assets/images/2026-06-12-chatbots-keep-telling-stories-about-lighthouse-keeper-elias-thorne-we-might-know-why.jpg
image_alt: Un hombre de espaldas observa el mar, con bañistas y pequeñas embarcaciones al fondo
source_url: https://arxiv.org/abs/2605.26492
series: 'IA en la práctica'
refinery_id: Chatbots Keep Telling Stories About Lighthouse Keeper 'Elias Thorne'. We Might Know Why
headlines_variants:
  question: ¿Por qué cuatro modelos de IA vuelven una y otra vez a los mismos nombres y escenarios cuando escriben cuentos?
  benefit: Lo que revelan 20.000 relatos sobre la falta de diversidad narrativa de los modelos de lenguaje
requires_uncertainty_note: true
uncertainty_note: 'El estudio documenta la repetición de ciertos términos, pero no establece una causa definitiva: la influencia de los datos de entrenamiento posterior y de las técnicas de alineamiento sigue siendo una hipótesis.'
---

Un farero, un relojero, un personaje llamado Elias. Si se pide a algunos modelos de inteligencia artificial que escriban un cuento sin más instrucciones, esos nombres y escenarios aparecen con una frecuencia sorprendente. El fenómeno existe, pero no significa que todos los modelos cuenten exactamente la misma historia ni que se haya demostrado de dónde procede la repetición.

En mayo de 2026, Sil Hamilton y David Mimno, de la Universidad de Cornell, publicaron un [estudio sobre diversidad narrativa en modelos de lenguaje](https://arxiv.org/abs/2605.26492). Su pregunta fue concreta: ¿hasta qué punto se parecen las historias que producen distintos sistemas cuando reciben consignas sencillas?

## Qué midieron los investigadores

El equipo generó **20.000 relatos** con cuatro modelos de diferentes proveedores. Utilizó cinco variantes, en inglés, de una petición tan abierta como «cuéntame una historia». Cada modelo recibió 1.000 solicitudes por variante.

Después examinó los nombres, profesiones y lugares que aparecían en las respuestas. Encontró un grupo de **once términos recurrentes**, entre ellos «Elias», «Mara», «Elara», «faro», «relojero» y «bibliotecario».

El dato central requiere precisión: **el 88,3 % de las historias contenía al menos uno de esos once términos**. No quiere decir que ese porcentaje incluyera las once palabras a la vez, ni que todos los relatos tuvieran la misma trama.

Algunas coincidencias resultaron especialmente visibles. La palabra inglesa *lighthouse* («faro») apareció en el 51,2 % de los textos, y «Elias» en el 26,5 %. Los investigadores también hallaron diferencias entre modelos y combinaciones de personajes, profesiones y ambientes.

## ¿Por qué vuelven los modelos al faro?

Una explicación posible es que los sistemas hayan aprendido patrones narrativos similares durante el entrenamiento, especialmente en las etapas posteriores de ajuste y alineamiento. Sin embargo, **el trabajo no demuestra que esa sea la causa**.

Para investigarla, los autores analizaron conjuntos de datos públicos relacionados con OLMo 3. Encontraron que, de **78.958 historias** presentes en sus datos de entrenamiento posterior, solo unas **3.053 (el 3,8 %)** contenían uno o más de esos términos. Es decir, la recurrencia de esos elementos en los relatos generados era mucho mayor que su presencia en los ejemplos de entrenamiento que pudieron estudiar.

También examinaron datos derivados de *WildChat*, un conjunto de conversaciones con asistentes, pero eso **no permite afirmar que ChatGPT, Claude o Gemini hayan adquirido el patrón a partir de ese mismo corpus**. Los registros completos de entrenamiento de esos modelos no formaban parte de la comparación pública.

Los autores plantean otra posibilidad: los ajustes que buscan evitar contenido problemático o referencias a personajes protegidos por derechos de autor podrían favorecer relatos considerados más seguros y convencionales. La presentan como **una hipótesis para futuras investigaciones**, no como un mecanismo confirmado.

## Qué demuestra y qué no

El estudio aporta evidencia de una **diversidad limitada en las historias creadas a partir de instrucciones muy abiertas**. Esa uniformidad importa: si varias herramientas sugieren una y otra vez los mismos personajes, escenarios y giros, el usuario podría recibir menos variedad de la que aparenta ofrecer la generación automática.

Pero hay límites claros:

- Las cinco instrucciones del experimento estaban en **inglés**. Los resultados no se pueden extrapolar sin más a solicitudes en español.
- Se estudiaron **cuatro modelos** en un momento determinado, no todos los sistemas de IA ni todas sus versiones.
- El diseño permite medir frecuencia y comparar distribuciones, **no reconstruir con certeza las decisiones de entrenamiento** de los modelos comerciales.
- No significa que esos relatos sean falsos, plagiados o inútiles. El problema observado es su semejanza estadística.

Para quien utiliza IA para escribir, la lección práctica no es que deba evitar un faro o el nombre Elias. Es más útil preguntarse si una consigna demasiado genérica está llevando al sistema hacia soluciones previsibles. Dar contexto, personajes y restricciones propias puede ser una estrategia creativa razonable, aunque este estudio no evaluó directamente si esas técnicas resuelven el fenómeno.

La pregunta científica permanece abierta: **¿qué partes del entrenamiento y del diseño de estos modelos explican que un conjunto relativamente pequeño de elementos narrativos aparezca tan a menudo?** Sabemos que el patrón existe en la muestra estudiada; todavía no sabemos por qué aparece con tanta fuerza.

**Nota de corrección (9 de octubre de 2026).** La versión anterior afirmaba que más del 88 % de los relatos compartía las mismas once palabras; el estudio solo midió la presencia de *al menos una* de ellas. También presentaba como comprobadas varias hipótesis sobre entrenamiento, alineamiento y propagación entre modelos. Esas afirmaciones se corrigieron y se añadió como referencia principal el estudio original.

**Fuentes:** [Hamilton y Mimno, *Elias in the Lighthouse, Again? Diagnosing Low Diversity in LLM Stories*, arXiv (2026)](https://arxiv.org/abs/2605.26492). El fenómeno también fue [investigado periodísticamente por 404 Media](https://www.404media.co/elias-thorne-chatbots-llms-chatgpt-lighthouse-keeper-story/).

<!-- source_identity: source_id=media_404; source_name=404 Media -->
