import { getCollection } from 'astro:content';

export async function GET() {
    const posts = await getCollection('posts');

    // Transform posts into a lightweight search index
    const documents = posts.map(post => {
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
    });

    return new Response(JSON.stringify(documents), {
        headers: {
            'Content-Type': 'application/json'
        }
    });
}
