import { describe, expect, it } from 'vitest';
import { buildHead, type HeadTag } from '../../src/components/template/common/buildHead';
import type { SeoProps } from '../../src/components/template/common/seo';

/**
 * Plan social-distribution §11: buildHead must emit twitter:title,
 * twitter:description and twitter:image from the same (already-adapted)
 * OpenGraph values, preserving escaping (Astro renders the descriptors, so
 * that is out of scope here), canonical, and no duplicate tags.
 */

const metaByName = (tags: HeadTag[], name: string) =>
  tags.filter(
    (t) => t.tag === 'meta' && (t as { attrs: Record<string, string> }).attrs.name === name
  );

const metaByProperty = (tags: HeadTag[], property: string) =>
  tags.filter(
    (t) => t.tag === 'meta' && (t as { attrs: Record<string, string> }).attrs.property === property
  );

const baseConfig = (overrides: Partial<SeoProps> = {}): SeoProps =>
  ({
    title: 'Un titular científico',
    description: 'Un resumen del hallazgo.',
    canonical: 'https://noticiencias.com/ciencia/hallazgo/',
    openGraph: {
      url: 'https://noticiencias.com/ciencia/hallazgo/',
      images: [{ url: 'https://noticiencias.com/_astro/hero.jpg' }],
    },
    twitter: { cardType: 'summary_large_image' },
    ...overrides,
  }) as SeoProps;

describe('buildHead twitter card metadata', () => {
  it('emits twitter:title/description/image mirroring the OpenGraph values', () => {
    const tags = buildHead(baseConfig());

    expect(metaByName(tags, 'twitter:title')).toHaveLength(1);
    expect(metaByName(tags, 'twitter:description')).toHaveLength(1);
    expect(metaByName(tags, 'twitter:image')).toHaveLength(1);

    const twTitle = metaByName(tags, 'twitter:title')[0] as { attrs: Record<string, string> };
    const ogTitle = metaByProperty(tags, 'og:title')[0] as { attrs: Record<string, string> };
    expect(twTitle.attrs.content).toBe(ogTitle.attrs.content);
    expect(twTitle.attrs.content).toBe('Un titular científico');

    const twDesc = metaByName(tags, 'twitter:description')[0] as { attrs: Record<string, string> };
    const ogDesc = metaByProperty(tags, 'og:description')[0] as { attrs: Record<string, string> };
    expect(twDesc.attrs.content).toBe(ogDesc.attrs.content);

    const twImage = metaByName(tags, 'twitter:image')[0] as { attrs: Record<string, string> };
    expect(twImage.attrs.content).toBe('https://noticiencias.com/_astro/hero.jpg');
  });

  it('prefers explicit openGraph.title/description over the page title/description', () => {
    const tags = buildHead(
      baseConfig({
        openGraph: {
          title: 'Título OG específico',
          description: 'Descripción OG específica.',
          images: [{ url: 'https://noticiencias.com/_astro/hero.jpg' }],
        },
      } as Partial<SeoProps>)
    );

    const twTitle = metaByName(tags, 'twitter:title')[0] as { attrs: Record<string, string> };
    const twDesc = metaByName(tags, 'twitter:description')[0] as { attrs: Record<string, string> };
    expect(twTitle.attrs.content).toBe('Título OG específico');
    expect(twDesc.attrs.content).toBe('Descripción OG específica.');
  });

  it('omits twitter:image when the adapted og:image is empty', () => {
    const tags = buildHead(
      baseConfig({
        openGraph: {
          images: [{ url: '' }],
        },
      } as Partial<SeoProps>)
    );

    expect(metaByName(tags, 'twitter:image')).toHaveLength(0);
    // title/description still emitted
    expect(metaByName(tags, 'twitter:title')).toHaveLength(1);
    expect(metaByName(tags, 'twitter:description')).toHaveLength(1);
  });

  it('omits all three when there is no OpenGraph block', () => {
    const tags = buildHead({
      title: 'Sólo título',
      twitter: { cardType: 'summary' },
    } as SeoProps);

    expect(metaByName(tags, 'twitter:title')).toHaveLength(0);
    expect(metaByName(tags, 'twitter:description')).toHaveLength(0);
    expect(metaByName(tags, 'twitter:image')).toHaveLength(0);
  });

  it('does not duplicate the canonical link or twitter tags', () => {
    const tags = buildHead(baseConfig());
    expect(
      tags.filter(
        (t) =>
          t.tag === 'link' && (t as { attrs: Record<string, string> }).attrs.rel === 'canonical'
      )
    ).toHaveLength(1);
    expect(metaByName(tags, 'twitter:card')).toHaveLength(1);
    expect(metaByName(tags, 'twitter:title')).toHaveLength(1);
  });
});
