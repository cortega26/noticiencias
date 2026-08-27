import { describe, expect, it } from 'vitest';
import { serializePostToMarkdown } from '../src/utils/markdownArticle';
import type { Post } from '~/types';

const basePost: Post = {
  id: 'post-1.md',
  slug: 'post-1',
  permalink: 'ciencia/post-1',
  publishDate: new Date('2026-01-15T00:00:00Z'),
  title: 'Un descubrimiento importante',
  author: 'Noticiencias',
  category: { slug: 'ciencia', title: 'Ciencia' },
  tags: [{ slug: 'espacio', title: 'Espacio' }],
  excerpt: 'Un resumen breve.',
  confidence: 'alta',
  translation_method: 'human_reviewed',
  source_url: 'https://example.com/fuente-original',
  investigation: false,
  summary_points: ['Punto uno', 'Punto dos'],
  why_it_matters: ['Es relevante porque sí.'],
  fact_check: [{ label: 'La afirmación central', status: 'confirmed' }],
  sources: [
    {
      title: 'Fuente Original',
      url: 'https://example.com/fuente',
      publisher: 'Revista Ejemplo',
      date: '2026-01-10',
    },
    { title: 'Fuente Sin Metadata', url: 'https://example.com/sin-metadata' },
  ],
  glossary: [{ term: 'Fotón', definition: 'Partícula de luz.' }],
  uncertainty_note: 'Hay incertidumbre sobre el mecanismo exacto.',

  // Internal/raw fields that must never leak into the public Markdown
  // artifact (see docs/adr/0008-markdown-for-agents.md constraint #4).
  refinery_id: 'internal-refinery-id-should-not-leak',
  editorial_score: 0.42,
  review_status: 'pending_internal_review',
};

describe('serializePostToMarkdown', () => {
  it('includes the public editorial enrichment fields', () => {
    const output = serializePostToMarkdown(
      basePost,
      'Cuerpo del artículo.',
      'https://noticiencias.com/ciencia/post-1'
    );

    expect(output).toContain(
      '[Un descubrimiento importante](https://noticiencias.com/ciencia/post-1)'
    );
    expect(output).toContain('Punto uno');
    expect(output).toContain('Es relevante porque sí.');
    expect(output).toContain('Fuente Original');
    expect(output).toContain('(Revista Ejemplo)');
    expect(output).toContain(', 2026-01-10');
    expect(output).toContain('Fuente Sin Metadata');
    expect(output).toContain('Fotón');
    expect(output).toContain('Hay incertidumbre sobre el mecanismo exacto.');
    expect(output).toContain('Cuerpo del artículo.');
    expect(output).toContain('**Método de Traducción:** human_reviewed');
    expect(output).toContain('**URL de Origen:** https://example.com/fuente-original');
  });

  it('includes fact_check — fixing the prior llms-full.txt omission (ADR-0008)', () => {
    const output = serializePostToMarkdown(basePost, 'body', 'https://noticiencias.com/x');

    expect(output).toContain('La afirmación central');
    expect(output).toContain('confirmed');
  });

  it('never leaks internal/raw frontmatter not in the public allowlist', () => {
    const output = serializePostToMarkdown(basePost, 'body', 'https://noticiencias.com/x');

    expect(output).not.toContain('internal-refinery-id-should-not-leak');
    expect(output).not.toContain('pending_internal_review');
    expect(output).not.toContain('0.42');
  });

  it('omits optional sections entirely when the post lacks them', () => {
    const minimalPost: Post = {
      id: 'post-2.md',
      slug: 'post-2',
      permalink: 'post-2',
      publishDate: new Date('2026-01-15T00:00:00Z'),
      title: 'Título mínimo',
      investigation: true,
    };

    const output = serializePostToMarkdown(minimalPost, 'body', 'https://noticiencias.com/post-2');

    expect(output).not.toContain('Verificación de Datos');
    expect(output).not.toContain('Glosario Científico');
    expect(output).not.toContain('Nota de Incertidumbre');
    expect(output).toContain('**Investigación Original:** Sí');
  });
});
