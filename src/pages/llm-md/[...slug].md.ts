import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { fetchPosts } from '~/utils/blog';
import { getPermalink, getCanonical } from '~/utils/permalinks';
import { serializePostToMarkdown } from '~/utils/markdownArticle';
import type { Post } from '~/types';

/**
 * Backing artifact namespace for the Markdown-for-agents negotiation
 * Worker (see docs/adr/0008-markdown-for-agents.md). Not linked from the
 * site, excluded from the sitemap (astro.config.mjs) and disallowed in
 * robots.txt — this is not a second canonical URL for the article.
 *
 * Named without a leading underscore: Astro treats `_`-prefixed
 * paths/files under src/pages/ as private and never routes them, which
 * would silently produce zero artifacts (confirmed by an empty build
 * output under the original `_markdown` name).
 *
 * Scoped to schema_version >= 2 posts only, matching the editorial
 * enrichment contract enforced in content.config.ts.
 */
export const getStaticPaths: GetStaticPaths = async () => {
  const [posts, rawPosts] = await Promise.all([fetchPosts(), getCollection('posts')]);
  const eligibleIds = new Set(
    rawPosts.filter((p) => (p.data.schema_version ?? 1) >= 2).map((p) => p.id)
  );
  const bodyById = new Map(rawPosts.map((p) => [p.id, p.body ?? '']));

  return posts
    .filter((post) => eligibleIds.has(post.id))
    .map((post) => ({
      params: { slug: post.permalink?.replace(/^\/|\/$/g, '') },
      props: { post, rawBody: bodyById.get(post.id) ?? '' },
    }));
};

interface Props {
  post: Post;
  rawBody: string;
}

export const GET: APIRoute<Props> = async ({ props }) => {
  const { post, rawBody } = props;
  const postUrl = String(getCanonical(getPermalink(post.permalink, 'post')));

  const output = serializePostToMarkdown(post, rawBody, postUrl);

  return new Response(output, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  });
};
