import rss from '@astrojs/rss';
import { SITE } from 'astrowind:config';

import { getPermalink } from './permalinks';
import type { Post } from '~/types';

interface FeedOptions {
  title: string;
  description: string;
  posts: Post[];
}

/** Shared RSS builder for the site feed and the per-topic feeds (P2-05). */
export function buildFeed(context: { site?: URL }, { title, description, posts }: FeedOptions) {
  return rss({
    title,
    description,
    site: context.site ?? SITE.site,
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
