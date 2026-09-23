import type { Post } from '~/types';

export interface TopicFrequency {
  slug: string;
  title: string;
  count: number;
}

export interface RecentSelection {
  /** true when the edition window itself had stories; false means the fallback ran. */
  inWindow: boolean;
  posts: Post[];
}

export interface FeaturedSeries {
  name: string;
  count: number;
  latestDate: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

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

/**
 * Stories published inside the edition window (default: the seven days
 * ending at the newest publish date). When the window is empty — e.g. the
 * site went a week without publishing — falls back to the newest stories
 * and reports `inWindow: false` so the caller can label them honestly
 * ("Lo más reciente", not "Esta semana").
 */
export function selectRecentPosts(
  posts: Post[],
  editionDate: Date,
  {
    days = 7,
    count = 6,
    excludeIds = [],
  }: { days?: number; count?: number; excludeIds?: string[] } = {}
): RecentSelection {
  const excluded = new Set(excludeIds);
  const cutoff = editionDate.valueOf() - days * DAY_MS;
  const editionValue = editionDate.valueOf();
  const inWindow = posts
    .filter(
      (post) =>
        !excluded.has(post.id) &&
        post.publishDate.valueOf() >= cutoff &&
        post.publishDate.valueOf() <= editionValue
    )
    .sort(byNewest)
    .slice(0, count);

  if (inWindow.length > 0) return { inWindow: true, posts: inWindow };

  return {
    inWindow: false,
    posts: posts
      .filter((post) => !excluded.has(post.id))
      .sort(byNewest)
      .slice(0, count),
  };
}

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

function compareSeries(a: FeaturedSeries, b: FeaturedSeries): number {
  if (a.count !== b.count) return b.count - a.count;
  const dateDiff = b.latestDate.valueOf() - a.latestDate.valueOf();
  if (dateDiff !== 0) return dateDiff;
  return a.name.localeCompare(b.name, 'es');
}

/** Most substantial series, tie-broken by latest update and name. */
export function selectFeaturedSeries(posts: Post[]): FeaturedSeries | null {
  const series = new Map<string, FeaturedSeries>();

  for (const post of posts) {
    if (!post.series) continue;
    const existing = series.get(post.series);
    series.set(post.series, {
      name: post.series,
      count: (existing?.count ?? 0) + 1,
      latestDate:
        existing && existing.latestDate.valueOf() > post.publishDate.valueOf()
          ? existing.latestDate
          : post.publishDate,
    });
  }

  return [...series.values()].sort(compareSeries)[0] ?? null;
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
