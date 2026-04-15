import { getPermalink, getAsset } from './utils/permalinks';
import { configuredCategorySections } from './utils/categorySections';

const publishedCategorySections = configuredCategorySections.map(
  ({ title, slug, description, icon, showInHeader }) => ({
    text: title,
    href: getPermalink(slug, 'category'),
    description,
    icon,
    showInHeader,
  })
);

export const homeSectionItems = publishedCategorySections.map(
  ({ text, href, description, icon }) => ({
    title: text,
    description,
    icon,
    callToAction: { text: 'Ver sección', href },
  })
);

const primaryHeaderLinks = publishedCategorySections
  .filter(({ showInHeader }) => showInHeader)
  .map(({ text, href }) => ({ text, href }));

const overflowHeaderLinks = publishedCategorySections
  .filter(({ showInHeader }) => !showInHeader)
  .map(({ text, href }) => ({ text, href }));

export const headerData = {
  links: [
    ...primaryHeaderLinks,
    ...(overflowHeaderLinks.length
      ? [
          {
            text: 'Más',
            ariaLabel: 'Más categorías',
            links: overflowHeaderLinks,
          },
        ]
      : []),
    {
      text: 'Series',
      href: getPermalink('/series/'),
    },
  ],
  actions: [{ text: 'Buscar', href: '/buscar/', icon: 'tabler:search' }],
};

export const footerData = {
  links: [
    {
      title: 'Secciones',
      links: publishedCategorySections.map(({ text, href }) => ({ text, href })),
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
    { text: 'RSS', href: getAsset('/rss.xml') },
    { text: 'Reportar un problema', href: getPermalink('/reportar-problema') },
  ],
  socialLinks: [
    { ariaLabel: 'X', icon: 'tabler:brand-x', href: 'https://twitter.com/noti_ciencias' },
    { ariaLabel: 'Instagram', icon: 'tabler:brand-instagram', href: '#' },
    { ariaLabel: 'LinkedIn', icon: 'tabler:brand-linkedin', href: '#' },
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
