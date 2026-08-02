import type { Taxonomy } from '~/types';

export interface CategorySection {
  slug: string;
  title: string;
  description: string;
  icon: string;
  showInHeader: boolean;
  /** Clases Tailwind para el TopicBadge de la categoría (light + dark). */
  color: string;
}

export const configuredCategorySections: CategorySection[] = [
  {
    slug: 'ciencia',
    title: 'Ciencia',
    description:
      'Investigación, clima, energía, materiales, ambiente y descubrimientos con impacto público.',
    icon: 'tabler:microscope',
    showInHeader: true,

    color:
      'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800',
  },
  {
    slug: 'astronomia',
    title: 'Astronomía',
    description: 'Espacio, cosmología y exploración del universo.',
    icon: 'tabler:telescope',
    showInHeader: true,

    color:
      'bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300 dark:hover:bg-violet-900/50 border border-violet-200 dark:border-violet-800',
  },
  {
    slug: 'salud',
    title: 'Salud',
    description: 'Medicina, bienestar y avances clínicos con impacto humano.',
    icon: 'tabler:heart-rate-monitor',
    showInHeader: true,

    color:
      'bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-900/30 dark:text-teal-300 dark:hover:bg-teal-900/50 border border-teal-200 dark:border-teal-800',
  },
  {
    slug: 'tecnologia',
    title: 'Tecnología',
    description:
      'IA, software, dispositivos, plataformas de internet, ciberseguridad e infraestructura digital.',
    icon: 'tabler:device-laptop',
    showInHeader: true,

    color:
      'bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-900/30 dark:text-sky-300 dark:hover:bg-sky-900/50 border border-sky-200 dark:border-sky-800',
  },
  {
    slug: 'editorial',
    title: 'Editorial',
    description: 'Piezas propias de Noticiencias sobre criterio, enfoque y contexto.',
    icon: 'tabler:news',
    showInHeader: true,

    color:
      'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700',
  },
  {
    slug: 'fisica',
    title: 'Física',
    description: 'Mecánica cuántica, materia y fenómenos físicos fundamentales.',
    icon: 'tabler:atom-2',
    showInHeader: false,

    color:
      'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800',
  },
  {
    slug: 'quimica',
    title: 'Química',
    description: 'Materiales, compuestos, reacciones y catálisis.',
    icon: 'tabler:flask',
    showInHeader: false,

    color:
      'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800',
  },
  {
    slug: 'biologia',
    title: 'Biología',
    description: 'Vida no humana, genética, evolución y biodiversidad.',
    icon: 'tabler:dna-2',
    showInHeader: false,

    color:
      'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800',
  },
  {
    slug: 'arqueologia',
    title: 'Arqueología',
    description: 'Hallazgos materiales y reconstrucciones del pasado humano.',
    icon: 'tabler:brush',
    showInHeader: false,

    color:
      'bg-stone-100 text-stone-700 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700',
  },
];

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
  configuredCategorySections.find((section) => section.slug === slug)?.color ?? null;
