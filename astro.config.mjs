import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';
import astrowind from './src/integration';

import { fileURLToPath } from 'url';
import path from 'path';
import { safeRead } from './src/utils/safeFs';
import { safeYamlLoad } from './src/integration/utils/loadConfig.ts';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ahrefs Site Audit flagged 150 noindexed /temas/[tag]/ URLs in the sitemap
// (src/pages/temas/[tag]/[...page].astro sets robots: { index: false }).
// Google's own guidance is that a sitemap should not list noindex URLs.
//
// The tag base path derives from src/config.yaml (apps.blog.tag.pathname)
// at build time through the repo's own safeYamlLoad helper, so the exclusion
// still holds if the taxonomy pathname is ever renamed. No yaml.load call
// site lives in this file (static analysis forbids it in config context);
// the parse itself is centralized in src/integration/utils/loadConfig.ts.
const siteYamlConfig = safeYamlLoad(safeRead('src/config.yaml'));
const tagPathname = siteYamlConfig?.apps?.blog?.tag?.pathname ?? 'tag';
const tagBasePath = `/${String(tagPathname)
  .replace(/^\/+|\/+$/g, '')
  .toLowerCase()}/`;

// Legacy `/article-NNN/` URLs (indexed before posts moved to descriptive
// slugs) and hub paths that never had a page. Static hosting has no server
// redirects, so Astro emits instant meta-refresh pages, which Google treats as
// permanent redirects. Source -> target, both absolute paths with a trailing
// slash. When a post is unpublished, retarget its entries here:
// tests/legacy-redirects.test.ts fails if a target is no longer built.
const legacyRedirects = JSON.parse(safeRead('data/legacy-redirects.json'));

// https://astro.build/config
export default defineConfig({
  site: 'https://noticiencias.com',
  prefetch: false,
  redirects: legacyRedirects,
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
