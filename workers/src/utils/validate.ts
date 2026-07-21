/**
 * Validation for the report-form Worker API.
 *
 * Hand-rolled (no Zod dependency — Workers run best with zero deps).
 * This is the authoritative contract; the frontend's payload builder
 * (src/utils/reportPayload.ts in the Astro repo) maps UI values into this
 * shape, but never duplicates these rules.
 */

export interface ReportPayload {
  problem_type: string;
  article_url?: string;
  description?: string;
  content_snippet?: string;
  evidence_url?: string;
  tech_browser?: string;
  tech_os?: string;
  reporter_email?: string;
}

// Matches the six options in ReportForm.astro's #problem-type select exactly.
export const VALID_PROBLEM_TYPES = [
  'content_factual',
  'content_source',
  'content_interpretation',
  'content_translation',
  'technical_site',
  'technical_visual',
];

const ALLOWED_KEYS = new Set<string>([
  'problem_type',
  'article_url',
  'description',
  'content_snippet',
  'evidence_url',
  'tech_browser',
  'tech_os',
  'reporter_email',
]);

// Per-field max lengths — bounds abuse (huge payloads) without constraining
// legitimate reports. Enforced on top of the handler's overall body-size cap.
const MAX_LENGTHS: Partial<Record<keyof ReportPayload, number>> = {
  article_url: 2000,
  description: 5000,
  content_snippet: 2000,
  evidence_url: 2000,
  tech_browser: 200,
  tech_os: 200,
  reporter_email: 320, // RFC 5321 max mailbox length
};

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function isNoticienciasHost(hostname: string): boolean {
  // Dot-boundary match: "noticiencias.com" or "*.noticiencias.com" only —
  // NOT lookalikes like "evilnoticiencias.com".
  return hostname === 'noticiencias.com' || hostname.endsWith('.noticiencias.com');
}

function validateOptionalString(
  data: Record<string, unknown>,
  field: keyof ReportPayload,
  label: string,
  errors: string[]
): string | undefined {
  const value = data[field];
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value !== 'string') {
    errors.push(`${label} debe ser texto`);
    return undefined;
  }
  const maxLength = MAX_LENGTHS[field];
  if (maxLength && value.length > maxLength) {
    errors.push(`${label} excede el límite de ${maxLength} caracteres`);
  }
  return value;
}

export function validateReportPayload(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, errors: ['El cuerpo de la solicitud debe ser un objeto JSON'] };
  }

  const data = body as Record<string, unknown>;

  for (const key of Object.keys(data)) {
    if (!ALLOWED_KEYS.has(key)) {
      errors.push(`Campo no permitido: ${key}`);
    }
  }

  // problem_type — required
  if (!data.problem_type || typeof data.problem_type !== 'string') {
    errors.push('Tipo de problema es requerido');
  } else if (!VALID_PROBLEM_TYPES.includes(data.problem_type)) {
    errors.push(`Tipo de problema inválido: ${data.problem_type}`);
  }

  // article_url — optional but must be a valid noticiencias.com URL if present
  const articleUrl = validateOptionalString(data, 'article_url', 'URL del artículo', errors);
  if (articleUrl !== undefined) {
    try {
      const url = new URL(articleUrl);
      if (!isNoticienciasHost(url.hostname)) {
        errors.push('URL del artículo debe ser de noticiencias.com');
      }
    } catch {
      errors.push('URL del artículo no es válida');
    }
  }

  validateOptionalString(data, 'description', 'Descripción', errors);
  validateOptionalString(data, 'content_snippet', 'Fragmento de contenido', errors);
  validateOptionalString(data, 'tech_browser', 'Navegador', errors);
  validateOptionalString(data, 'tech_os', 'Sistema operativo', errors);

  // evidence_url — optional but must be a valid URL if present
  const evidenceUrl = validateOptionalString(data, 'evidence_url', 'URL de evidencia', errors);
  if (evidenceUrl !== undefined) {
    try {
      new URL(evidenceUrl);
    } catch {
      errors.push('URL de evidencia no es válida');
    }
  }

  // reporter_email — optional but must be a valid email if present
  const reporterEmail = validateOptionalString(
    data,
    'reporter_email',
    'Correo electrónico',
    errors
  );
  if (reporterEmail !== undefined) {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(reporterEmail)) {
      errors.push('Correo electrónico no es válido');
    }
  }

  return { valid: errors.length === 0, errors };
}
