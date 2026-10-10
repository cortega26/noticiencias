import { describe, expect, it } from 'vitest';
import { loadDistArticle } from './helpers/load-dist-article';

describe('AdSense health evidence consistency', () => {
  it('dates the measles update, cites health authorities and avoids guarantees', () => {
    const $ = loadDistArticle(
      '2026-01-27-desafio-global-contra-el-sarampion-por-falta-de-confianza-en-las-vacunas'
    );
    const text = $('article').text();
    const primaryUrls = $('a[data-analytics-primary-source]')
      .map((_, a) => $(a).attr('href'))
      .get();
    expect(text).toContain('10 de octubre de 2026');
    expect(text).toContain('no una garantía absoluta');
    expect(primaryUrls.some((url) => url?.includes('who.int/europe/'))).toBe(true);
    expect(primaryUrls).toContain('https://www.paho.org/en/measles-multi-country-outbreak-2026');
  });

  it('attributes cancer risk estimates to the primary study, not lifestyle alone', () => {
    const $ = loadDistArticle(
      '2026-02-05-estudio-revela-que-un-tercio-del-cancer-es-prevenible-con-cambios-en-el-estilo-de-vida'
    );
    const primary = $('a[data-analytics-primary-source]');
    expect(primary.map((_, a) => $(a).attr('href')).get()).toContain(
      'https://doi.org/10.1038/s41591-026-04219-7'
    );
    expect($('article').text()).toContain('37,8 %');
    expect($('article').text()).toContain('185 países');
  });
});
