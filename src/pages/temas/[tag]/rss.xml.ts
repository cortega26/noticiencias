import type { APIRoute, GetStaticPaths } from 'astro';

import { fetchPosts } from '~/utils/blog';
import { buildFeed } from '~/utils/rss';

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await fetchPosts();
  const tags = new Map<string, string>();

  for (const post of posts) {
    for (const tag of post.tags ?? []) {
      tags.set(tag.slug, tag.title);
    }
  }

  return [...tags.keys()].map((slug) => ({ params: { tag: slug } }));
};

export const GET: APIRoute = async (context) => {
  const tagSlug = context.params.tag ?? '';
  const posts = await fetchPosts();
  const tagged = posts.filter((post) => post.tags?.some((tag) => tag.slug === tagSlug));
  const tagTitle = tagged[0]?.tags?.find((tag) => tag.slug === tagSlug)?.title ?? tagSlug;

  return buildFeed(context, {
    title: `Noticiencias — ${tagTitle}`,
    description: `Historias de Noticiencias sobre ${tagTitle}.`,
    posts: tagged,
  });
};
