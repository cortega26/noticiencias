import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';
import astrowind from './src/integration';

import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ahrefs Site Audit flagged 150 noindexed /temas/[tag]/ URLs in the sitemap
// (src/pages/temas/[tag]/[...page].astro sets robots: { index: false }).
// Google's own guidance is that a sitemap should not list noindex URLs.
//
// NOTE: this value duplicates src/config.yaml (apps.blog.tag.pathname).
// A YAML parser is deliberately NOT used here: static analysis forbids
// yaml.load in config context, and the sync is machine-checked instead —
// scripts/dist-sanity.js fails the build if this diverges from config.yaml
// or if any /temas/ URL leaks into the sitemap.
const tagBasePath = '/temas/';

// https://astro.build/config
export default defineConfig({
  site: 'https://noticiencias.com',
  prefetch: false,
  integrations: [
    sitemap({
      filter: (page) =>
        !page.includes('/buscar') &&
        !page.includes('/search.json') &&
        !page.includes('/social-manifest.json') &&
        !page.includes('/admin/') &&
        !page.includes('/llm-md/') &&
        !page.includes(tagBasePath),
    }),
    mdx(),
    icon({
      include: {
        tabler: ['*'],
        'flat-color-icons': [
          'template',
          'gallery',
          'approval',
          'document',
          'advertising',
          'currency-exchange',
          'voice-presentation',
          'business-contact',
          'database',
        ],
      },
    }),
    astrowind({ config: './src/config.yaml' }),
  ],
  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
      config: {
        limitInputPixels: false,
      },
    },
    domains: [
      'news.mit.edu',
      'news.yale.edu',
      'scitechdaily.com',
      'cdn.mos.cms.futurecdn.net', // Space.com, LiveScience
      'cdn.vox-cdn.com', // The Verge
      'media.wired.com', // Wired
      'images.nasa.gov',
      'www.nasa.gov',
      'preview.redd.it',
      'external-preview.redd.it',
      'upload.wikimedia.org',
      'static.scientificamerican.com',
      'images.newscientist.com',
    ],
  },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '~': path.resolve(__dirname, './src'),
      },
    },
  },
});
