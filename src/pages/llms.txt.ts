import type { APIRoute } from 'astro';
import { fetchPosts } from '~/utils/blog';
import { getPermalink, getCanonical } from '~/utils/permalinks';

export const GET: APIRoute = async () => {
  const posts = await fetchPosts();

  const nosotrosUrl = String(getCanonical(getPermalink('/nosotros/')));
  const metodologiaUrl = String(getCanonical(getPermalink('/metodologia/')));
  const transparenciaUrl = String(getCanonical(getPermalink('/transparencia/')));
  const newsletterUrl = String(getCanonical(getPermalink('/newsletter/')));
  const rssUrl = String(getCanonical(getPermalink('/rss.xml')));
  const llmsFullUrl = String(getCanonical(getPermalink('/llms-full.txt')));
  const hypeUrl = String(getCanonical(getPermalink('/recursos/detector-de-hype/')));

  const sections = [
    { name: 'Ciencia', slug: 'ciencia' },
    { name: 'Astronomía', slug: 'astronomia' },
    { name: 'Salud', slug: 'salud' },
    { name: 'Tecnología', slug: 'tecnologia' },
    { name: 'Editorial', slug: 'editorial' },
    { name: 'Física', slug: 'fisica' },
    { name: 'Química', slug: 'quimica' },
    { name: 'Biología', slug: 'biologia' },
    { name: 'Arqueología', slug: 'arqueologia' },
  ];

  let output = `# Noticiencias\n`;
  output += `> Traducimos ciencia, tecnología e internet de interés público a un español claro, responsable y verificable para 580 millones de hispanohablantes.\n\n`;

  output += `Noticiencias combina selección automatizada de fuentes primarias (como estudios de Nature, Science, arXiv) con curación y edición humana para ofrecer contenido libre de clickbait y sensacionalismo. Todos los artículos incluyen grado de certidumbre, notas de incertidumbre explícitas, método de traducción y un enlace DOI directo a la fuente científica original.\n\n`;

  output += `Para el corpus completo de artículos y páginas institucionales estructurado para modelos de lenguaje, consulte [llms-full.txt](${llmsFullUrl}).\n\n`;

  output += `## Información General y Metodología\n`;
  output += `- [Nosotros](${nosotrosUrl}): Misión editorial, equipo y compromisos de la organización.\n`;
  output += `- [Metodología](${metodologiaUrl}): Proceso de automatización híbrido y curación humana.\n`;
  output += `- [Transparencia](${transparenciaUrl}): Compromisos sobre conflictos de interés, correcciones y privacidad.\n`;
  output += `- [Boletín](${newsletterUrl}): Suscripción al boletín de noticias de Noticiencias.\n`;
  output += `- [Canal RSS](${rssUrl}): Feed RSS oficial de la publicación.\n`;
  output += `- [Código Fuente](https://github.com/cortega26/noticiencias): Nuestro repositorio de código abierto en GitHub.\n\n`;

  output += `## Guías y Recursos\n`;
  output += `- [Detector de Hype](${hypeUrl}): Guía de sobrevivencia y herramientas lógicas para identificar noticias científicas infladas o sensacionalistas.\n\n`;

  output += `## Secciones Temáticas\n`;
  for (const section of sections) {
    const sectionUrl = String(getCanonical(getPermalink(section.slug, 'category')));
    output += `- [${section.name}](${sectionUrl}): Artículos y noticias de ${section.name.toLowerCase()}.\n`;
  }
  output += `\n`;

  output += `## Artículos Recientes\n`;
  // Limit to most recent 10 articles for a clean index
  const recentPosts = posts.slice(0, 10);
  for (const post of recentPosts) {
    const postUrl = String(getCanonical(getPermalink(post.permalink, 'post')));
    const dateStr = post.publishDate ? new Date(post.publishDate).toISOString().split('T')[0] : '';
    const categoryName = post.category?.title || '';
    const catStr = categoryName ? ` [${categoryName}]` : '';
    output += `- [${post.title}](${postUrl}) (${dateStr})${catStr}: ${post.excerpt || ''}\n`;
  }

  return new Response(output, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
