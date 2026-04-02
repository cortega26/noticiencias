import { getCollection } from 'astro:content';
import { getPermalink } from '~/utils/permalinks';
import { resolvePostPermalink } from '~/utils/blog';
import { resolveImageUrl } from '~/utils/images';


export async function GET() {
    try {
        const posts = await getCollection('posts');

        // FAIL-CLOSED: Ensure we have content. If posts are empty, something is wrong with the build or content source.
        if (!posts || posts.length === 0) {
            throw new Error("FATAL: No posts found for search index. Aborting build to prevent corrupt search.json.");
        }

        // Transform posts into a lightweight search index
        const documents = (await Promise.all(posts.map(async post => {
            // Validation: Ensure essential fields exist
            if (!post.data.title || !post.body) {
                console.warn(`Skipping invalid post: ${post.slug}`);
                return null;
            }

            const url = getPermalink(await resolvePostPermalink(post), 'post');

            return {
                title: post.data.title,
                url,
                description: post.data.excerpt,
                content: post.body, // Full content for better indexing (could be truncated)
                categories: post.data.categories,
                tags: post.data.tags,
                series: post.data.series,
                date: post.data.date,
                image: await resolveImageUrl(
                    typeof post.data.image === 'string' ? post.data.image : (post.data.image?.src ?? null),
                    { width: 400 }
                )
            };
        }))).filter(doc => doc !== null); // Remove any invalid docs

        if (documents.length === 0) {
             throw new Error("FATAL: All posts failed validation during search index generation.");
        }

        return new Response(JSON.stringify(documents), {
            headers: {
                'Content-Type': 'application/json'
            }
        });

    } catch (error) {
        console.error("❌ CRITICAL BUILD ERROR in search.json.js:", error.message);
        // Rethrow to fail the build process
        throw error;
    }
}
