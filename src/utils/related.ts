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

function sharedTagCount(original: Post, candidate: Post): number {
  const originalTags = new Set((original.tags ?? []).map((tag) => tag.slug));
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

function relatedScore(original: Post, candidate: Post): number {
  return (
    (sharesCategory(original, candidate) ? 4 : 0) +
    (sharesSeries(original, candidate) ? 3 : 0) +
    sharedTagCount(original, candidate) * 2 +
    (sharesEvidenceType(original, candidate) ? 1 : 0) +
    (sharesPublicationStatus(original, candidate) ? 1 : 0)
  );
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
