import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import { getPermalink, getCanonical } from '~/utils/permalinks';
import { resolvePostPermalink } from '~/utils/blog';

/**
 * Public build manifest for social distribution (plan social-distribution
 * §7/§8). A static JSON snapshot of exactly what article routes this build
 * publishes, each with its normalized `social` config, plus build
 * provenance.
 *
 * Not linked from the site and kept out of the sitemap: `@astrojs/sitemap`
 * does emit `.json` endpoints (see the `/search.json` entry in the
 * astro.config.mjs sitemap filter), so this route is excluded there by an
 * explicit `/social-manifest.json` filter. `dist-sanity.js` asserts it
 * stays out. This is an operational artifact, not a second canonical URL.
 *
 * `provenance` identifies the *build* that produced this manifest — the
 * repository, commit, and Actions run/attempt. It is NOT proof that a
 * deploy finished successfully; the consumer (package 3) re-verifies the
 * run against the Actions REST API before trusting it. Outside the
 * `Deploy to GitHub Pages` workflow (local builds, PR CI, other workflows)
 * it is `null` — we never fabricate deploy proof.
 */

const SCHEMA_VERSION = 1 as const;

const SHA_RE = /^[0-9a-f]{40}$/;
const DECIMAL_RE = /^[0-9]+$/;
const REPO_RE = /^[^/\s]+\/[^/\s]+$/;
const DEPLOY_WORKFLOW_NAME = 'Deploy to GitHub Pages';
const ALLOWED_CANONICAL_HOST = 'noticiencias.com';

export interface SocialManifestProvenance {
  repository: string;
  commit: string;
  run_id: string;
  build_attempt: number;
  workflow: string;
}

export interface SocialManifestArticle {
  collection_id: string;
  date: string;
  title: string;
  description?: string;
  canonical_url: string;
  social: { publish: boolean; id?: string };
}

export interface SocialManifest {
  schema_version: typeof SCHEMA_VERSION;
  provenance: SocialManifestProvenance | null;
  articles: SocialManifestArticle[];
}

type ManifestEnv = Record<string, string | undefined>;

/**
 * Build provenance from the GitHub Actions environment. Returns `null`
 * unless the build is running inside the `Deploy to GitHub Pages` workflow
 * with every field present and well-formed.
 */
export function buildProvenance(env: ManifestEnv): SocialManifestProvenance | null {
  if (env.GITHUB_WORKFLOW !== DEPLOY_WORKFLOW_NAME) return null;

  const repository = env.GITHUB_REPOSITORY ?? '';
  const commit = env.GITHUB_SHA ?? '';
  const runId = env.GITHUB_RUN_ID ?? '';
  const attempt = Number.parseInt(env.GITHUB_RUN_ATTEMPT ?? '', 10);

  if (!REPO_RE.test(repository)) return null;
  if (!SHA_RE.test(commit)) return null;
  if (!DECIMAL_RE.test(runId)) return null;
  if (!Number.isInteger(attempt) || attempt < 1) return null;

  return {
    repository,
    commit,
    run_id: runId,
    build_attempt: attempt,
    workflow: DEPLOY_WORKFLOW_NAME,
  };
}

/** Normalize `entry.data.social` to the manifest shape. Absence disables distribution. */
function normalizeSocial(
  social: CollectionEntry<'posts'>['data']['social']
): SocialManifestArticle['social'] {
  if (!social) return { publish: false };
  return social.id ? { publish: social.publish, id: social.id } : { publish: social.publish };
}

function assertValidCanonical(url: string, collectionId: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      `social-manifest: article "${collectionId}" has an unparseable canonical URL: "${url}".`
    );
  }
  if (parsed.protocol !== 'https:' || parsed.host !== ALLOWED_CANONICAL_HOST) {
    throw new Error(
      `social-manifest: article "${collectionId}" has an off-domain canonical URL: "${url}". ` +
        `Expected https://${ALLOWED_CANONICAL_HOST}/…`
    );
  }
  // A canonical for social distribution is a bare https URL on the domain:
  // no userinfo, no query string, no fragment (plan §11 / §20.3). A prefix
  // check would let all three through.
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(
      `social-manifest: article "${collectionId}" has a canonical URL with credentials, a ` +
        `query string or a fragment: "${url}". Expected a bare https://${ALLOWED_CANONICAL_HOST}/… URL.`
    );
  }
}

/**
 * Assemble the manifest from raw collection entries. Fails closed (throws,
 * aborting the build) on a duplicate `social.id` — even between disabled
 * articles — or a duplicate/invalid canonical URL. Two articles from the
 * same source can derive the same id; the manifest surfaces that conflict
 * rather than inventing a replacement id.
 */
export async function buildSocialManifest(
  entries: CollectionEntry<'posts'>[],
  env: ManifestEnv
): Promise<SocialManifest> {
  const articles: SocialManifestArticle[] = await Promise.all(
    entries.map(async (entry) => {
      const permalink = await resolvePostPermalink(entry);
      const canonicalUrl = String(getCanonical(getPermalink(permalink, 'post')));
      assertValidCanonical(canonicalUrl, entry.id);

      const article: SocialManifestArticle = {
        collection_id: entry.id,
        date: new Date(entry.data.date).toISOString(),
        title: entry.data.title,
        canonical_url: canonicalUrl,
        social: normalizeSocial(entry.data.social),
      };
      if (entry.data.excerpt) article.description = entry.data.excerpt;
      return article;
    })
  );

  const idOwners = new Map<string, string>();
  const canonicalOwners = new Map<string, string>();
  for (const article of articles) {
    const id = article.social.id;
    if (id) {
      const existing = idOwners.get(id);
      if (existing) {
        throw new Error(
          `social-manifest: duplicate social.id "${id}" shared by "${existing}" and ` +
            `"${article.collection_id}". Each article needs a distinct identity.`
        );
      }
      idOwners.set(id, article.collection_id);
    }

    const existingCanonical = canonicalOwners.get(article.canonical_url);
    if (existingCanonical) {
      throw new Error(
        `social-manifest: duplicate canonical URL "${article.canonical_url}" shared by ` +
          `"${existingCanonical}" and "${article.collection_id}".`
      );
    }
    canonicalOwners.set(article.canonical_url, article.collection_id);
  }

  // Deterministic order: by social identity when present, then by
  // collection id (unique) as the tiebreaker.
  articles.sort((a, b) => {
    const keyA = a.social.id ?? '';
    const keyB = b.social.id ?? '';
    if (keyA !== keyB) return keyA < keyB ? -1 : 1;
    return a.collection_id < b.collection_id ? -1 : a.collection_id > b.collection_id ? 1 : 0;
  });

  return {
    schema_version: SCHEMA_VERSION,
    provenance: buildProvenance(env),
    articles,
  };
}

export const GET: APIRoute = async () => {
  // Mirror src/pages/[...slug].astro: it builds a page for every collection
  // entry via fetchPosts() with no APP_BLOG route-flag gate, so the manifest
  // must list every entry too. (Plan §8 mentions honouring blog route flags,
  // but the real article route does not check them — task scope wins.)
  const entries = await getCollection('posts');
  const manifest = await buildSocialManifest(entries, process.env);

  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/json' },
  });
};
