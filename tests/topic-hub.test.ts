import fs from 'node:fs';
import path from 'node:path';

import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';

import { getTopicHub, MIN_TOPIC_HUB_POSTS } from '../src/utils/topics';

const distDir = path.join(__dirname, '..', 'dist');

function readDistHtml(route: string) {
  const htmlPath = path.join(distDir, route.replace(/^\/+|\/+$/g, ''), 'index.html');
  expect(fs.existsSync(htmlPath), `Built HTML missing for ${route}. Run npm run build.`).toBe(true);
  return fs.readFileSync(htmlPath, 'utf8');
}

describe('topic hubs (P2-06)', () => {
  it('curates hubs only for real topics with critical mass', () => {
    expect(MIN_TOPIC_HUB_POSTS).toBeGreaterThanOrEqual(2);
    expect(getTopicHub('coral')?.description).toContain('arrecifes');
    expect(getTopicHub('universo')?.description).toContain('universo');
    expect(getTopicHub('galapagos')?.description).toContain('Galápagos');
    // `misión` collides between space missions and the editorial mission.
    expect(getTopicHub('mision')).toBeUndefined();
  });

  it('renders the enriched hub header with description, count, update and areas', () => {
    const page = load(readDistHtml('/temas/coral/'));
    const header = page('h1').closest('header');

    expect(header.text()).toContain('arrecifes');
    expect(header.text()).toContain('2 historias');
    expect(header.text()).toContain('Actualizada el');
    expect(header.find('nav[aria-label="Áreas del tema"] a').length).toBeGreaterThan(0);
  });

  it('keeps singleton tags as simple listings without inventing a description', () => {
    const page = load(readDistHtml('/temas/materia-oscura/'));
    const header = page('h1').closest('header');

    expect(header.text()).toContain('1 historia publicada sobre este hilo');
    expect(header.text()).not.toContain('Actualizada el');
  });
});
