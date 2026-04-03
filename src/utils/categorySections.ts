import type { Taxonomy } from '~/types';

export interface CategorySection {
  slug: string;
  title: string;
  description: string;
  icon: string;
  showInHeader: boolean;
}

export const configuredCategorySections: CategorySection[] = [
  {
    slug: 'astronomia',
    title: 'Astronomía',
    description: 'Espacio, cosmología y exploración del universo.',
    icon: 'tabler:telescope',
    showInHeader: true,
  },
  {
    slug: 'salud',
    title: 'Salud',
    description: 'Medicina, bienestar y avances clínicos con impacto humano.',
    icon: 'tabler:heart-rate-monitor',
    showInHeader: true,
  },
  {
    slug: 'tecnologia',
    title: 'Tecnología',
    description: 'Innovación, IA, plataformas y sistemas digitales.',
    icon: 'tabler:device-laptop',
    showInHeader: true,
  },
  {
    slug: 'editorial',
    title: 'Editorial',
    description: 'Piezas propias de Noticiencias sobre criterio, enfoque y contexto.',
    icon: 'tabler:news',
    showInHeader: true,
  },
  {
    slug: 'fisica',
    title: 'Física',
    description: 'Mecánica cuántica, materia y fenómenos físicos fundamentales.',
    icon: 'tabler:atom-2',
    showInHeader: false,
  },
  {
    slug: 'quimica',
    title: 'Química',
    description: 'Materiales, compuestos, reacciones y catálisis.',
    icon: 'tabler:flask',
    showInHeader: false,
  },
  {
    slug: 'biologia',
    title: 'Biología',
    description: 'Vida no humana, genética, evolución y biodiversidad.',
    icon: 'tabler:dna-2',
    showInHeader: false,
  },
  {
    slug: 'arqueologia',
    title: 'Arqueología',
    description: 'Hallazgos materiales y reconstrucciones del pasado humano.',
    icon: 'tabler:brush',
    showInHeader: false,
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
