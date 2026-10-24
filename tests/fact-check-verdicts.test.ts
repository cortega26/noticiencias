import { describe, expect, it } from 'vitest';
import { getFactCheckVerdict } from '../src/utils/evidence-labels';
import { loadDistArticle } from './helpers/load-dist-article';

describe('fact-check editorial verdicts', () => {
  it.each([
    ['confirmed', 'Respaldado por la fuente', 'success', 'tabler:check'],
    ['verified', 'Respaldado por la fuente', 'success', 'tabler:check'],
    ['unsupported', 'Sin respaldo en las fuentes', 'warning', 'tabler:alert-triangle'],
    ['debunked', 'Contradicho por las fuentes', 'error', 'tabler:x'],
    ['contradicted', 'Contradicho por las fuentes', 'error', 'tabler:x'],
    ['unverified', 'Sin verificar', 'info', 'tabler:info-circle'],
    ['future_status', 'Sin verificar', 'info', 'tabler:info-circle'],
  ])('renders %s as %s', (status, label, variant, icon) => {
    expect(getFactCheckVerdict(status)).toEqual({ label, variant, icon });
  });

  it('normalizes whitespace and casing without upgrading unknown evidence', () => {
    expect(getFactCheckVerdict(' Confirmed ')).toEqual(getFactCheckVerdict('confirmed'));
    expect(getFactCheckVerdict(' UNKNOWN ')).toEqual(getFactCheckVerdict('unverified'));
  });

  it('explains source support without claiming independent confirmation', () => {
    const $ = loadDistArticle('2026-09-18-noticia-cientifica');
    const panel = $('#fuentes-y-limites');
    expect(panel.text()).toContain('no equivale a una confirmación científica independiente');
    expect(panel.text()).not.toContain('Evidencia robusta');
    expect(panel.text()).not.toContain('Valoración automática');
    const verdicts = panel.find('[data-fact-check-verdicts] [data-fact-check-status]');
    expect(verdicts.length).toBeGreaterThan(0);
    verdicts.each((_, element) => {
      expect($(element).attr('data-fact-check-status')).toBe('confirmed');
      expect($(element).text()).toContain('Respaldado por la fuente:');
    });
  });
});
