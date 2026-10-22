import type { Post } from '~/types';

// Shared human-readable labels for the Wave 2/3 evidence contract fields.
// Single source of truth for TrustPanel (record) and PostLayout (chips):
// a label change happens here, not in two components.

export const evidenceLabels: Record<NonNullable<Post['evidence_subject_type']>, string> = {
  humans: 'personas',
  animals: 'animales',
  in_vitro: 'cultivo celular',
  computational: 'simulación computacional',
  observational: 'estudio observacional',
  experimental: 'experimento de laboratorio',
  mixed: 'fases mixtas (ver detalle)',
  unknown: 'no clasificado',
};

export const publicationLabels: Record<NonNullable<Post['publication_status']>, string> = {
  peer_reviewed: 'revisada por pares',
  preprint: 'preprint (sin revisión por pares)',
  conference: 'ponencia de congreso',
  other: 'otra vía de publicación',
};

// Compact chip forms. `unknown` / `other` carry no information and must be
// omitted by callers (no placeholder chips).
export const publicationChipLabels: Record<NonNullable<Post['publication_status']>, string> = {
  peer_reviewed: 'Revisión por pares',
  preprint: 'Preprint',
  conference: 'Congreso',
  other: 'otra vía',
};

/**
 * Reader-facing verdicts for fact_check items. Unknown or future statuses
 * must never appear as verified merely because they are unrecognized.
 */
export function getFactCheckVerdict(status: string): {
  label: string;
  variant: 'success' | 'warning' | 'error' | 'info';
  icon: string;
} {
  switch (status.trim().toLowerCase()) {
    case 'verified':
    case 'confirmed':
      return { label: 'Respaldado por la fuente', variant: 'success', icon: 'tabler:check' };
    case 'unsupported':
      return {
        label: 'Sin respaldo en las fuentes',
        variant: 'warning',
        icon: 'tabler:alert-triangle',
      };
    case 'debunked':
    case 'contradicted':
      return { label: 'Contradicho por las fuentes', variant: 'error', icon: 'tabler:x' };
    default:
      return { label: 'Sin verificar', variant: 'info', icon: 'tabler:info-circle' };
  }
}
