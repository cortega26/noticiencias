import { getCollection } from 'astro:content';


export async function GET() {
    try {
        const posts = await getCollection('posts');

        // FAIL-CLOSED: Ensure we have content. If posts are empty, something is wrong with the build or content source.
        if (!posts || posts.length === 0) {
            throw new Error("FATAL: No posts found for search index. Aborting build to prevent corrupt search.json.");
        }

        // Transform posts into a lightweight search index
        const documents = posts.map(post => {
            // Validation: Ensure essential fields exist
            if (!post.data.title || !post.body) {
                console.warn(`Skipping invalid post: ${post.slug}`);
                return null;
            }

            // Simple permalink logic (mirroring helper)
            const url = post.data.permalink || `/posts/${post.slug}/`;

            return {
                title: post.data.title,
                url,
                description: post.data.excerpt,
                content: post.body, // Full content for better indexing (could be truncated)
                categories: post.data.categories,
                tags: post.data.tags,
                series: post.data.series,
                date: post.data.date,
                image: post.data.image
            };
        }).filter(doc => doc !== null); // Remove any invalid docs

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
