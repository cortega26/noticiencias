import type { Post, Taxonomy } from '~/types';

export interface TopicFrequency {
  slug: string;
  title: string;
  count: number;
}

export interface CategoryRail {
  category: Taxonomy;
  posts: Post[];
  topics: TopicFrequency[];
}

const byNewest = (a: Post, b: Post) => b.publishDate.valueOf() - a.publishDate.valueOf();

export function selectFeaturedPosts(posts: Post[], count = 3): Post[] {
  const featured = posts
    .filter((post) => post.featured === true && typeof post.featured_rank === 'number')
    .sort((a, b) => {
      const rankDiff = (a.featured_rank ?? Number.MAX_SAFE_INTEGER) - (b.featured_rank ?? 0);
      return rankDiff || byNewest(a, b);
    });

  const selected = featured.length > 0 ? featured : [...posts].sort(byNewest);
  return selected.slice(0, count);
}

export function selectContextPosts(posts: Post[], count = 3): Post[] {
  return posts
    .filter(
      (post) => (post.why_it_matters?.length ?? 0) > 0 || (post.summary_points?.length ?? 0) > 0
    )
    .sort(byNewest)
    .slice(0, count);
}

export function getTopicFrequency(posts: Post[], count = 12): TopicFrequency[] {
  const topics = new Map<string, TopicFrequency>();

  for (const post of posts) {
    for (const tag of post.tags ?? []) {
      const existing = topics.get(tag.slug);
      topics.set(tag.slug, {
        slug: tag.slug,
        title: tag.title,
        count: (existing?.count ?? 0) + 1,
      });
    }
  }

  return [...topics.values()]
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, 'es'))
    .slice(0, count);
}

export function getRelatedTopics(
  posts: Post[],
  activeTagSlug: string,
  count = 8
): TopicFrequency[] {
  const scopedPosts = posts.filter((post) => post.tags?.some((tag) => tag.slug === activeTagSlug));
  return getTopicFrequency(scopedPosts, count + 1)
    .filter((topic) => topic.slug !== activeTagSlug)
    .slice(0, count);
}

export function buildCategoryRails(
  posts: Post[],
  categories: Taxonomy[],
  perCategory = 3
): CategoryRail[] {
  return categories
    .map((category) => {
      const categoryPosts = posts
        .filter((post) => post.category?.slug === category.slug)
        .sort(byNewest)
        .slice(0, perCategory);

      return {
        category,
        posts: categoryPosts,
        topics: getTopicFrequency(categoryPosts, 5),
      };
    })
    .filter((rail) => rail.posts.length > 0);
}
