import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { postStructuralSchema } from './schemas/post';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),

  schema: postStructuralSchema.superRefine((data, ctx) => {
    // --- P2-07: corrections travel together ---
    if (!!data.corrected_at !== !!data.correction_summary) {
      ctx.addIssue({
        code: 'custom',
        path: !data.corrected_at ? ['corrected_at'] : ['correction_summary'],
        message: 'corrected_at and correction_summary must be set together',
      });
    }

    // --- sources cross-field validation (P0-01) ---
    // A doi without role=primary is a meaningless state: the DOI only
    // renders in the primary block, so reject it instead of silently
    // dropping data at render time.
    (data.sources ?? []).forEach((source, index) => {
      if (source.doi && source.role !== 'primary') {
        ctx.addIssue({
          code: 'custom',
          path: ['sources', index, 'role'],
          message: 'sources with doi must declare role: primary',
        });
      }
    });
    // --- image_alt cross-field validation ---
    const objectAlt = typeof data.image === 'object' ? data.image.alt?.trim() : '';
    const frontmatterAlt = data.image_alt?.trim() ?? '';
    if (!objectAlt && !frontmatterAlt) {
      ctx.addIssue({
        code: 'custom',
        path: ['image_alt'],
        message: 'image_alt is required when image does not include inline alt text',
      });
    }

    // --- featured_rank cross-field validation ---
    if (data.featured === true && !data.featured_rank) {
      ctx.addIssue({
        code: 'custom',
        path: ['featured_rank'],
        message: 'featured_rank is required when featured is true',
      });
    }

    // --- social.id cross-field validation ---
    // A post authorised for distribution (social.publish === true) must carry
    // a non-empty social.id. Mirrors `_id_required_when_publishing` in the
    // backend contract.
    if (data.social?.publish === true && !data.social.id?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['social', 'id'],
        message: 'social.id is required and non-empty when social.publish is true',
      });
    }

    // --- Editorial enrichment enforcement (schema_version >= 2) ---
    // Progressive contract: v1 posts are grandfathered; v2+ require structured editorial fields.
    // Enforcement is unconditional (Plan 060 / Phase 2b): the full corpus has zero strict
    // editorial-field errors, so this branch always runs — there is no permissive/off state.
    //
    // P0-06 / DEC-003: `why_it_matters` ("Qué cambia") allows 0-3 items.
    // There is no minimum: omitting an implication beats fabricating one.
    // Cardinality is enforced at field level (`.max(3)`); absence is valid.
    if (data.schema_version && data.schema_version >= 2) {
      // summary_points: 2-5 non-empty strings
      if (!data.summary_points || data.summary_points.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['summary_points'],
          message: 'summary_points is required for schema_version >= 2 (2-5 items)',
        });
      } else if (data.summary_points.length < 2 || data.summary_points.length > 5) {
        ctx.addIssue({
          code: 'custom',
          path: ['summary_points'],
          message: `summary_points must have 2-5 items (got ${data.summary_points.length})`,
        });
      }

      // glossary: at least 1 {term, definition}
      if (!data.glossary || data.glossary.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['glossary'],
          message: 'glossary is required for schema_version >= 2 (≥1 item)',
        });
      }

      // fact_check: at least 1 {label, status}
      if (!data.fact_check || data.fact_check.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['fact_check'],
          message: 'fact_check is required for schema_version >= 2 (≥1 item)',
        });
      }

      // why_it_matters: 0-3 items, no minimum (P0-06 / DEC-003).
      // Absence is valid; cardinality and non-empty items are enforced
      // at field level above, so no superRefine branch is needed here.

      // confidence: required string
      if (!data.confidence) {
        ctx.addIssue({
          code: 'custom',
          path: ['confidence'],
          message: 'confidence is required for schema_version >= 2',
        });
      }

      // sources: at least 1 {title, url}
      if (!data.sources || data.sources.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['sources'],
          message: 'sources is required for schema_version >= 2 (≥1 item)',
        });
      }
    }
  }),
});

export const collections = { posts };
