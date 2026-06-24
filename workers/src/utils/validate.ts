/**
 * Zod validation schemas for the Worker API.
 *
 * Mirrors the validation already present in the frontend ReportForm component
 * to provide server-side validation as a second line of defense.
 */

// Minimal Zod-like validation (no dependency — Workers run best with zero deps).
// For production, consider adding zod as a dependency if the bundle size is acceptable.

export interface ReportPayload {
  problem_type: string;
  article_url?: string;
  description?: string;
  evidence_url?: string;
  reporter_email?: string;
}

const VALID_PROBLEM_TYPES = [
  'error_factual',
  'fuente_rota',
  'info_desactualizada',
  'problema_tecnico',
  'sesgo',
  'otro',
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateReportPayload(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['El cuerpo de la solicitud debe ser un objeto JSON'] };
  }

  const data = body as Record<string, unknown>;

  // problem_type — required
  if (!data.problem_type || typeof data.problem_type !== 'string') {
    errors.push('Tipo de problema es requerido');
  } else if (!VALID_PROBLEM_TYPES.includes(data.problem_type)) {
    errors.push(`Tipo de problema inválido: ${data.problem_type}`);
  }

  // article_url — optional but must be a valid URL if present
  if (data.article_url) {
    if (typeof data.article_url !== 'string') {
      errors.push('URL del artículo debe ser texto');
    } else {
      try {
        const url = new URL(data.article_url);
        if (!url.hostname.endsWith('noticiencias.com')) {
          // Allow only noticiencias.com domains
          errors.push('URL del artículo debe ser de noticiencias.com');
        }
      } catch {
        errors.push('URL del artículo no es válida');
      }
    }
  }

  // description — optional but should be reasonable if present
  if (data.description && typeof data.description === 'string' && data.description.length > 5000) {
    errors.push('La descripción excede el límite de 5000 caracteres');
  }

  // evidence_url — optional but must be valid URL if present
  if (data.evidence_url) {
    if (typeof data.evidence_url !== 'string') {
      errors.push('URL de evidencia debe ser texto');
    } else {
      try {
        new URL(data.evidence_url);
      } catch {
        errors.push('URL de evidencia no es válida');
      }
    }
  }

  // reporter_email — optional but must be valid email if present
  if (data.reporter_email && typeof data.reporter_email === 'string') {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(data.reporter_email)) {
      errors.push('Correo electrónico no es vaĺido');
    }
  }

  return { valid: errors.length === 0, errors };
}
