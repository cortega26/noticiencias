import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import tailwind from '@astrojs/tailwind';
import icon from 'astro-icon';
import astrowind from './src/integration';

import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://astro.build/config
export default defineConfig({
    site: 'https://noticiencias.com',
    integrations: [
        tailwind({ applyBaseStyles: false }),
        sitemap(),
        mdx(),
        icon({
            include: {
                tabler: ['*'],
                'flat-color-icons': ['template', 'gallery', 'approval', 'document', 'advertising', 'currency-exchange', 'voice-presentation', 'business-contact', 'database']
            }
        }),
        astrowind({ config: './src/config.yaml' })
    ],
    image: {
        domains: [
            'news.mit.edu',
            'news.yale.edu',
            'scitechdaily.com',
            'cdn.mos.cms.futurecdn.net',   // Space.com, LiveScience
            'cdn.vox-cdn.com',             // The Verge
            'media.wired.com',             // Wired
            'images.nasa.gov',
            'www.nasa.gov',
            'preview.redd.it',
            'external-preview.redd.it',
            'upload.wikimedia.org'
        ]
    },
    vite: {
        resolve: {
            alias: {
                '~': path.resolve(__dirname, './src'),
            },
        },
    },
});
