import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { fetchPosts } from '~/utils/blog';
import { getPermalink, getCanonical } from '~/utils/permalinks';
import { serializePostToMarkdown } from '~/utils/markdownArticle';
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
    output += `### [Detector de hype: leer ciencia sin que te vendan humo](${hypeUrl})\n\n`;
    output += `${hypeContent}\n\n`;
    output += `---\n\n`;
  }

  output += `## Artículos Publicados\n\n`;

  for (const post of posts) {
    const postUrl = String(getCanonical(getPermalink(post.permalink, 'post')));
    const rawBody = postBodyMap.get(post.id) || '';

    output += serializePostToMarkdown(post, rawBody, postUrl);
    output += `---\n\n`;
  }

  return new Response(output, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
