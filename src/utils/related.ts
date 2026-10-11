import type { Post } from '~/types';

export interface RelatedSelection {
  kind: 'related' | 'recent';
  posts: Post[];
}

// P2-01: structured semantic signals only. Recency alone never qualifies a
// candidate, so the newest posts cannot dominate the ranking; when nothing
// reaches the threshold the caller receives an explicit `recent` fallback
// to label honestly instead of claiming a relation.
const MIN_RELATED_SCORE = 2;

function sharesCategory(original: Post, candidate: Post): boolean {
  return Boolean(original.category?.slug && original.category.slug === candidate.category?.slug);
}

function sharesSeries(original: Post, candidate: Post): boolean {
  return Boolean(original.series && original.series === candidate.series);
}

function sharedTagCountWithSets(originalTags: Set<string>, candidate: Post): number {
  let count = 0;
  for (const tag of candidate.tags ?? []) {
    if (originalTags.has(tag.slug)) count += 1;
  }
  return count;
}

function sharesEvidenceType(original: Post, candidate: Post): boolean {
  return Boolean(
    original.evidence_subject_type &&
    original.evidence_subject_type !== 'unknown' &&
    original.evidence_subject_type === candidate.evidence_subject_type
  );
}

function sharesPublicationStatus(original: Post, candidate: Post): boolean {
  return Boolean(
    original.publication_status &&
    original.publication_status !== 'other' &&
    original.publication_status === candidate.publication_status
  );
}

function relatedScoreWithSets(original: Post, originalTags: Set<string>, candidate: Post): number {
  return (
    (sharesCategory(original, candidate) ? 4 : 0) +
    (sharesSeries(original, candidate) ? 3 : 0) +
    sharedTagCountWithSets(originalTags, candidate) * 2 +
    (sharesEvidenceType(original, candidate) ? 1 : 0) +
    (sharesPublicationStatus(original, candidate) ? 1 : 0)
  );
}

/**
 * Tag slugs per post id, built once per post list. `fetchPosts()` memoizes
 * per build so the same array identity recurs across pages; the WeakMap
 * reuses the sets instead of rebuilding the original-post Set per candidate
 * (previous cost ≈ N²·T Set builds for N article pages).
 */
const tagSetCache = new WeakMap<Post[], Map<string, Set<string>>>();

export function buildTagSetMap(allPosts: Post[]): Map<string, Set<string>> {
  const cached = tagSetCache.get(allPosts);
  if (cached) return cached;
  const map = new Map<string, Set<string>>();
  for (const post of allPosts) {
    map.set(post.id, new Set((post.tags ?? []).map((tag) => tag.slug)));
  }
  tagSetCache.set(allPosts, map);
  return map;
}

/** Ranked selections per post id for one post list (memoized per array identity). */
const rankCache = new WeakMap<Post[], Map<string, RelatedSelection>>();

function rankUncached(
  originalPost: Post,
  allPosts: Post[],
  tagSets: Map<string, Set<string>>,
  maxResults: number
): RelatedSelection {
  const originalTags =
    tagSets.get(originalPost.id) ?? new Set((originalPost.tags ?? []).map((tag) => tag.slug));
  const related = allPosts
    .filter((post) => post.id !== originalPost.id)
    .map((post) => ({ post, score: relatedScoreWithSets(originalPost, originalTags, post) }))
    .filter(({ score }) => score >= MIN_RELATED_SCORE)
    .sort(
      (a, b) => b.score - a.score || b.post.publishDate.valueOf() - a.post.publishDate.valueOf()
    )
    .slice(0, maxResults)
    .map(({ post }) => post);

  if (related.length > 0) return { kind: 'related', posts: related };

  const recent = [...allPosts]
    .filter((post) => post.id !== originalPost.id)
    .sort((a, b) => b.publishDate.valueOf() - a.publishDate.valueOf())
    .slice(0, maxResults);

  return { kind: 'recent', posts: recent };
}

/**
 * Rank related stories for every post in a single pass over the list,
 * sharing one tag-set map. Used by getStaticPaths to attach each page's
 * selection as a prop (one fetchPosts() call for the whole build).
 */
export function rankAllRelatedPosts(
  allPosts: Post[],
  maxResults = 4
): Map<string, RelatedSelection> {
  const tagSets = buildTagSetMap(allPosts);
  let perList = rankCache.get(allPosts);
  if (!perList) {
    perList = new Map<string, RelatedSelection>();
    rankCache.set(allPosts, perList);
  }
  for (const post of allPosts) {
    const key = `${post.id}::${maxResults}`;
    if (!perList.has(key)) {
      perList.set(key, rankUncached(post, allPosts, tagSets, maxResults));
    }
  }
  const result = new Map<string, RelatedSelection>();
  for (const post of allPosts) {
    const selection = perList.get(`${post.id}::${maxResults}`);
    if (selection) result.set(post.id, selection);
  }
  return result;
}

/** Rank related stories for an article; falls back to recent only when nothing qualifies. */
export function rankRelatedPosts(
  originalPost: Post,
  allPosts: Post[],
  maxResults = 4
): RelatedSelection {
  const key = `${originalPost.id}::${maxResults}`;
  let perList = rankCache.get(allPosts);
  if (perList?.has(key)) return perList.get(key) as RelatedSelection;
  if (!perList) {
    perList = new Map<string, RelatedSelection>();
    rankCache.set(allPosts, perList);
  }
  const selection = rankUncached(originalPost, allPosts, buildTagSetMap(allPosts), maxResults);
  perList.set(key, selection);
  return selection;
}
