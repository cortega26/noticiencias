/**
 * Unit tests for report validation logic.
 * These test the validation functions directly without requiring a Worker runtime.
 */

import { describe, it, expect } from 'vitest';
import { validateReportPayload } from '../src/utils/validate';

describe('validateReportPayload', () => {
  it('rejects empty body', () => {
    const result = validateReportPayload(null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
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
    const result = validateReportPayload({ problem_type: 'error_factual' });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts valid full payload', () => {
    const result = validateReportPayload({
      problem_type: 'fuente_rota',
      article_url: 'https://noticiencias.com/tecnologia/ejemplo',
      description: 'El enlace de la fuente está roto',
      evidence_url: 'https://example.com/evidence',
      reporter_email: 'usuario@example.com',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects article_url from non-noticiencias domain', () => {
    const result = validateReportPayload({
      problem_type: 'error_factual',
      article_url: 'https://other-site.com/article',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('noticiencias.com'))).toBe(true);
  });

  it('rejects invalid evidence_url', () => {
    const result = validateReportPayload({
      problem_type: 'error_factual',
      evidence_url: 'not-a-url',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('evidencia'))).toBe(true);
  });

  it('rejects invalid email format', () => {
    const result = validateReportPayload({
      problem_type: 'error_factual',
      reporter_email: 'not-an-email',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('electrónico'))).toBe(true);
  });

  it('accepts all valid problem types', () => {
    const types = [
      'error_factual',
      'fuente_rota',
      'info_desactualizada',
      'problema_tecnico',
      'sesgo',
      'otro',
    ];
    for (const t of types) {
      const result = validateReportPayload({ problem_type: t });
      expect(result.valid).toBe(true);
    }
  });
});
