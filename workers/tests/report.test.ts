/**
 * Unit tests for report validation logic.
 * These test the validation functions directly without requiring a Worker runtime.
 */

import { describe, it, expect } from 'vitest';
import { validateReportPayload, VALID_PROBLEM_TYPES } from '../src/utils/validate';

describe('validateReportPayload', () => {
  it('rejects empty body', () => {
    const result = validateReportPayload(null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects an array body', () => {
    const result = validateReportPayload(['not', 'an', 'object']);
    expect(result.valid).toBe(false);
  });

  it('rejects missing problem_type', () => {
    const result = validateReportPayload({ description: 'test' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Tipo de problema'))).toBe(true);
  });

  it('rejects invalid problem_type', () => {
    const result = validateReportPayload({ problem_type: 'invalid_type' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('inválido'))).toBe(true);
  });

  it('accepts valid minimal payload', () => {
    const result = validateReportPayload({ problem_type: 'content_factual' });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts valid full payload', () => {
    const result = validateReportPayload({
      problem_type: 'content_source',
      article_url: 'https://noticiencias.com/tecnologia/ejemplo',
      description: 'La fuente citada no corresponde al dato',
      content_snippet: 'Texto exacto copiado del artículo',
      evidence_url: 'https://example.com/evidence',
      tech_browser: 'Chrome 120',
      tech_os: 'Windows 11',
      reporter_email: 'usuario@example.com',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects unexpected top-level fields', () => {
    const result = validateReportPayload({
      problem_type: 'content_factual',
      admin: true,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('no permitido'))).toBe(true);
  });

  it('rejects a non-string description (e.g. an object)', () => {
    const result = validateReportPayload({
      problem_type: 'content_factual',
      description: { injected: true },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Descripción'))).toBe(true);
  });

  it('rejects an oversized description', () => {
    const result = validateReportPayload({
      problem_type: 'content_factual',
      description: 'x'.repeat(5001),
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('límite'))).toBe(true);
  });

  it('rejects article_url from a non-noticiencias domain', () => {
    const result = validateReportPayload({
      problem_type: 'content_factual',
      article_url: 'https://other-site.com/article',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('noticiencias.com'))).toBe(true);
  });

  it('rejects a lookalike domain (suffix match without dot boundary)', () => {
    const result = validateReportPayload({
      problem_type: 'content_factual',
      article_url: 'https://evilnoticiencias.com/article',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('noticiencias.com'))).toBe(true);
  });

  it('accepts a valid noticiencias.com subdomain', () => {
    const result = validateReportPayload({
      problem_type: 'content_factual',
      article_url: 'https://blog.noticiencias.com/article',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects invalid evidence_url', () => {
    const result = validateReportPayload({
      problem_type: 'content_factual',
      evidence_url: 'not-a-url',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('evidencia'))).toBe(true);
  });

  it('rejects invalid email format', () => {
    const result = validateReportPayload({
      problem_type: 'content_factual',
      reporter_email: 'not-an-email',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('electrónico'))).toBe(true);
  });

  it('accepts all valid problem types', () => {
    for (const t of VALID_PROBLEM_TYPES) {
      const result = validateReportPayload({ problem_type: t });
      expect(result.valid).toBe(true);
    }
  });
});
