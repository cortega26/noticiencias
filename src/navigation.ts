import { getPermalink, getAsset } from './utils/permalinks';
import { configuredCategorySections } from './utils/categorySections';
import type { CategorySection } from './utils/categorySections';

// Named function (not a const arrow) on purpose: Codacy's Biome/Qwik rule
// false-positives on `const fn = () => ...` assignments.
function categoryLink({ title, slug }: CategorySection) {
  return {
    text: title,
    href: getPermalink(slug, 'category'),
  };
}

// Primary navigation stays at six content entries. Sub-disciplines of Ciencia
// (Física, Química, Biología) are nested under their parent instead of
// competing with it at the same level; the rest lives under "Más" together
// with Series. Footer still lists every section.
const primarySections = configuredCategorySections.filter(({ navGroup }) => navGroup === 'primary');
const scienceSections = configuredCategorySections.filter(({ navGroup }) => navGroup === 'ciencia');
const overflowSections = configuredCategorySections.filter(({ navGroup }) => navGroup === 'mas');

const primaryHeaderLinks = primarySections.map((section) =>
  section.slug === 'ciencia' && scienceSections.length > 0
    ? {
        text: section.title,
        links: [
          { text: 'Toda la sección', href: getPermalink(section.slug, 'category') },
          ...scienceSections.map(categoryLink),
        ],
      }
    : categoryLink(section)
);

export const headerData = {
  links: [
    ...primaryHeaderLinks,
    ...(overflowSections.length
      ? [
          {
            text: 'Más',
            ariaLabel: 'Más secciones',
            links: [
              ...overflowSections.map(categoryLink),
              { text: 'Series', href: getPermalink('/series/') },
            ],
          },
        ]
      : []),
  ],
  actions: [{ text: 'Buscar', href: '/buscar/', icon: 'tabler:search' }],
};

export const footerData = {
  links: [
    {
      title: 'Secciones',
      links: configuredCategorySections.map(categoryLink),
    },
    {
      title: 'Organización',
      links: [
        { text: 'Acerca de', href: getPermalink('/nosotros/') },
        { text: 'Metodología', href: getPermalink('/metodologia/') },
        { text: 'Transparencia', href: getPermalink('/transparencia/') },
      ],
    },
  ],
  secondaryLinks: [
    { text: 'Privacidad', href: getPermalink('/privacidad/') },
    { text: 'Boletín semanal', href: getPermalink('/newsletter/') },
    { text: 'RSS', href: getAsset('/rss.xml') },
    { text: 'Reportar un problema', href: getPermalink('/reportar-problema/') },
    { text: 'Patrocinios', href: getPermalink('/patrocinios/') },
  ],
  socialLinks: [
    { ariaLabel: 'X', icon: 'tabler:brand-x', href: 'https://twitter.com/noti_ciencias' },
    {
      ariaLabel: 'LinkedIn',
      icon: 'tabler:brand-linkedin',
      href: 'https://www.linkedin.com/company/111101311/',
    },
    {
      ariaLabel: 'Github',
      icon: 'tabler:brand-github',
      href: 'https://github.com/cortega26/noticiencias',
    },
  ],
  footNote: `
    &copy; ${new Date().getFullYear()} Noticiencias · Todos los derechos reservados.
  `,
};
