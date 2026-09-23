export interface TopicHub {
  slug: string;
  description: string;
}

// P2-06: a tag becomes a quality hub only when it is a real topic (editorial
// curation) and the corpus backs it with critical mass. `misión` is
// deliberately absent: it collides between space missions and the editorial
// mission statement. Descriptions live here until the publication contract
// carries topic metadata (same pattern as series, DEC-023).
export const MIN_TOPIC_HUB_POSTS = 2;

const TOPIC_HUB_DESCRIPTIONS: Record<string, string> = {
  universo:
    'Cosmología y estructura del universo: observaciones que ajustan lo que sabemos sobre su expansión y sus galaxias.',
  galapagos: 'Ciencia en el archipiélago: especies, historia natural y conservación en Galápagos.',
  coral:
    'Biología de los arrecifes: cómo los corales responden al calor, al oxígeno y al cambio climático.',
};

export function getTopicHub(slug: string): TopicHub | undefined {
  const description = TOPIC_HUB_DESCRIPTIONS[slug];
  return description ? { slug, description } : undefined;
}
