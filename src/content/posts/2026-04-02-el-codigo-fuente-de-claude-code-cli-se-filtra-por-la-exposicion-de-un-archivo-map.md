---
title: El código fuente de Claude Code Cli se filtra por la exposición de un archivo Map.
schema_version: 2
date: 2026-04-02
author: Noticiencias AI
categories:
- Ciencia
permalink: ciencia/2026-04-02-el-codigo-fuente-de-claude-code-cli-se-filtra-por-la-exposicion-de-un-archivo-map
tags:
- claude code
- anthropic
- source maps
- seguridad de software
excerpt: 'Un error de empaquetado dejó expuesto un source map de Claude Code y permitió reconstruir más de 512.000 líneas del proyecto. El incidente ofrece lecciones concretas sobre propiedad intelectual y seguridad.'
source_url: https://arstechnica.com/ai/2026/03/entire-claude-code-cli-source-code-leaks-thanks-to-exposed-map-file/
refinery_id: Entire Claude Code Cli Source Code Leaks Thanks To Exposed Map File
image: "~/assets/images/default.png"
image_alt: "Ilustración editorial para la filtración del código fuente de Claude Code CLI"
headlines_variants:
  question: ¿Cómo un simple archivo Map pudo exponer el código fuente completo de Claude Code Cli?
  benefit: Aprende del incidente de Claude Code Cli para proteger tu propio código de archivos Map expuestos.
---

## Un error de empaquetado deja al descubierto el interior de *Claude Code CLI*

El código fuente completo de la interfaz de línea de comandos *Claude Code CLI* quedó expuesto tras un error interno de empaquetado en Anthropic. La filtración no comprometió los modelos de IA ni, según la empresa, datos de clientes o credenciales, pero sí dejó a la vista una parte estratégica del producto: casi 2.000 archivos TypeScript y más de 512.000 líneas de código que describen cómo funciona una de las herramientas de programación asistida por IA más observadas del mercado.

El incidente comenzó cuando Anthropic publicó la versión 2.1.88 del paquete de *Claude Code* en npm. Junto con esa entrega viajó un archivo *source map*, un recurso pensado para depuración que permite reconstruir el código original a partir del paquete distribuido. En cuestión de horas, investigadores y desarrolladores comprobaron que ese archivo bastaba para acceder a prácticamente toda la base de código de la aplicación.

El primero en señalarlo públicamente fue el investigador de seguridad Chaofan Shou, quien compartió el hallazgo en X junto con un enlace a un archivo que contenía los ficheros expuestos. Después, el material fue copiado a un repositorio público de GitHub y empezó a circular a gran velocidad. Para entonces, el daño principal ya no era la mera publicación accidental, sino la facilidad con la que terceros podían descargar, estudiar y republicar la arquitectura interna del producto.

Anthropic reconoció el error en una declaración enviada a varios medios. La compañía sostuvo que se trató de un fallo humano en el proceso de publicación, no de una intrusión, y afirmó que no hubo exposición de información sensible de clientes. También aseguró que estaba desplegando medidas para evitar que un incidente similar volviera a ocurrir.

La rapidez con la que la comunidad comenzó a analizar el código muestra por qué esta clase de fugas importa incluso cuando no se filtran secretos operativos inmediatos. Algunos desarrolladores ya publicaron resúmenes sobre la arquitectura de memoria de *Claude Code*, incluyendo mecanismos de reescritura de memoria en segundo plano y pasos de verificación para decidir qué recuerdos conservar o reutilizar. Otros se enfocaron en el tamaño y la organización de subsistemas enteros, como el sistema de herramientas y el motor de consultas, para evaluar qué tan sofisticada es realmente la experiencia de desarrollo que Anthropic ha construido.

Ese acceso masivo ofrece ventajas obvias a competidores: acelera la comprensión de decisiones de producto, revela áreas donde Anthropic ya invirtió esfuerzo técnico y ayuda a identificar qué piezas podrían replicarse o atacarse desde otros proyectos. Pero también abre un ángulo más delicado: actores maliciosos disponen ahora de más pistas para examinar la superficie de seguridad de la herramienta y estudiar cómo rodear algunos de sus *guardrails*.

El episodio deja una lección incómoda para cualquier equipo que distribuya software moderno. Los *source maps* son útiles para depurar, pero si terminan en el artefacto equivocado pueden transformar un simple error de publicación en una fuga masiva de propiedad intelectual. En un mercado de agentes de código que evoluciona con rapidez, esa exposición puede influir durante semanas o meses en cómo compiten los rivales, cómo investiga la comunidad y cómo priorizan las empresas sus controles de empaquetado y revisión antes de cada lanzamiento.

Fuente original: [https://arstechnica.com/ai/2026/03/entire-claude-code-cli-source-code-leaks-thanks-to-exposed-map-file/](https://arstechnica.com/ai/2026/03/entire-claude-code-cli-source-code-leaks-thanks-to-exposed-map-file/)

<!-- source_identity: source_id=ars_technica; source_name=Ars Technica Science -->
