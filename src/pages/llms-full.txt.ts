import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { fetchPosts } from '~/utils/blog';
import { getPermalink, getCanonical } from '~/utils/permalinks';
import { serializePostToMarkdown } from '~/utils/markdownArticle';
import { stripMarkdown } from '~/utils/build-search-index';
import * as fs from 'node:fs';
import * as path from 'node:path';

const readStaticPage = (filename: string): string => {
  try {
    const fullPath = path.join(process.cwd(), 'src', 'pages', filename);
    if (fs.existsSync(fullPath)) {
      const fileContent = fs.readFileSync(fullPath, 'utf-8');
      return stripMarkdown(fileContent);
    }
  } catch (error) {
    console.error(`Error reading static page ${filename}:`, error);
  }
  return '';
};

export const GET: APIRoute = async () => {
  const posts = await fetchPosts();
  // Raw markdown bodies are not carried on Post (src/types.d.ts: no body
  // field; getNormalizedPost keeps only the compiled Content component),
  // so this single getCollection pass remains the only body source.
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

  const parts: string[] = [];
  parts.push(`# Noticiencias (Contenido Completo)\n`);
  parts.push(
    `> Traducimos ciencia, tecnología e internet de interés público a un español claro, responsable y verificable para 580 millones de hispanohablantes.\n\n`
  );

  parts.push(
    `Este archivo contiene la compilación completa de la información institucional de Noticiencias, sus recursos y todos sus artículos publicados en formato Markdown, estructurado para un óptimo procesamiento por modelos de lenguaje (LLMs).\n\n`
  );

  parts.push(`## Páginas Institucionales y Guías\n\n`);

  if (nosotrosContent) {
    parts.push(`### [Nosotros](${nosotrosUrl})\n\n`);
    parts.push(`${nosotrosContent}\n\n`);
    parts.push(`---\n\n`);
  }

  if (metodologiaContent) {
    parts.push(`### [Metodología](${metodologiaUrl})\n\n`);
    parts.push(`${metodologiaContent}\n\n`);
    parts.push(`---\n\n`);
  }

  if (transparenciaContent) {
    parts.push(`### [Transparencia](${transparenciaUrl})\n\n`);
    parts.push(`${transparenciaContent}\n\n`);
    parts.push(`---\n\n`);
  }

  if (hypeContent) {
    parts.push(`### [Detector de hype: leer ciencia sin que te vendan humo](${hypeUrl})\n\n`);
    parts.push(`${hypeContent}\n\n`);
    parts.push(`---\n\n`);
  }

  parts.push(`## Artículos Publicados\n\n`);

  for (const post of posts) {
    const postUrl = String(getCanonical(getPermalink(post.permalink, 'post')));
    const rawBody = postBodyMap.get(post.id) || '';

    parts.push(serializePostToMarkdown(post, rawBody, postUrl));
    parts.push(`---\n\n`);
  }

  return new Response(parts.join(''), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
