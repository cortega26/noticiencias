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
