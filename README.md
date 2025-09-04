# Noticiencias

"Traduce la ciencia global en español claro para 580 millones de hispanohablantes."

## Tabla de contenidos
- [Características](#características)
- [Arquitectura](#arquitectura)
- [Inicio rápido](#inicio-rápido)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Ejemplos de uso](#ejemplos-de-uso)
- [FAQ](#faq)
- [Roadmap](#roadmap)
- [Contribución](#contribución)
- [Licencia](#licencia)
- [Enlaces](#enlaces)

## Características
- Traducción y explicación sistemática de artículos revisados por pares sin sensacionalismo.
- Flujo editorial en cuatro pasos: verificación, borrador de traducción, revisión científica y pulido editorial.
- Criterios de curación: novedad, autoridad, relevancia y accesibilidad B1-B2.
- Uso limitado de IA para borradores de traducción, SEO y apoyo en redes sociales.

## Arquitectura
- Sitio estático con [Jekyll](https://jekyllrb.com/) desplegado en GitHub Pages.
- CDN y protección mediante Cloudflare.
- Herramientas esenciales: Google Analytics 4, Mailchimp y DeepL.
- TODO: diagrama de arquitectura.

## Inicio rápido
```bash
# Clonar y entrar
git clone https://github.com/<OWNER>/noticiencias.git
cd noticiencias

# Instalar dependencias y arrancar servidor local
bundle install
bundle exec jekyll serve
```
Visita <http://localhost:4000>.

## Instalación
Requiere Ruby y Bundler.
1. `bundle install`
2. `bundle exec jekyll build`

## Configuración
| Variable               | Descripción                           | Valor por defecto |
|------------------------|---------------------------------------|-------------------|
| `GA4_ID`               | Identificador de Google Analytics 4   | TODO              |
| `MAILCHIMP_API_KEY`    | Clave para envíos de newsletter       | TODO              |
| `DEEPL_API_KEY`        | Traducciones asistidas                | TODO              |
| `CLOUDFLARE_TOKEN`     | Despliegue y caché CDN                | TODO              |

Edita `_config.yml` para opciones del sitio.

## Ejemplos de uso
Crear un nuevo artículo:
```markdown
---
layout: single
title: "Título optimizado SEO"
categories: [ciencia]
---

Resumen (50 palabras)

Contexto (100 palabras)

Resultados (200 palabras)

Implicaciones (100 palabras)

Limitaciones (50 palabras)

Fuentes: [Journal] DOI: enlace
```

## FAQ
**¿Por qué Noticiencias?**
Responde a la falta de traducción rigurosa y rápida de investigación científica.

**¿Cómo se garantiza la precisión?**
Cada artículo verifica cifras y metodología contra la fuente original y añade limitaciones.

## Roadmap
- Meses 1‑6: donaciones financian infraestructura básica.
- Meses 7‑18: anuncios y newsletter premium permiten crecer.
- Meses 19+: servicios y alianzas escalan el proyecto.
- Consulta `roadmap.csv` para tareas detalladas.

## Contribución
- Usa Markdown.
- Ejecuta `bundle exec jekyll build` antes de enviar cambios.
- Escribe mensajes de commit en presente.
- TODO: guía de revisión y estilo completa.

## Licencia
Proyecto disponible bajo la licencia MIT.

## Enlaces
- Sitio: <https://noticiencias.com>
- Plan de negocio: `planes_iniciales/noticiencias_business_plan.md`
- Roadmap: `roadmap.csv`
