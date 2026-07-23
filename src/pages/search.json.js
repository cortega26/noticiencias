import { getCollection } from 'astro:content';
import { getPermalink } from '~/utils/permalinks';
import { resolvePostPermalink } from '~/utils/blog';
import { resolveImageUrl } from '~/utils/images';
import { buildSearchArtifact, stripMarkdown } from '~/utils/build-search-index';

export async function GET() {
  try {
    const posts = await getCollection('posts');

    // FAIL-CLOSED: Ensure we have content.
    if (!posts || posts.length === 0) {
      throw new Error(
        'FATAL: No posts found for search index. Aborting build to prevent corrupt search.json.'
      );
    }

    // Transform posts into search documents with stripped Markdown content
    // (not raw post.body, which includes frontmatter artifacts and MDX syntax).
    const documents = (
      await Promise.all(
        posts.map(async (post) => {
          if (!post.data.title || !post.body) {
            console.warn(`Skipping invalid post: ${post.slug}`);
            return null;
          }

          const url = getPermalink(await resolvePostPermalink(post), 'post');

          return {
            title: post.data.title,
            url,
            description: post.data.excerpt,
            // Strip Markdown/MDX syntax to indexable text instead of
            // shipping the raw body to the browser.
            content: stripMarkdown(post.body),
            categories: post.data.categories,
            tags: post.data.tags,
            series: post.data.series,
            date: post.data.date,
            image: await resolveImageUrl(
              typeof post.data.image === 'string'
                ? post.data.image
                : (post.data.image?.src ?? null),
              { width: 400 }
            ),
          };
        })
      )
    ).filter((doc) => doc !== null);

    if (documents.length === 0) {
      throw new Error('FATAL: All posts failed validation during search index generation.');
    }

    // Build the serialized Lunr index + compact result store at build time.
    const artifact = buildSearchArtifact(documents);

    return new Response(JSON.stringify(artifact), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('❌ CRITICAL BUILD ERROR in search.json.js:', error.message);
    throw error;
  }
}
