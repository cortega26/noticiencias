import { getPermalink, getAsset } from './utils/permalinks';

export const headerData = {
  links: [
    {
      text: 'Ciencia',
      href: getPermalink('/categorias/ciencia/'),
    },
    {
      text: 'Salud',
      href: getPermalink('/categorias/salud/'),
    },
    {
      text: 'Tecnología',
      href: getPermalink('/categorias/tecnologia/'),
    },
    {
      text: 'Editorial',
      href: getPermalink('/categorias/editorial/'),
    },
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
    { text: 'Reportar un problema', href: getPermalink('/reportar-problema') },
  ],
  socialLinks: [
    { ariaLabel: 'X', icon: 'tabler:brand-x', href: 'https://twitter.com/noticiencias' },
    { ariaLabel: 'Instagram', icon: 'tabler:brand-instagram', href: '#' },
    { ariaLabel: 'LinkedIn', icon: 'tabler:brand-linkedin', href: '#' },
    { ariaLabel: 'Github', icon: 'tabler:brand-github', href: 'https://github.com/cortega26/noticiencias' },
  ],
  footNote: `
    &copy; ${new Date().getFullYear()} Noticiencias · Todos los derechos reservados.
  `,
};

