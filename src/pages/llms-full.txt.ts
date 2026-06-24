import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { fetchPosts } from '~/utils/blog';
import { getPermalink, getCanonical } from '~/utils/permalinks';
import * as fs from 'node:fs';
import * as path from 'node:path';

function stripFrontmatter(content: string): string {
  const parts = content.split('---');
  if (parts.length >= 3) {
    return parts.slice(2).join('---').trim();
  }
  return content.trim();
}

const readStaticPage = (filename: string): string => {
  try {
    const fullPath = path.join(process.cwd(), 'src', 'pages', filename);
    if (fs.existsSync(fullPath)) {
      const fileContent = fs.readFileSync(fullPath, 'utf-8');
      return stripFrontmatter(fileContent);
    }
  } catch (error) {
    console.error(`Error reading static page ${filename}:`, error);
  }
  return '';
};

export const GET: APIRoute = async () => {
  const posts = await fetchPosts();
  const rawPosts = await getCollection('posts');
  const postBodyMap = new Map(rawPosts.map((p) => [p.id, p.body]));

  const nosotrosContent = readStaticPage('nosotros.md');
  const metodologiaContent = readStaticPage('metodologia.md');
  const transparenciaContent = readStaticPage('transparencia.md');
  const hypeContent = readStaticPage('recursos/detector-de-hype.md');

  const nosotrosUrl = String(getCanonical(getPermalink('/nosotros/')));
  const metodologiaUrl = String(getCanonical(getPermalink('/metodologia/')));
  const transparenciaUrl = String(getCanonical(getPermalink('/transparencia/')));
  const hypeUrl = String(getCanonical(getPermalink('/recursos/detector-de-hype/')));

  let output = `# Noticiencias (Contenido Completo)\n`;
  output += `> Traducimos ciencia, tecnología e internet de interés público a un español claro, responsable y verificable para 580 millones de hispanohablantes.\n\n`;

  output += `Este archivo contiene la compilación completa de la información institucional de Noticiencias, sus recursos y todos sus artículos publicados en formato Markdown, estructurado para un óptimo procesamiento por modelos de lenguaje (LLMs).\n\n`;

  output += `## Páginas Institucionales y Guías\n\n`;

  if (nosotrosContent) {
    output += `### [Nosotros](${nosotrosUrl})\n\n`;
    output += `${nosotrosContent}\n\n`;
    output += `---\n\n`;
  }

  if (metodologiaContent) {
    output += `### [Metodología](${metodologiaUrl})\n\n`;
    output += `${metodologiaContent}\n\n`;
    output += `---\n\n`;
  }

  if (transparenciaContent) {
    output += `### [Transparencia](${transparenciaUrl})\n\n`;
    output += `${transparenciaContent}\n\n`;
    output += `---\n\n`;
  }

  if (hypeContent) {
    output += `### [Detector de Hype: Guía de Sobrevivencia](${hypeUrl})\n\n`;
    output += `${hypeContent}\n\n`;
    output += `---\n\n`;
  }

  output += `## Artículos Publicados\n\n`;

  for (const post of posts) {
    const postUrl = String(getCanonical(getPermalink(post.permalink, 'post')));
    const rawBody = postBodyMap.get(post.id) || '';

    output += `### [${post.title}](${postUrl})\n`;
    output += `- **Fecha:** ${post.publishDate ? post.publishDate.toISOString().split('T')[0] : 'N/A'}\n`;
    output += `- **Autor:** ${post.author || 'Noticiencias'}\n`;

    if (post.category?.title) {
      output += `- **Categorías:** ${post.category.title}\n`;
    }
    if (post.tags && post.tags.length > 0) {
      output += `- **Etiquetas:** ${post.tags.map((t) => t.title).join(', ')}\n`;
    }
    if (post.excerpt) {
      output += `- **Extracto:** ${post.excerpt}\n`;
    }
    if (post.confidence) {
      output += `- **Grado de Certidumbre:** ${post.confidence}\n`;
    }
    if (post.translation_method) {
      output += `- **Método de Traducción:** ${post.translation_method}\n`;
    }
    output += `- **Investigación Original:** ${post.investigation ? 'Sí' : 'No'}\n`;
    if (post.source_url) {
      output += `- **URL de Origen:** ${post.source_url}\n`;
    }

    if (post.summary_points && post.summary_points.length > 0) {
      output += `\n#### Resumen de Puntos Clave:\n`;
      for (const pt of post.summary_points) {
        output += `- ${pt}\n`;
      }
    }

    if (post.why_it_matters && post.why_it_matters.length > 0) {
      output += `\n#### Relevancia del hallazgo:\n`;
      for (const item of post.why_it_matters) {
        output += `- ${item}\n`;
      }
    }

    if (post.sources && post.sources.length > 0) {
      output += `\n#### Fuentes Científicas de Origen:\n`;
      for (const src of post.sources) {
        const pubStr = src.publisher ? ` (${src.publisher})` : '';
        const dateStr = src.date ? `, ${src.date}` : '';
        output += `- [${src.title}](${src.url})${pubStr}${dateStr}\n`;
      }
    }

    if (post.glossary && post.glossary.length > 0) {
      output += `\n#### Glosario Científico:\n`;
      for (const gloss of post.glossary) {
        output += `- **${gloss.term}**: ${gloss.definition}\n`;
      }
    }

    if (post.uncertainty_note) {
      output += `\n#### Nota de Incertidumbre:\n`;
      output += `${post.uncertainty_note}\n`;
    }

    output += `\n#### Contenido:\n\n`;
    output += `${rawBody.trim()}\n\n`;
    output += `---\n\n`;
  }

  return new Response(output, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
