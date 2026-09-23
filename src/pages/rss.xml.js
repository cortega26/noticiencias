import { fetchPosts } from '~/utils/blog';
import { buildFeed } from '~/utils/rss';

export async function GET(context) {
  const posts = await fetchPosts();
  return buildFeed(context, {
    title: 'Noticiencias',
    description:
      'Traduce ciencia, tecnología e internet de interés público a un español claro para 580 millones de hispanohablantes.',
    posts,
  });
}
