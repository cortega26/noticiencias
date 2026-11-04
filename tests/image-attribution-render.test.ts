import { describe, expect, it } from 'vitest';
import { loadDistArticle } from './helpers/load-dist-article';

describe('rendered image attribution', () => {
  it('labels a CC0 dedication and links the image source', () => {
    const $ = loadDistArticle(
      '2026-08-26-que-revelo-el-adn-de-una-tortuga-que-el-tiempo-habia-borrado'
    );
    const caption = $('figcaption').first();
    expect(
      caption
        .find('a')
        .map((_, a) => $(a).attr('href'))
        .get()
    ).toContain('https://commons.wikimedia.org/wiki/File:Galapagos_Tortoise_Closeup.jpg');
    const dedication = caption.find('a[href="https://creativecommons.org/publicdomain/zero/1.0/"]');
    expect(dedication.text().trim()).toBe('Dedicación CC0');
    expect(dedication.attr('rel')).toBeUndefined();
  });

  it('keeps the license relation for CC BY images', () => {
    const $ = loadDistArticle(
      '2026-05-23-un-cohete-con-un-motor-apagado-y-otro-fallando-llego-al-espacio-y-volvio'
    );
    const license = $('figcaption')
      .first()
      .find('a[href="https://creativecommons.org/licenses/by/2.0/"]');
    expect(license.text().trim()).toBe('Licencia');
    expect(license.attr('rel')).toContain('license');
  });
});
