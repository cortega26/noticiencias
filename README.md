# 🧪 Noticiencias - Plataforma de Periodismo Científico

[![Content Guard](https://github.com/cortega26/noticiencias/actions/workflows/content-guard.yml/badge.svg)](https://github.com/cortega26/noticiencias/actions/workflows/content-guard.yml) [![Deploy](https://github.com/cortega26/noticiencias/actions/workflows/deploy.yml/badge.svg)](https://github.com/cortega26/noticiencias/actions/workflows/deploy.yml)
![Astro](https://img.shields.io/badge/Astro-5.0-AC1452?style=flat&logo=astro&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat&logo=typescript&logoColor=white) ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=flat&logo=tailwind-css&logoColor=white)

Noticiencias es una plataforma de noticias científicas diseñada para el público latinoamericano, priorizando la evidencia sobre el sensacionalismo. Este repositorio contiene el frontend moderno construido con **Astro 5**, migrado desde un sitio legacy en Jekyll.

## 🚀 Stack Tecnológico

- **Framework**: [Astro 5.0](https://astro.build) (Content Collections, Server Islands).
- **Estilos**: [Tailwind CSS](https://tailwindcss.com) + [Tailwind Typography](https://tailwindcss.com/docs/typography-plugin).
- **Búsqueda**: Lunr.js (lado del cliente).
- **Despliegue**: GitHub Pages (Static Site Generation).
- **Integraciones**: `noticiencias_news_collector` (fuente de datos).

## ✨ Características Clave

1.  **Rendimiento Extremo**: HTML estático por defecto, 0kb JS para la mayoría de las páginas.
2.  **View Transitions**: Navegación fluida estilo SPA sin la complejidad.
3.  **Diseño "Newsroom"**: Tipografía optimizada para lectura (Inter + Lora), modo oscuro nativo, y componentes de confianza (Trust Signals).
4.  **Content Collections**: Gestión de tipos segura (TypeScript) para `posts`, `pages`, y `authors`.

## 🏗️ Arquitectura de Contenido

```mermaid
graph TD
    A[News Collector] -->|Markdown + Frontmatter| B(src/content/posts)
    B -->|Content Layer| C{Astro Build}
    D[Config.yaml] -->|Settings| C
    C -->|Static Generation| E[./dist]
    E -->|Deploy| F[GitHub Pages]

    style A fill:#f9f,stroke:#333
    style C fill:#ff9,stroke:#333
```

## 📂 Estructura del Proyecto

```text
/
├── public/             # Assets estáticos (imágenes, favicon, CNAME)
├── src/
│   ├── components/     # Componentes UI (React/Astro)
│   │   ├── common/     # Botones, MetaTags, Analytics
│   │   ├── widgets/    # Hero, Features, Header, Footer
│   │   └── blog/       # Listas de posts, Grid items
│   ├── content/        # Colecciones de contenido (Markdown/MDX)
│   │   ├── post/       # Artículos del blog
│   │   └── config.ts   # Esquemas de validación Zod
│   ├── layouts/        # Plantillas de página (PageLayout, PostLayout)
│   ├── pages/          # Rutas del sitio (File-based routing)
│   └── utils/          # Helpers (formateo de fechas, permalinks)
├── task.md             # Checklist de migración y tareas
└── astro.config.mjs    # Configuración de Astro (sitemap, tailwind, etc.)
```

## 🛠️ Instalación y Uso

### Quick Start

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo
npm run dev
# >  Local:    http://localhost:4321/

# 3. Verificar calidad de contenido
npm run validate:content
```

### Comandos Disponibles

| Comando           | Acción                                                |
| :---------------- | :---------------------------------------------------- |
| `npm install`     | Instala las dependencias del proyecto.                |
| `npm run dev`     | Inicia el servidor de desarrollo en `localhost:4321`. |
| `npm run build`   | Compila el sitio para producción en `./dist/`.        |
| `npm run preview` | Previsualiza la build de producción localmente.       |
| `npm run lint`    | Ejecuta ESLint para verificar calidad de código.      |

## 📝 Flujo de Trabajo Editorial

1.  **Contenido**: Los artículos viven en `src/content/post/`.
2.  **Frontmatter**: Usamos campos estrictos para garantizar calidad.
    ```yaml
    title: "Título Impactante pero Honesto"
    publishDate: 2025-01-15
    image: "~/assets/images/cover.jpg"
    category: "Tecnología"
    tags: ["IA", "Futuro"]
    author: "noticiencias-ai"
    trust_score: 0.95 # Nivel de evidencia
    ```
3.  **Imágenes**: Astro optimiza automáticamente las imágenes locales importadas.

## 🤝 Contribución

1.  Priorizamos cambios pequeños ("Baby Steps").
2.  No commitear archivos binarios grandes.
3.  Usar Conventional Commits (`feat:`, `fix:`, `docs:`).

> **Note: Split-Brain Component Freeze**
> To prevent technical debt, the `src/components/template/` directory is **FROZEN**.
>
> - **Do not** add new components here.
> - **Do not** refactor existing ones unless critical.
> - **All new UI** must go into `src/components/ds/` (Design System).
>
> Validated by `npm run validate:content`.

---

_Mantenido por el equipo de Noticiencias._
