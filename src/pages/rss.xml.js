import rss from '@astrojs/rss';
import { fetchPosts } from '~/utils/blog';
import { getPermalink } from '~/utils/permalinks';

export async function GET(context) {
  const posts = await fetchPosts();
  return rss({
    title: 'Noticiencias',
    description:
      'Traduce ciencia, tecnología e internet de interés público a un español claro para 580 millones de hispanohablantes.',
    site: context.site,
    items: posts.map((post) => ({
      title: post.title,
      pubDate: post.publishDate,
      description: post.excerpt,
      link: getPermalink(post.permalink, 'post'),
      author: 'equipo@noticiencias.com (Equipo Noticiencias)',
    })),
    customData: `<language>es-es</language><copyright>Copyright ${new Date().getFullYear()} Noticiencias</copyright>`,
  });
}
