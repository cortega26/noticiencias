/**
 * Plan 023 Step 1 contract test: feeds the actual browser-side payload
 * builder's output into the Worker's authoritative validator, so a drift
 * between the two sides (field names, enum values) fails a test instead
 * of silently breaking every real submission.
 */

import { describe, it, expect } from 'vitest';
import { buildReportPayload, PROBLEM_TYPES } from '../src/utils/reportPayload';
import { validateReportPayload } from '../workers/src/utils/validate';

describe('report form -> Worker contract', () => {
  it('every UI problem type produces a Worker-valid payload', () => {
    for (const problemType of PROBLEM_TYPES) {
      const payload = buildReportPayload({
        problemType,
        reportUrl: 'https://noticiencias.com/tecnologia/ejemplo',
        reportDescription: 'Descripción suficientemente detallada del problema.',
        contentSnippet: 'Fragmento exacto copiado del artículo.',
        contentEvidence: 'https://fuente-confiable.org/evidencia',
        techBrowser: 'Chrome 120',
        techOs: 'Windows 11',
      });

      const result = validateReportPayload(payload);
      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
    }
  });

  it('maps camelCase UI field names to the Worker snake_case contract', () => {
    const payload = buildReportPayload({
      problemType: 'content_factual',
      reportUrl: 'https://noticiencias.com/a',
      reportDescription: 'desc',
      contentSnippet: 'snippet',
      contentEvidence: 'https://example.com/e',
      techBrowser: 'Firefox',
      techOs: 'Linux',
    });

    expect(payload).toEqual({
      problem_type: 'content_factual',
      article_url: 'https://noticiencias.com/a',
      description: 'desc',
      content_snippet: 'snippet',
      evidence_url: 'https://example.com/e',
      tech_browser: 'Firefox',
      tech_os: 'Linux',
    });
  });

  it('omits empty-string fields rather than sending them', () => {
    const payload = buildReportPayload({
      problemType: 'technical_site',
      reportUrl: 'https://noticiencias.com/a',
      reportDescription: 'desc',
      contentSnippet: '',
      contentEvidence: '',
      techBrowser: '',
      techOs: '',
    });

    expect(payload).toEqual({
      problem_type: 'technical_site',
      article_url: 'https://noticiencias.com/a',
      description: 'desc',
    });
  });

  it('drops unknown form fields rather than forwarding them', () => {
    const payload = buildReportPayload({
      problemType: 'content_factual',
      reportUrl: 'https://noticiencias.com/a',
      reportDescription: 'desc',
      unexpectedField: 'should not appear',
    });

    expect(Object.keys(payload)).not.toContain('unexpectedField');
    const result = validateReportPayload(payload);
    expect(result.valid).toBe(true);
  });

  it('an unknown UI problem type fails Worker validation', () => {
    const payload = buildReportPayload({
      problemType: 'not_a_real_type',
      reportUrl: 'https://noticiencias.com/a',
    });

    const result = validateReportPayload(payload);
    expect(result.valid).toBe(false);
  });

  it('a missing problem type fails Worker validation', () => {
    const payload = buildReportPayload({
      reportUrl: 'https://noticiencias.com/a',
    });

    const result = validateReportPayload(payload);
    expect(result.valid).toBe(false);
  });
});
