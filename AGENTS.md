# Agentes de Noticiencias

Este documento describe a alto nivel cómo usamos agentes para apoyar la curación y redacción de contenidos. **No** incluye prompts completos, cadenas de herramientas, ni credenciales.

## Objetivos

- Descubrir fuentes de ciencia/tecnología confiables
- Resumir hallazgos con trazabilidad
- Sugerir titulares y metadatos SEO sin clickbait

## Roles (alto nivel)

- **Orquestador**: decide flujo según tipo de fuente (RSS, web, paper)
- **Extractor**: limpia HTML y normaliza texto con respeto a `robots.txt`
- **Anotador**: detecta entidades/temas y genera notas con citas
- **Redactor asistido**: sugiere borradores; humana/o los edita y aprueba
- **Verificador**: comprueba enlaces, fecha de publicación y duplicados

## Señales y criterios

- Fecha y autoría verificables
- Reputación de la fuente (revistas, preprints, blogs con historial)
- Enlaces a trabajos/papers de origen

## Transparencia

- Cada pieza publicada incluye **fuentes enlazadas** y fecha de verificación.
- Errores: aceptamos correcciones vía issue o formulario de contacto.

## Limitaciones

- Los agentes **no** publican automáticamente.
- Puede haber sesgos según cobertura de fuentes y disponibilidad.

## Privacidad y cumplimiento

- No almacenamos datos personales de visitantes en prompts.
- Métricas agregadas; sin PII.

## Cómo proponer mejoras

Abre un issue con la etiqueta `agents:proposal` describiendo la idea y ejemplos de entradas/salidas esperadas.

## Philosophy & Workflow

- **Baby Steps:** Prioritize small, incremental changes over large refactors.
- **Safety First:** Avoid introducing regressions at all costs. Verify every step.
- **Verification:** Run tests after every change, no matter how small.

