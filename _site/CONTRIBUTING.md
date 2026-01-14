# Guía de Contribución

¡Gracias por tu interés en contribuir a **Noticiencias**! Este repo es el **sitio público**. Para ideas de producto, agentes o datos privados, consulta primero los issues o abre una discusión.

## Formas de contribuir

- Reportar bugs (issues bien descritos)
- Mejoras de contenido (ortografía, enlaces rotos, accesibilidad)
- Mejoras de frontend/CSS
- Traducciones y correcciones menores

## Código de conducta

Este proyecto adopta el [Contributor Covenant](https://www.contributor-covenant.org/). Al participar, aceptas sus términos.

## Licencia

- **Código:** MIT (o Apache-2.0)
- **Contenido editorial (posts, páginas):** CC BY-NC-ND 4.0 (o "All rights reserved")

> Nota: contribuciones se entenderán bajo las licencias anteriores. Si un PR incluye contenido no original, decláralo y verifica permisos.

## Entorno de desarrollo (Jekyll)

1. Instala Ruby (>= 3.1) y Bundler: `gem install bundler`
2. Instala dependencias: `bundle install`
3. Levanta el sitio: `bundle exec jekyll serve --livereload`
4. Abre en `http://localhost:4000`

> GitHub Pages compila con el conjunto de gems soportadas; evita plugins no compatibles.

## Estilo y PRs

- Sigue el estilo existente; para CSS/HTML procura accesibilidad (semántica, alt text, contraste).
- Ejecuta `bundle exec jekyll build` antes de abrir PR.
- Si modificas posts, corre `python tools/validate_frontmatter.py`.
- Un PR por cambio lógico; describe el **porqué** y adjunta capturas si es UI.
- CI debe pasar (enlace/checks automáticos del repo).

## Ramas

Usamos GitHub Flow:

- Crea rama desde `main`: `feat/...`, `fix/...`, `docs/...`
- Abre PR -> revisión -> squash merge
