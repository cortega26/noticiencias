import { getPermalink, getAsset } from './utils/permalinks';

const publishedCategorySections = [
  {
    text: 'Astronomía',
    href: getPermalink('/categorias/astronomia/'),
    description: 'Espacio, cosmología y exploración del universo.',
    icon: 'tabler:telescope',
    showInHeader: true,
  },
  {
    text: 'Salud',
    href: getPermalink('/categorias/salud/'),
    description: 'Medicina, bienestar y avances clínicos con impacto humano.',
    icon: 'tabler:heart-rate-monitor',
    showInHeader: true,
  },
  {
    text: 'Tecnología',
    href: getPermalink('/categorias/tecnologia/'),
    description: 'Innovación, IA, plataformas y sistemas digitales.',
    icon: 'tabler:device-laptop',
    showInHeader: true,
  },
  {
    text: 'Editorial',
    href: getPermalink('/categorias/editorial/'),
    description: 'Piezas propias de Noticiencias sobre criterio, enfoque y contexto.',
    icon: 'tabler:news',
    showInHeader: true,
  },
  {
    text: 'Física',
    href: getPermalink('/categorias/fisica/'),
    description: 'Mecánica cuántica, materia y fenómenos físicos fundamentales.',
    icon: 'tabler:atom-2',
    showInHeader: false,
  },
  {
    text: 'Química',
    href: getPermalink('/categorias/quimica/'),
    description: 'Materiales, compuestos, reacciones y catálisis.',
    icon: 'tabler:flask',
    showInHeader: false,
  },
  {
    text: 'Biología',
    href: getPermalink('/categorias/biologia/'),
    description: 'Vida no humana, genética, evolución y biodiversidad.',
    icon: 'tabler:dna-2',
    showInHeader: false,
  },
  {
    text: 'Arqueología',
    href: getPermalink('/categorias/arqueologia/'),
    description: 'Hallazgos materiales y reconstrucciones del pasado humano.',
    icon: 'tabler:brush',
    showInHeader: false,
  },
];

export const homeSectionItems = publishedCategorySections.map(
  ({ text, href, description, icon }) => ({
    title: text,
    description,
    icon,
    callToAction: { text: 'Ver sección', href },
  })
);

export const headerData = {
  links: [
    ...publishedCategorySections
      .filter(({ showInHeader }) => showInHeader)
      .map(({ text, href }) => ({ text, href })),
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
    { ariaLabel: 'Github', icon: 'tabler:brand-github', href: 'https://github.com/cortega26/noticiencias' },
  ],
  footNote: `
    &copy; ${new Date().getFullYear()} Noticiencias · Todos los derechos reservados.
  `,
};
