---
title: 'Muse Glimmer: IA de 30 B que cabe en una sola GPU'
schema_version: 2
date: 2026-08-10
author: Noticiencias AI
categories:
  - Tecnología
tags:
  - muse glimmer
  - modelo multimodal
  - gpu h100
  - licencia apache 20
  - parámetros 30b
excerpt: Meta lanza Muse Glimmer, modelo multimodal de 30 000 millones de parámetros que funciona en una sola GPU H100 bajo licencia Apache 2.0, permitiendo uso local y abierto.
image: ~/assets/images/2026-08-10-meta-is-back-with-muse-glimmer-local-agentic-multimodal-and-open-source.png
image_alt: 'Ilustración editorial relacionada con Muse Glimmer: IA de 30 B que cabe en una sola GPU'
source_url: https://huggingface.co/blog/muse-glimmer
refinery_id: '492'
headlines_variants:
  question: ¿Cómo logró Meta que un modelo de 30 B quepa en una sola GPU?
  benefit: Ejecutá IA de 30 B en tu PC sin enviar datos a la nube
summary_points:
  - Muse Glimmer es un modelo multimodal de 30 000 millones de parámetros de Meta que puede ejecutarse localmente en una sola GPU de alta gama.
  - Combina un decodificador de texto de 28 B con un codificador de visión tipo ViT de ~2 B y usa optimizaciones como cabezas clave‑valor compartidas y normalización RMS para reducir memoria y acelerar la generación.
  - Liberado bajo licencia Apache 2.0, supera a modelos comparables como Gemma4‑31B y Qwen3.6‑27B en benchmarks de agentes, código y razonamiento multimodal.
glossary:
  - term: Muse Glimmer
    definition: Modelo multimodal de lenguaje y visión de Meta con 30 B de parámetros, diseñado para ejecutarse localmente bajo licencia abierta.
  - term: Vision Transformer (ViT)
    definition: Arquitectura de red neuronal que procesa imágenes dividiéndolas en parches y aplicando mecanismos de atención, utilizada como codificador de visión en Muse Glimmer.
  - term: Licencia Apache 2.0
    definition: Licencia de código abierto permisiva que permite usar, modificar y distribuir el software, incluido el uso comercial, siempre que se preserve el aviso de licencia y se indique cualquier cambio.
  - term: Caché KV
    definition: Almacenamiento de las claves y valores calculados durante la atención que se reutilizan en pasos posteriores de generación; reducir su tamaño disminuye el consumo de memoria.
  - term: LoRA
    definition: Low‑Rank Adaptation, técnica de ajuste fino que actualiza solo matrices de bajo rango para adaptar un modelo grande con pocos recursos computacionales.
  - term: GRPO
    definition: Generative Reward‑Weighted Policy Optimization, método de refinamiento de modelos basado en recompensas para mejorar la calidad de la generación.
fact_check:
  - label: Muse Glimmer tiene 30 billones de parámetros.
    status: confirmed
  - label: Muse Glimmer puede ejecutarse en una sola GPU NVIDIA H100.
    status: uncertain
  - label: En el benchmark MCP Atlas de agentes generales, Muse Glimmer obtiene 75,5 puntos, superando a Gemma4‑31B y Qwen3.6‑27B (~60 puntos).
    status: confirmed
  - label: En SWE‑Bench Pro, Muse Glimmer alcanza 51,2 puntos, frente a 36,9 de Gemma4‑31B y 50,2 de Qwen3.6‑27B.
    status: confirmed
  - label: Muse Glimmer se publica bajo la licencia Apache 2.0.
    status: confirmed
  - label: En una GPU de consumo medio la velocidad de generación de Muse Glimmer puede caer significativamente.
    status: uncertain
why_it_matters:
  - Para desarrolladores en América Latina, contar con un modelo potente que funciona localmente reduce la dependencia de servicios en la nube costosos y mejora la privacidad de los datos.
  - Su disponibilidad bajo licencia abierta permite crear asistentes y herramientas en español que pueden operar sin conexión, lo que resulta valioso en regiones con conectividad limitada.
confidence: Alta — información provista por el blog técnico de Hugging Face con datos específicos de benchmarks, arquitectura y licencia, aunque el artículo no indica revisión por pares explícita.
sources:
  - title: Muse Glimmer
    url: https://huggingface.co/blog/muse-glimmer
    publisher: Hugging Face
    date: ''
requires_uncertainty_note: true
uncertainty_note: Aunque Meta afirma que mantiene la capacidad multimodal, el artículo no muestra benchmarks comparativos que confirmen su rendimiento frente al modelo original en todas las tareas.
social:
  publish: true
  id: e9ff1cb08ae2c02fd37d7a31dac39c047c47b6407a277b0f546c59bbb8996e16
---

