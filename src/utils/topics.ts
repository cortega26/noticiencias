export type { TopicHub } from './taxonomy-copy';
export { getTopicHub } from './taxonomy-copy';

// P2-06: a tag becomes a quality hub only when it is a real topic (editorial
// curation) and the corpus backs it with critical mass. Copy lives in the
// interim taxonomy-copy module until the publication contract carries topic
// metadata (same pattern as series, DEC-023). This file delegates;
// exports stable.
export const MIN_TOPIC_HUB_POSTS = 2;
