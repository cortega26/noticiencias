import { getPermalink, getAsset } from './utils/permalinks';

export const headerData = {
  links: [
    {
      text: 'Acerca de',
      href: getPermalink('/nosotros/'),
    },
    {
      text: 'Metodología',
      href: getPermalink('/metodologia/'),
    },
    {
      text: 'Transparencia',
      href: getPermalink('/transparencia/'),
    },
    {
      text: 'Explorar',
      links: [
        {
          text: 'Editorial',
          href: getPermalink('/categorias/editorial/'),
        },
        {
          text: 'Salud',
          href: getPermalink('/categorias/salud/'),
        },
        {
          text: 'Ciencia',
          href: getPermalink('/categorias/ciencia/'),
        },
        {
          text: 'Tecnología',
          href: getPermalink('/categorias/tecnologia/'),
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
        { text: 'Editorial', href: getPermalink('/categorias/editorial/') },
        { text: 'Salud', href: getPermalink('/categorias/salud/') },
        { text: 'Ciencia', href: getPermalink('/categorias/ciencia/') },
        { text: 'Tecnología', href: getPermalink('/categorias/tecnologia/') },
      ],
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
  ],
  socialLinks: [
    { ariaLabel: 'X', icon: 'tabler:brand-x', href: 'https://twitter.com/noticiencias' },
    { ariaLabel: 'Github', icon: 'tabler:brand-github', href: 'https://github.com/cortega26/noticiencias' },
  ],
  footNote: `
    &copy; ${new Date().getFullYear()} Noticiencias · Todos los derechos reservados.
  `,
};

