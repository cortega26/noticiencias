import type { Post } from '~/types';

export interface TopicFrequency {
  slug: string;
  title: string;
  count: number;
}

const byNewest = (a: Post, b: Post) => b.publishDate.valueOf() - a.publishDate.valueOf();

export function getEditionDate(posts: Post[]): Date {
  if (posts.length === 0) return new Date();
  return posts.reduce(
    (latest, post) => (post.publishDate.valueOf() > latest.valueOf() ? post.publishDate : latest),
    posts[0].publishDate
  );
}

export function selectFeaturedPosts(posts: Post[], count = 3): Post[] {
  const featured = posts
    .filter((post) => post.featured === true && typeof post.featured_rank === 'number')
    .sort((a, b) => {
      const rankDiff =
        (a.featured_rank ?? Number.MAX_SAFE_INTEGER) - (b.featured_rank ?? Number.MAX_SAFE_INTEGER);
      if (rankDiff !== 0) return rankDiff;
      if (a.investigation !== b.investigation) {
        return a.investigation ? -1 : 1;
      }
      return byNewest(a, b);
    });

  const selected =
    featured.length > 0
      ? featured
      : [...posts].sort((a, b) => {
          if (a.investigation !== b.investigation) {
            return a.investigation ? -1 : 1;
          }
          return byNewest(a, b);
        });
  return selected.slice(0, count);
}

/** Stories shown in the home "De esta edición" block: always six when the archive has them. */
export const EDITION_POST_COUNT = 6;

/** Newest stories not already promoted on the page (home archive block). */
export function selectArchivePosts(
  posts: Post[],
  { count = 3, excludeIds = [] }: { count?: number; excludeIds?: string[] } = {}
): Post[] {
  const excluded = new Set(excludeIds);
  return posts
    .filter((post) => !excluded.has(post.id))
    .sort(byNewest)
    .slice(0, count);
}

/**
 * The "De esta edición" block: the newest stories that are not already in the
 * lead. It deliberately has no date window — a window made the block shrink
 * (or switch label) whenever fewer stories than slots were published that
 * week. Fewer than `count` only happens when the whole archive has fewer.
 */
export function selectEditionPosts(
  posts: Post[],
  { count = EDITION_POST_COUNT, excludeIds = [] }: { count?: number; excludeIds?: string[] } = {}
): Post[] {
  return selectArchivePosts(posts, { count, excludeIds });
}

export function getTopicFrequency(posts: Post[], count = 6): TopicFrequency[] {
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
    .filter(({ count: n }) => n >= 2)
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, 'es'))
    .slice(0, count);
}

/**
 * Recurring topics for the home topic strip. Tags vary a lot between recent
 * articles, so a fixed 18-post window can contain no tag that repeats and the
 * strip would vanish whenever a new article pushes one out. Widen the window
 * until enough topics recur; a topic still needs at least two articles.
 */
export function getRecurringTopics(
  posts: Post[],
  {
    windows = [18, 60],
    count = 6,
    minTopics = 3,
  }: { windows?: number[]; count?: number; minTopics?: number } = {}
): TopicFrequency[] {
  let topics: TopicFrequency[] = [];
  for (const size of windows) {
    topics = getTopicFrequency(posts.slice(0, size), count);
    if (topics.length >= minTopics) break;
  }
  return topics;
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
