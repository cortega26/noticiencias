import { describe, expect, it } from 'vitest';
import { loadDistArticle } from './helpers/load-dist-article';

const SLUG = '2026-01-17-cientificos-descubren-adn-preservado-en-guepardos-momificados';

describe('cheetah article primary-source upgrade', () => {
  it('links the original peer-reviewed study and its author correction', () => {
    const $ = loadDistArticle(SLUG);
    const primary = $('a[data-analytics-primary-source]')
      .map((_, a) => $(a).attr('href'))
      .get();
    expect(primary).toContain('https://www.nature.com/articles/s43247-025-03021-6');
    expect(primary).toContain('https://www.nature.com/articles/s43247-026-03258-9');
    expect(
      $('a[data-analytics-source]')
        .map((_, a) => $(a).attr('href'))
        .get()
    ).toContain(
      'https://livescience.com/animals/cats/ancient-mummified-cheetahs-discovered-in-saudi-arabia-contain-preserved-dna-from-the-long-lost-population'
    );
  });

  it('discloses dated editorial correction and distinguishes the study from a reintroduction trial', () => {
    const $ = loadDistArticle(SLUG);
    const text = $('article').text();
    expect(text).toContain('Corrección (2026-10-10)');
    expect(text).toContain('tres genomas completos');
    expect(text).toContain('parentesco genético no equivale a viabilidad ecológica');
  });
});
