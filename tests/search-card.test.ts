import { describe, expect, it } from 'vitest';
import {
  dialogCountMessage,
  dialogEmptyMessage,
  formatSearchMeta,
  formatSearchTags,
  pageCountMessage,
} from '../src/utils/browser/search-card';

describe('search-card status strings', () => {
  it('formats the dialog count line', () => {
    expect(dialogCountMessage(3)).toBe('3 resultados.');
  });

  it('formats the dialog empty line with the raw query', () => {
    expect(dialogEmptyMessage('agujeros negros')).toBe('Sin resultados para "agujeros negros".');
  });

  it('formats the page count line', () => {
    expect(pageCountMessage(7)).toBe('Se encontraron 7 resultados.');
  });
});

describe('search-card meta/tags', () => {
  it('drops empty meta segments', () => {
    expect(formatSearchMeta(undefined, undefined)).toBe('');
    expect(formatSearchMeta(['Ciencia'], undefined)).toBe('Ciencia');
  });

  it('joins category and formatted date', () => {
    const meta = formatSearchMeta(['Ciencia'], '2026-01-15');
    expect(meta.startsWith('Ciencia · ')).toBe(true);
    expect(meta).toContain('2026');
  });

  it('formats tags from array, string, or missing', () => {
    expect(formatSearchTags(['a', 'b'])).toBe('a, b');
    expect(formatSearchTags('solo')).toBe('solo');
    expect(formatSearchTags(undefined)).toBe('');
  });
});
