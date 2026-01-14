import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
    const posts = await getCollection('posts');
    return rss({
        title: 'Noticiencias',
        description: 'Traduce la ciencia global en español claro para 580 millones de hispanohablantes.',
        site: context.site,
        items: posts.map((post) => ({
            title: post.data.title,
            pubDate: post.data.date,
            description: post.data.excerpt,
            // Use custom permalink if available, else standard slug
            link: post.data.permalink || `/posts/${post.slug}/`,
        })),
        customData: `<language>es-es</language>`,
    });
}
