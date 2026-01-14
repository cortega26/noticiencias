import { getPermalink, getAsset } from './utils/permalinks';

export const headerData = {
  links: [
    {
      text: 'Acerca de',
      href: getPermalink('/about/'),
    },
    {
      text: 'Metodología',
      href: getPermalink('/methodology/'),
    },
    {
      text: 'Transparencia',
      href: getPermalink('/transparency/'),
    },
    {
      text: 'Explorar',
      links: [
        {
          text: 'Editorial',
          href: getPermalink('/categories/editorial/'),
        },
        {
          text: 'Salud',
          href: getPermalink('/categories/salud/'),
        },
        {
          text: 'Ciencia',
          href: getPermalink('/categories/ciencia/'),
        },
        {
          text: 'Tecnología',
          href: getPermalink('/categories/tecnologia/'),
        }
      ],
    },
  ],
  actions: [{ text: 'Buscar', href: '/buscar/', icon: 'tabler:search' }],
};

export const footerData = {
  links: [
    {
      title: 'Secciones',
      links: [
        { text: 'Editorial', href: getPermalink('/categories/editorial/') },
        { text: 'Salud', href: getPermalink('/categories/salud/') },
        { text: 'Ciencia', href: getPermalink('/categories/ciencia/') },
        { text: 'Tecnología', href: getPermalink('/categories/tecnologia/') },
      ],
    },
    {
      title: 'Organización',
      links: [
        { text: 'Acerca de', href: getPermalink('/about/') },
        { text: 'Metodología', href: getPermalink('/methodology/') },
        { text: 'Transparencia', href: getPermalink('/transparency/') },
      ],
    },
  ],
  secondaryLinks: [
    { text: 'Privacidad', href: getPermalink('/privacy/') },
    { text: 'RSS', href: getAsset('/rss.xml') },
  ],
  socialLinks: [
    { ariaLabel: 'X', icon: 'tabler:brand-x', href: 'https://twitter.com/noticiencias' },
    { ariaLabel: 'Github', icon: 'tabler:brand-github', href: 'https://github.com/cortega26/noticiencias' },
  ],
  footNote: `
    &copy; ${new Date().getFullYear()} Noticiencias · Todos los derechos reservados.
  `,
};

