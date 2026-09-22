import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';
import astrowind from './src/integration';

import { fileURLToPath } from 'url';
import path from 'path';
import { readFileSync } from 'fs';
import yaml from 'js-yaml';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ahrefs Site Audit flagged 150 noindexed /temas/[tag]/ URLs in the sitemap
// (src/pages/temas/[tag]/[...page].astro sets robots: { index: false }).
// Google's own guidance is that a sitemap should not list noindex URLs.
// The tag archive base path is configurable (src/config.yaml
// apps.blog.tag.pathname, mirrored by TAG_BASE in src/utils/permalinks.ts),
// so it is read from that same file here instead of hardcoded, to avoid
// silently reintroducing the defect if the pathname is ever renamed.
const siteYamlConfig = yaml.load(
  readFileSync(path.resolve(__dirname, './src/config.yaml'), 'utf8')
  );
const tagPathname = siteYamlConfig?.apps?.blog?.tag?.pathname ?? 'tag';
const tagBasePath = `/${String(tagPathname).replace(/^\/+|\/+$/g, '').toLowerCase()}/`;

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
