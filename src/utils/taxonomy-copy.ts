/**
 * Interim editorial-copy home (plan 017 step 4, DEC-023/LAW-F1).
 *
 * The series / topic-hub / category descriptions live here until the
 * publication contract carries the corresponding field — copy must NOT move
 * into the sealed contract (separate LAW-F1 change, filed as Deferred).
 * `series.ts`, `topics.ts` and `categorySections.ts` delegate to these
 * getters; their exports stay stable so no importer changes.
 */

import type { Taxonomy } from '~/types';

export interface TopicHub {
  slug: string;
  description: string;
}

export interface CategorySection {
  slug: string;
  title: string;
  description: string;
  icon: string;
  navGroup: 'primary' | 'ciencia' | 'mas';
  /** Clases Tailwind para el TopicBadge de la categoría (light + dark). */
  color: string;
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

function fallbackSeriesDescription(name: string): string {
  return `Serie de Noticiencias sobre ${name}.`;
}

/** Resolved series description, with the neutral fallback for unknown series. */
export function getSeriesDescription(name: string): string {
  return SERIES_DESCRIPTIONS[name] ?? fallbackSeriesDescription(name);
}

// P2-06: a tag becomes a quality hub only when it is a real topic (editorial
// curation) and the corpus backs it with critical mass. `misión` is
// deliberately absent: it collides between space missions and the editorial
// mission statement. Descriptions live here until the publication contract
// carries topic metadata (same pattern as series, DEC-023).
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

export const configuredCategorySections: CategorySection[] = [
  {
    slug: 'ciencia',
    title: 'Ciencia',
    description:
      'Investigación, clima, energía, materiales, ambiente y descubrimientos con impacto público.',
    icon: 'tabler:microscope',
    navGroup: 'primary',

    color:
      'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800',
  },
  {
    slug: 'astronomia',
    title: 'Astronomía',
    description: 'Espacio, cosmología y exploración del universo.',
    icon: 'tabler:telescope',
    navGroup: 'primary',

    color:
      'bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300 dark:hover:bg-violet-900/50 border border-violet-200 dark:border-violet-800',
  },
  {
    slug: 'salud',
    title: 'Salud',
    description: 'Medicina, bienestar y avances clínicos con impacto humano.',
    icon: 'tabler:heart-rate-monitor',
    navGroup: 'primary',

    color:
      'bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-900/30 dark:text-teal-300 dark:hover:bg-teal-900/50 border border-teal-200 dark:border-teal-800',
  },
  {
    slug: 'tecnologia',
    title: 'Tecnología',
    description:
      'IA, software, dispositivos, plataformas de internet, ciberseguridad e infraestructura digital.',
    icon: 'tabler:device-laptop',
    navGroup: 'primary',

    color:
      'bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-900/30 dark:text-sky-300 dark:hover:bg-sky-900/50 border border-sky-200 dark:border-sky-800',
  },
  {
    slug: 'editorial',
    title: 'Editorial',
    description: 'Piezas propias de Noticiencias sobre criterio, enfoque y contexto.',
    icon: 'tabler:news',
    navGroup: 'primary',

    color:
      'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700',
  },
  {
    slug: 'fisica',
    title: 'Física',
    description: 'Mecánica cuántica, materia y fenómenos físicos fundamentales.',
    icon: 'tabler:atom-2',
    navGroup: 'ciencia',

    color:
      'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800',
  },
  {
    slug: 'quimica',
    title: 'Química',
    description: 'Materiales, compuestos, reacciones y catálisis.',
    icon: 'tabler:flask',
    navGroup: 'ciencia',

    color:
      'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800',
  },
  {
    slug: 'biologia',
    title: 'Biología',
    description: 'Vida no humana, genética, evolución y biodiversidad.',
    icon: 'tabler:dna-2',
    navGroup: 'ciencia',

    color:
      'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800',
  },
  {
    slug: 'arqueologia',
    title: 'Arqueología',
    description: 'Hallazgos materiales y reconstrucciones del pasado humano.',
    icon: 'tabler:brush',
    navGroup: 'mas',

    color:
      'bg-stone-100 text-stone-700 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700',
  },
];

/** Section record for a category slug, or `undefined` when unmapped. */
export function getCategorySection(slug: string): CategorySection | undefined {
  return configuredCategorySections.find((section) => section.slug === slug);
}

export const getConfiguredCategoryTaxonomies = (): Record<string, Taxonomy> =>
  Object.fromEntries(
    configuredCategorySections.map(({ slug, title }) => [
      slug,
      {
        slug,
        title,
      },
    ])
  );

/**
 * Devuelve las clases de color del TopicBadge para un slug de categoría,
 * o `null` si el slug no está mapeado (el call site decide si asertar).
 */
export const getCategoryColors = (slug: string): string | null =>
  getCategorySection(slug)?.color ?? null;
