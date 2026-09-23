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

function relatedScore(original: Post, candidate: Post): number {
  let score = 0;

  if (original.category?.slug && original.category.slug === candidate.category?.slug) {
    score += 4;
  }
  if (original.series && original.series === candidate.series) {
    score += 3;
  }

  const originalTags = new Set((original.tags ?? []).map((tag) => tag.slug));
  for (const tag of candidate.tags ?? []) {
    if (originalTags.has(tag.slug)) score += 2;
  }

  if (
    original.evidence_subject_type &&
    original.evidence_subject_type !== 'unknown' &&
    original.evidence_subject_type === candidate.evidence_subject_type
  ) {
    score += 1;
  }

  if (
    original.publication_status &&
    original.publication_status !== 'other' &&
    original.publication_status === candidate.publication_status
  ) {
    score += 1;
  }

  return score;
}

/** Rank related stories for an article; falls back to recent only when nothing qualifies. */
export function rankRelatedPosts(
  originalPost: Post,
  allPosts: Post[],
  maxResults = 4
): RelatedSelection {
  const related = allPosts
    .filter((post) => post.id !== originalPost.id)
    .map((post) => ({ post, score: relatedScore(originalPost, post) }))
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
