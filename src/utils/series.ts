import { cleanSlug } from './permalinks';
import type { Post } from '~/types';

export interface SeriesDossier {
  name: string;
  slug: string;
  description: string;
  count: number;
  latestDate: Date;
  /** Earliest post in the series: the "empieza aquí" starting point. */
  firstPost: Post;
  /** Series posts in reading order (oldest → newest). */
  posts: Post[];
}

// Series copy lives here until the publication contract carries a
// `series_description` field (LAW-F1 sealed; see DEC-023). Unknown series
// fall back to a neutral line instead of inventing a description.
const SERIES_DESCRIPTIONS: Record<string, string> = {
  Espacio:
    'Astronomía, exploración espacial y cosmología: los hallazgos que amplían el mapa del universo.',
  'IA en la práctica':
    'Inteligencia artificial aplicada: herramientas, plataformas y sus efectos reales.',
  'Salud que importa':
    'Medicina, biología humana y salud pública, con el modelo experimental a la vista.',
};

function fallbackDescription(name: string): string {
  return `Serie de Noticiencias sobre ${name}.`;
}

function byOldest(a: Post, b: Post): number {
  return a.publishDate.valueOf() - b.publishDate.valueOf();
}

export function buildSeriesDossiers(posts: Post[]): SeriesDossier[] {
  const grouped = new Map<string, Post[]>();

  for (const post of posts) {
    if (!post.series) continue;
    const group = grouped.get(post.series);
    if (group) group.push(post);
    else grouped.set(post.series, [post]);
  }

  return [...grouped.entries()]
    .map(([name, seriesPosts]) => {
      const ordered = [...seriesPosts].sort(byOldest);
      return {
        name,
        slug: cleanSlug(name),
        description: SERIES_DESCRIPTIONS[name] ?? fallbackDescription(name),
        count: ordered.length,
        latestDate: ordered[ordered.length - 1].publishDate,
        firstPost: ordered[0],
        posts: ordered,
      };
    })
    .sort(
      (a, b) =>
        b.count - a.count ||
        b.latestDate.valueOf() - a.latestDate.valueOf() ||
        a.name.localeCompare(b.name, 'es')
    );
}

export function getSeriesDossier(posts: Post[], slug: string): SeriesDossier | undefined {
  return buildSeriesDossiers(posts).find((dossier) => dossier.slug === slug);
}
