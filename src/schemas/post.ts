import { z } from 'astro/zod';

// Social distribution identity (plan social-distribution §8/§9): a 64-char
// lowercase hex SHA-256 digest. Mirrors `SOCIAL_ID_PATTERN` in the backend
// contract (`news_collector/contracts/frontend_schema.py`). Kept at module
// scope so the `social` field body stays free of `//` comments, which the
// line-based parser in scripts/check-contract-sync.js cannot skip.
//
// The `social` object itself: absent by default; `.optional()` admits only
// `undefined`, so an explicit `social: null` is rejected, and `.strict()`
// rejects unknown keys — both mirror the backend `SocialConfig` model.
const SOCIAL_ID_RE = /^[0-9a-f]{64}$/;

// Wave 2 editorial contract notes (kept at module scope: the line-based
// parser in scripts/check-contract-sync.js cannot skip `//` comments inside
// the z.object body, so schema comments must live outside it).
//
// P0-01: sources[] items accept optional `role` (primary/secondary) + `doi`.
// Absent role = legacy entry, rendered as secondary. Never invented: entries
// without verified primary data simply omit role/doi.
//
// P0-02: `evidence_subject_type` is optional; absent = legacy (rendered as
// "no clasificado", never inferred). Salud posts with a non-clinical or
// unknown type get a strong guardrail at render (TrustPanel).
//
// P0-06 / DEC-003: `why_it_matters` ("Qué cambia") allows 0-3 items with no
// minimum; cardinality is enforced at field level below.

// Wave 3 editorial contract notes (same module-scope rule as above).
//
// P0-03: `institution` + `publication_status` feed the evidence record;
// absent = omit, never placeholder.
//
// P0-09: `reviewer_*` identify a real human review; never invented. Without
// reviewer data the render falls back to the institutional line.
//
// P2-02: `known_points` / `open_questions` (0-3 each, omissible) render the
// "Qué sabemos / Qué no sabemos" block only when present.
//
// P2-07: `corrected_at` + `correction_summary` travel together; a
// half-correction (one without the other) is rejected below.

// Frontmatter link fields accept http(s) URLs only. The refinement lives
// inline as `.refine(...)` on `z.url()` so the line-based parser in
// scripts/check-contract-sync.js still sees the `z.url()` base type;
// no `//` comments inside the `z.object` body (same rule as above).

export const postStructuralSchema = z.object({
  title: z.string().min(5, 'Title too short'),
  schema_version: z.number().int().min(1).default(1),
  excerpt: z.string().min(10, 'Excerpt too short'),
  author: z.string().default('Noticiencias'),
  date: z.date(),
  categories: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),

  image: z.union([
    z.string(),
    z.object({
      src: z.string(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      alt: z.string().optional(),
    }),
  ]),
  image_alt: z.string().optional(),
  permalink: z.string().optional(),

  source_url: z.url().optional(),
  refinery_id: z.string().optional(),
  headlines_variants: z
    .object({
      question: z.string().optional(),
      benefit: z.string().optional(),
    })
    .optional(),

  translation_method: z.string().optional(),
  editorial_score: z.number().optional(),
  review_status: z.string().optional(),
  confidence: z.string().optional(),
  investigation: z.boolean().default(false),
  requires_uncertainty_note: z.boolean().default(false),
  featured: z.boolean().default(false),
  featured_rank: z.number().int().positive().optional(),
  summary_points: z.array(z.string().min(1)).min(2).max(5).optional(),
  uncertainty_note: z.string().optional(),
  glossary: z
    .array(
      z.object({
        term: z.string().min(1),
        definition: z.string().min(1),
      })
    )
    .optional(),

  fact_check: z
    .array(
      z.object({
        label: z.string(),
        status: z.string(),
      })
    )
    .optional(),

  evidence_subject_type: z
    .enum([
      'humans',
      'animals',
      'in_vitro',
      'computational',
      'observational',
      'experimental',
      'mixed',
      'unknown',
    ])
    .optional(),
  evidence_detail: z.string().min(1).max(280).optional(),

  why_it_matters: z.array(z.string().min(1)).max(3).optional(),
  series: z.string().optional(),

  sources: z
    .array(
      z.object({
        title: z.string().min(1),
        url: z
          .url()
          .refine(
            (v) => v.toLowerCase().startsWith('http://') || v.toLowerCase().startsWith('https://'),
            'URL must use http or https'
          ),
        publisher: z.string().optional(),
        date: z.string().optional(),
        role: z.enum(['primary', 'secondary']).optional(),
        doi: z
          .string()
          .regex(/^10\.\d{4,}\/.+/, 'doi must look like 10.xxxx/...')
          .optional(),
      })
    )
    .optional(),

  social: z
    .object({
      publish: z.boolean().default(false),
      id: z.string().regex(SOCIAL_ID_RE, 'social.id must be 64 lowercase hex chars').optional(),
    })
    .strict()
    .optional(),

  institution: z.string().min(1).max(160).optional(),
  publication_status: z.enum(['peer_reviewed', 'preprint', 'conference', 'other']).optional(),
  reviewer_name: z.string().min(1).max(120).optional(),
  reviewer_role: z.string().min(1).max(120).optional(),
  reviewer_profile_url: z
    .url()
    .refine(
      (v) => v.toLowerCase().startsWith('http://') || v.toLowerCase().startsWith('https://'),
      'URL must use http or https'
    )
    .optional(),
  review_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'review_date must be YYYY-MM-DD')
    .optional(),
  known_points: z.array(z.string().min(1)).max(3).optional(),
  open_questions: z.array(z.string().min(1)).max(3).optional(),
  corrected_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'corrected_at must be YYYY-MM-DD')
    .optional(),
  correction_summary: z.string().min(1).max(500).optional(),
});
