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
excerpt: Meta lanza Muse Glimmer, modelo multimodal de 30 000 millones de parámetros que según Meta funcionaría en una sola GPU H100 bajo licencia Apache 2.0, permitiendo uso local y abierto.
image: '~/assets/images/2026-11-01-multimodal-chip-concept-original.webp'
image_alt: 'Ilustración conceptual generada con IA de un procesador y señales multimedia; no representa hardware ni resultados de Muse Glimmer.'
source_url: https://huggingface.co/blog/muse-glimmer
series: 'IA en la práctica'
refinery_id: '492'
headlines_variants:
  question: ¿Cómo logró Meta que un modelo de 30 B quepa en una sola GPU?
  benefit: Qué se necesita para ejecutar un modelo multimodal localmente
summary_points:
  - Muse Glimmer es un modelo multimodal de 30 000 millones de parámetros de Meta que puede ejecutarse localmente en una sola GPU de alta gama.
  - Combina un decodificador de texto de 28 B con un codificador de visión tipo ViT de ~2 B y usa optimizaciones como cabezas clave‑valor compartidas y normalización RMS para reducir memoria y acelerar la generación.
  - Meta publica los pesos bajo Apache 2.0 y comunica resultados en varios benchmarks; esas cifras dependen de la configuración y no sustituyen una evaluación independiente.
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
    definition: Group Relative Policy Optimization, método de optimización de políticas que compara grupos de respuestas candidatas mediante recompensas para mejorar la calidad de la generación.
fact_check:
  - label: Muse Glimmer tiene 30 mil millones de parámetros.
    status: confirmed
  - label: Muse Glimmer puede ejecutarse en una sola GPU NVIDIA H100.
    status: uncertain
  - label: En la tabla publicada por Hugging Face, MCP Atlas atribuye 75,5 puntos a Muse Glimmer, 54,2 a Gemma4-31B y 62,5 a Qwen3.6-27B.
    status: confirmed
  - label: La tabla publicada por Hugging Face atribuye en SWE‑Bench Pro 51,2 puntos a Muse Glimmer, 36,9 a Gemma4‑31B y 50,2 a Qwen3.6‑27B.
    status: confirmed
  - label: Muse Glimmer se publica bajo la licencia Apache 2.0.
    status: confirmed
  - label: En una GPU de consumo medio la velocidad de generación de Muse Glimmer puede caer significativamente.
    status: uncertain
why_it_matters:
  - La ejecución local puede reducir la necesidad de enviar entradas a un servicio externo, pero la privacidad depende de la configuración, las herramientas y el tratamiento de datos.
  - Comparar memoria, formato y contexto ayuda a evaluar si el modelo cabe en un equipo concreto; una H100 no es una GPU de consumo medio.
confidence: Moderada — ficha del modelo y documentación de Meta; rendimiento y seguridad no se probaron de manera independiente en esta nota.
sources:
  - title: Muse Glimmer Model Card
    url: https://huggingface.co/meta-models/Muse-Glimmer-30B
    publisher: Meta Superintelligence Labs
    role: primary
  - title: Meta is back with Muse Glimmer
    url: https://huggingface.co/blog/muse-glimmer
    publisher: Hugging Face
    role: secondary
  - title: Muse Glimmer documentation
    url: https://dev.meta.ai/docs/muse-glimmer
    publisher: Meta
    role: primary
requires_uncertainty_note: true
uncertainty_note: Las cifras de rendimiento dependen de la evaluación y configuración; esta nota no probó hardware, seguridad ni comportamiento en aplicaciones reales.
corrected_at: '2026-11-02'
correction_summary: Se identificó la ficha oficial, se corrigieron los comparadores de MCP Atlas y se limitaron las promesas sobre hardware, privacidad y rendimiento. Se aclaró que los resultados de SWE‑Bench Pro son cifras publicadas por la fuente, no pruebas reproducidas por esta nota.
social:
  publish: true
  id: e9ff1cb08ae2c02fd37d7a31dac39c047c47b6407a277b0f546c59bbb8996e16
---

**Corrección, 31 de octubre de 2026; ampliada el 2 de noviembre.** La versión anterior agrupaba dos resultados distintos como «alrededor de 60», presentaba pruebas del proveedor como ventajas generales y prometía ejecución en cualquier PC. Ahora identificamos los resultados y sus límites, incluida la atribución de las cifras de SWE‑Bench Pro, y añadimos la ficha del modelo.

Muse Glimmer es un modelo de Meta de unos **30.000 millones de parámetros** que recibe texto e imágenes y genera texto. La [ficha oficial](https://huggingface.co/meta-models/Muse-Glimmer-30B) identifica los pesos publicados bajo licencia Apache 2.0 y describe variantes para ejecución local. «Local» indica dónde se ejecuta el modelo; no significa que cualquier computadora tenga memoria suficiente ni garantiza por sí solo privacidad o seguridad.

## Qué exige ejecutarlo

La memoria necesaria depende del formato de los pesos, la cuantización, el contexto, la entrada visual y el programa utilizado. Una NVIDIA H100 es hardware de centro de datos, no una tarjeta de consumo corriente. Hay variantes optimizadas para otros equipos, pero esta nota no las ejecutó ni midió su velocidad o consumo; conviene contrastar el formato y los requisitos del entorno antes de elegir uno.

La [documentación de Meta](https://dev.meta.ai/docs/muse-glimmer) describe una ventana de contexto predeterminada de 128.000 tokens y entradas de texto e imagen. Las capacidades y los límites efectivos dependen también del programa que lo ejecute.

## Cómo leer las comparaciones

En la tabla publicada por [Hugging Face](https://huggingface.co/blog/muse-glimmer), Muse Glimmer obtuvo 75,5 puntos en MCP Atlas frente a 54,2 de Gemma4-31B y 62,5 de Qwen3.6-27B, bajo las configuraciones indicadas por la fuente. Son resultados de esa evaluación, no una garantía de superioridad en todas las tareas. La nota no ha reproducido las pruebas; otras tareas, versiones y configuraciones pueden alterar la comparación.

## Privacidad y riesgos

Ejecutar el modelo sin conexión puede evitar que las entradas se envíen a un proveedor de inferencia, siempre que el programa y las herramientas conectadas no las transmitan. Un agente con acceso a archivos o servicios sigue necesitando permisos limitados y revisión de sus acciones. La licencia de los pesos tampoco elimina la necesidad de revisar las condiciones de los demás componentes y datos utilizados.

<!-- source_identity: source_id=hugging_face_blog; source_name=Hugging Face Blog -->
