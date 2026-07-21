/**
 * Maps the report form's browser-side field names (camelCase, matching the
 * `name` attributes in ReportForm.astro) to the Worker's snake_case wire
 * contract (workers/src/utils/validate.ts::ReportPayload).
 *
 * The Worker is the validation authority — this module only builds the
 * payload shape it expects; it does not duplicate validation rules.
 */

export const PROBLEM_TYPES = [
  'content_factual',
  'content_source',
  'content_interpretation',
  'content_translation',
  'technical_site',
  'technical_visual',
] as const;

export type ProblemType = (typeof PROBLEM_TYPES)[number];

export interface ReportPayload {
  problem_type: string;
  article_url?: string;
  description?: string;
  content_snippet?: string;
  evidence_url?: string;
  tech_browser?: string;
  tech_os?: string;
}

const FIELD_MAP: Record<string, keyof ReportPayload> = {
  problemType: 'problem_type',
  reportUrl: 'article_url',
  reportDescription: 'description',
  contentSnippet: 'content_snippet',
  contentEvidence: 'evidence_url',
  techBrowser: 'tech_browser',
  techOs: 'tech_os',
};

/**
 * Build a Worker-contract payload from the form's raw FormData entries.
 * Unknown keys are dropped; empty-string values are omitted (optional
 * fields should be absent, not empty strings, per the Worker contract).
 */
export function buildReportPayload(formValues: Record<string, unknown>): ReportPayload {
  const payload: Record<string, string> = {};

  for (const [uiKey, wireKey] of Object.entries(FIELD_MAP)) {
    const value = formValues[uiKey];
    if (typeof value === 'string' && value.trim().length > 0) {
      payload[wireKey] = value;
    }
  }

  return payload as unknown as ReportPayload;
}
