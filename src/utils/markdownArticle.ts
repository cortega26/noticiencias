import type { Post } from '~/types';

/**
 * Serializes one post's public editorial metadata + body into the shared
 * Markdown block used by both llms-full.txt and the per-article
 * /llm-md/*.md artifact. Only publicly-rendered fields (see
 * TrustPanel.astro, PostLayout.astro) are included — never raw/internal
 * frontmatter.
 */
export function serializePostToMarkdown(post: Post, rawBody: string, postUrl: string): string {
  let output = `### [${post.title}](${postUrl})\n`;
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

  if (post.fact_check && post.fact_check.length > 0) {
    output += `\n#### Verificación de Datos:\n`;
    for (const item of post.fact_check) {
      output += `- **${item.label}** (${item.status})\n`;
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

  return output;
}
