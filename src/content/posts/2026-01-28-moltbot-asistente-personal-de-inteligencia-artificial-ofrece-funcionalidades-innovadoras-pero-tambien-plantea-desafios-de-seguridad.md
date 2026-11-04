---
title: 'De Moltbot a OpenClaw: qué permisos necesita un asistente de IA'
schema_version: 2
excerpt: 'El proyecto pasó a llamarse OpenClaw. Sus herramientas pueden actuar sobre el equipo según la configuración, por lo que el aislamiento y los permisos importan.'
author: Noticiencias
date: 2026-01-28
categories:
  - 'Tecnología'
tags:
  - 'seguridad'
  - 'inteligencia artificial'
  - 'asistente personal'
image: '~/assets/images/2026-11-01-personal-assistant-concept-original.webp'
image_alt: 'Ilustración conceptual generada con IA de un asistente digital y sus permisos; no muestra la interfaz de OpenClaw.'
source_url: 'https://techcrunch.com/2026/01/27/everything-you-need-to-know-about-viral-personal-ai-assistant-clawdbot-now-moltbot/'
series: 'IA en la práctica'
refinery_id: '343'
headlines_variants:
  question: ''
  benefit: ''
investigation: false
featured: false
summary_points:
  - El proyecto se llamó Clawdbot y Moltbot antes de adoptar el nombre OpenClaw en enero de 2026.
  - Sus herramientas pueden ejecutar acciones en el equipo según los permisos y la configuración elegidos.
  - El aislamiento limita ciertos accesos, pero la documentación advierte que no constituye una barrera perfecta.
  - Los permisos, credenciales y canales conectados determinan qué daños podría causar una acción no deseada.
glossary:
  - term: asistente personal de inteligencia artificial
    definition: Programa que utiliza técnicas de IA para realizar tareas cotidianas del usuario, como gestionar agendas o enviar mensajes, actuando en su nombre.
  - term: ejecutar comandos arbitrarios
    definition: Capacidad de ejecutar instrucciones en el sistema; su alcance y la necesidad de aprobación dependen de los permisos y de la configuración.
  - term: entorno aislado
    definition: Configuración de ejecución en la que el programa se ejecuta separado del resto del sistema, limitando su acceso a archivos y recursos sensibles para reducir riesgos de seguridad.
fact_check:
  - label: El proyecto pasó de Moltbot a OpenClaw en enero de 2026.
    status: confirmed
  - label: La ejecución de comandos puede limitarse mediante políticas de herramientas y aprobaciones.
    status: confirmed
  - label: Activar un entorno aislado garantiza que no exista ningún riesgo.
    status: unsupported
why_it_matters:
  - Un asistente con herramientas puede modificar archivos o interactuar con servicios; una respuesta convincente no garantiza que la acción sea apropiada.
  - Revisar permisos y cuentas conectadas ayuda a ajustar el riesgo al uso previsto.
confidence: Moderada — documentación del proyecto consultada el 31 de octubre de 2026; no se auditó una instalación ni una versión concreta.
sources:
  - title: Introducing OpenClaw
    url: https://openclaw.ai/blog/introducing-openclaw
    publisher: OpenClaw
    role: primary
  - title: Sandboxing
    url: https://docs.openclaw.ai/gateway/sandboxing
    publisher: OpenClaw
    role: primary
  - title: Everything you need to know about viral personal AI assistant Clawdbot (now Moltbot)
    url: https://techcrunch.com/2026/01/27/everything-you-need-to-know-about-viral-personal-ai-assistant-clawdbot-now-moltbot/
    publisher: TechCrunch
    role: secondary
corrected_at: '2026-10-31'
correction_summary: Se actualizó el nombre del proyecto y se aclaró que los permisos, el aislamiento y las aprobaciones dependen de la configuración.
---

**Actualización, 31 de octubre de 2026.** El proyecto que esta nota llamó Moltbot adoptó el nombre OpenClaw el 29 de enero de 2026. También precisamos que la ejecución de comandos y las aprobaciones dependen de la configuración, y que el aislamiento no garantiza seguridad total.

Un asistente de IA que puede consultar archivos, ejecutar comandos o usar servicios conectados tiene más alcance que uno que solo responde preguntas. Esa capacidad permite automatizar tareas, pero también hace que una instrucción malinterpretada o un contenido malicioso pueda tener consecuencias fuera del chat.

El proyecto creado por Peter Steinberger pasó por los nombres Clawdbot y Moltbot antes de adoptar [OpenClaw](https://openclaw.ai/blog/introducing-openclaw). La nota original describía su etapa inicial; la [documentación actual](https://docs.openclaw.ai/gateway/sandboxing) explica opciones de aislamiento para la ejecución de herramientas.

## Qué cambia cuando el asistente actúa

El alcance real depende de las herramientas habilitadas, las cuentas conectadas, los permisos del sistema y las reglas de aprobación. Si puede ejecutar comandos en un equipo con acceso a documentos y credenciales, un error puede afectar esos recursos. Una instrucción recibida desde una página o mensaje no debe tratarse automáticamente como una orden autorizada.

## Qué se puede limitar

Reducir los permisos y credenciales disponibles, exigir aprobación para acciones sensibles y separar el entorno de trabajo puede limitar el impacto de una acción no deseada. La documentación del proyecto aclara que su aislamiento reduce acceso a archivos y procesos, pero no es una barrera perfecta. Sus opciones pueden cambiar entre versiones; antes de configurar una instalación conviene consultar la guía correspondiente a esa versión.

Esta nota no probó una instalación propia ni demuestra que una configuración concreta sea segura en todos los casos. La utilidad del asistente y el riesgo dependen de lo que se le permita hacer.