Treinta mil millones de parámetros suenan a cifra de centro de datos, pero Meta los ha comprimido en un modelo que cabe en una sola tarjeta gráfica de alta gama. Se llama Muse Glimmer y combina visión y texto para funcionar localmente bajo licencia Apache 2.0.

## Contexto del fenómeno

Los modelos de lenguaje grande (_large language model_, LLM) más potentes suelen requerir clusters completos de servidores, lo que restringe su uso a quienes pueden pagar por esos recursos o que no temen enviar información sensible a terceros. Meta partió de esa limitación y lanzó una versión “destilada” de su anterior modelo Muse, reduciéndola a 30 B de parámetros pero manteniendo su capacidad multimodal. El resultado es un sistema que puede ejecutarse en una sola GPU H100 o en varias tarjetas menos potentes usando técnicas de paralelismo, y que, al ser de código abierto bajo Apache 2.0, permite a cualquiera inspeccionarlo, modificarlo y desplegarlo donde le resulte más cómodo.

## Qué hicieron los investigadores

Partiendo de Muse, el equipo recortó el decodificador de texto a 28 B de parámetros y mantuvo un codificador de visión tipo ViT (Vision Transformer) de aproximadamente 2 B que transforma imágenes y video en una representación comprensible para el lenguaje. El codificador procesa cada cuadro por separado, los agrupa en marcos de dos frames y aplica una atención que combina ventanas locales con una capa global, usando incrustaciones de posición rotary (RoPE) y una variante sin posición (NoPE) para capturar tanto detalles locales como el contexto global. El decodificador de texto emplea una atención híbrida: tres capas de ventana deslizante de 2 048 tokens seguidas de una capa de atención completa, patrón que se repite trece veces. Además, las cabezas clave‑valor se comparten entre dieciséis cabezas de consulta, lo que reduce la memoria necesaria para el caché KV en un factor de dieciséis y acelera la generación. Antes de calcular la atención, se aplica una normalización RMS a consultas y claves y se escala el resultado, lo que estabiliza los logits y se comporta como una temperatura inversa a nivel de softmax. Un componente opcional llamado DFlash añade un boceto de difusión ligero que puede predecir varios tokens futuros; usarlo acelera la generación a costa de un poco más de memoria y resulta particularmente útil para tareas estructuradas como la generación de código.

## Qué encontraron

En los benchmarks de agentes públicos, Muse Glimmer supera a modelos de tamaño comparable como Gemma4‑31B y Qwen3.6‑27B en la mayoría de las pruebas. Por ejemplo, en el reto MCP Atlas de agentes generales obtiene 75,5 puntos, mientras que sus competidores quedan alrededor de 60. En tareas de código, como SWE‑Bench Pro, llega a 51,2 frente a 36,9 y 50,2 de los otros dos. En razonamiento multimodal, las puntuaciones en Charxiv Reasoning o ScreenSpot Pro se mantienen por encima de 75, mostrando que la visión y el lenguaje se integran sin perder precisión. En cuanto a seguridad, el modelo muestra una baja tasa de éxito en ataques de tipo “Siren AgentDojo” (28,4 % frente a 40,3 % de Qwen3.6‑27B) y una menor proporción de memorias violadas en la prueba CI (26,4 % frente a 53,4 %). Estas cifras sugieren que, aunque no está exento de riesgos, su comportamiento es más contenido que el de algunos rivales de escala similar.

## Límites y alcance real

Aunque Muse Glimmer promete ejecutar un modelo grande de forma local, aún depende de hardware de alta gama para ofrecer su mejor rendimiento; en una GPU de consumo medio la velocidad de generación puede caer significativamente. Además, aunque los benchmarks muestran ventajas claras, el comportamiento en aplicaciones del mundo real — como asistentes que interactúan con usuarios durante horas prolongadas — todavía necesita pruebas extensivas. La comunidad ahora tiene la posibilidad de explorar esos límites, ajustar el modelo mediante LoRA o GRPO, y evaluar cómo se comporta cuando se combina con herramientas externas mediante la funcionalidad de llamada de herramientas multimodal.

## Cómo encaja en el conocimiento existente

El lanzamiento se enmarca en la tendencia creciente de llevar la potencia de los LLM al escritorio, priorizando la privacidad y la autonomía del usuario. Al liberar el código bajo una licencia permisiva y ofrecer opciones de ejecución en diversas arquitecturas de GPU (CUDA, ROCm, XPU), Meta se alinea con proyectos anteriores como Llama y con iniciativas de código abierto que buscan democratizar el acceso a la inteligencia artificial sin depender exclusivamente de la nube.

La pregunta que queda es cuántos desarrolladores y investigadores lograrán exprimir esa capacidad local para crear aplicaciones que antes requerían la nube. El próximo paso está en tus manos.

<!-- source_identity: source_id=hugging_face_blog; source_name=Hugging Face Blog -->
