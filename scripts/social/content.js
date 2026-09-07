import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';

/**
 * Deterministic, per-network social copy for the social publisher
 * (plan social-distribution §10 / §12).
 *
 * Three pure functions — no network, no environment, no clock, no randomness,
 * no persistence:
 *
 * - `normalizeText(value)` — NFC, collapse internal whitespace to single
 *   spaces, drop control characters. Accents, punctuation, editorial emoji and
 *   composed grapheme clusters (skin tone, ZWJ families, flags, combining
 *   marks) are preserved. The blank lines between template blocks are inserted
 *   here at assembly time, never carried in the input.
 * - `truncate(text, { fits, ellipsis })` — cut on grapheme-cluster boundaries
 *   only, reserving the ellipsis for an actual cut, choosing the longest prefix
 *   the caller's `fits` predicate still accepts.
 * - `makeSocialPost(article, destination)` — freeze an already-verified
 *   `Article` plus an explicit `{ platform, account_key }` destination into a
 *   `SocialPost` (§12) with a stable, versioned `payload_hash`.
 *
 * The `article` is assumed already validated and publicly verified upstream:
 * `article.js` is the authority for the manifest contract and the rendered
 * page. The canonical re-check here is a defensive contract guard between
 * functions (plan §20), deliberately a small local check rather than a shared
 * helper — this module's only dependencies are `crypto` / `Intl` / `URL`
 * (plan §12), so it must not import `article.js` (which pulls in `cheerio`).
 */

/**
 * Rendering-rules version stamped into every `SocialPost` and folded into its
 * `payload_hash` (plan §12). The ledger stores `generator_version` per platform
 * attempt (plan §15 state model, line 455), so a bump only changes the hash of
 * payloads generated *afterwards*: attempts already sent, pending, ambiguous or
 * confirmed keep their original `generator_version` and their original bytes and
 * are reconciled against those bytes, never regenerated (plan §15 / §535 "no
 * reemplazar frozen_payload").
 */
export const GENERATOR_VERSION = 1;

/**
 * The four MVP destinations, in the plan's fixed order. Must stay in sync with
 * `PLATFORM_ORDER` in `article.js`; a test asserts the two agree rather than
 * this module importing the other.
 */
export const PLATFORMS = Object.freeze(['facebook', 'x', 'linkedin', 'bluesky']);

/** A structured failure from this module. `code` is stable; `message` is not copy. */
export class SocialContentError extends Error {
  /**
   * @param {'INVALID_ARTICLE'|'INVALID_DESTINATION'|'INVALID_PLATFORM'|'INVALID_CANONICAL'|'INVALID_TEXT'} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = 'SocialContentError';
    this.code = code;
  }
}

// --- constants ------------------------------------------------------------

const ALLOWED_HOST = 'noticiencias.com';
/** Blank line the template puts between fields. Two code points. */
const BLOCK = '\n\n';
/** U+2026 HORIZONTAL ELLIPSIS — one code point, one grapheme. */
const ELLIPSIS = '…';
/** The linked label Bluesky posts carry in place of a bare URL (plan §10). */
const BLUESKY_LABEL = 'noticiencias.com';

// Field / text budgets from plan §10. UTF-16-unit budgets are measured with
// `String.prototype.length` on purpose — that is the unit Buffer documents for
// Facebook/LinkedIn field limits, and counting UTF-16 units is the conservative
// direction against a maximum. It is NEVER used as a grapheme count.
const FACEBOOK = Object.freeze({ titleMax: 200, descMax: 400, totalMax: 5000 });
const LINKEDIN = Object.freeze({ titleMax: 200, descMax: 400, totalMax: 3000 });

// X: a deliberate conservative upper bound, not an exact re-implementation of
// twitter-text (plan §10). 2 weight units per Unicode code point of the
// non-URL part (title + the two block newlines), plus a flat 23 for the single
// canonical the template appends.
const X_MAX_WEIGHT = 280;
const X_URL_WEIGHT = 23;
const X_UNITS_PER_CODEPOINT = 2;

// Bluesky record text: simultaneous grapheme and UTF-8 byte ceilings from the
// Lexicon (plan §10 / §14).
const BLUESKY_MAX_GRAPHEMES = 300;
const BLUESKY_MAX_BYTES = 3000;
// Internal presentation clamps for the external card (plan §14) — not
// protocol limits, independent of the post-text truncation above.
const BLUESKY_CARD_TITLE_GRAPHEMES = 200;
const BLUESKY_CARD_DESC_GRAPHEMES = 400;

// --- grapheme / measurement helpers -------------------------------------

let _segmenter;
function segmenter() {
  _segmenter ??= new Intl.Segmenter('es', { granularity: 'grapheme' });
  return _segmenter;
}

/** Grapheme-cluster array via `Intl.Segmenter` — never `String#length` (plan §25). */
function toGraphemes(value) {
  const out = [];
  for (const { segment } of segmenter().segment(String(value))) out.push(segment);
  return out;
}

/** Number of grapheme clusters. */
function graphemeCount(value) {
  let n = 0;
  for (const _ of segmenter().segment(String(value))) n += 1;
  return n;
}

/** Number of Unicode code points (not UTF-16 units) — the base unit of the X estimate. */
function codePointCount(value) {
  let n = 0;
  for (const _ of String(value)) n += 1;
  return n;
}

/** UTF-8 byte length. */
function utf8Bytes(value) {
  return Buffer.byteLength(String(value), 'utf8');
}

// --- normalizeText ------------------------------------------------------

/**
 * Normalize a raw title/description for social copy (plan §10):
 * NFC, control characters removed, internal whitespace collapsed to single
 * spaces, ends trimmed.
 *
 * Whitespace control characters (tab, newline, carriage return, vertical tab,
 * form feed) become a space so adjacent words never fuse; every other control
 * character (`\p{Cc}`) is dropped. Text like `$()`, `::error::`, quotes,
 * ampersands and backslashes is data and survives unchanged.
 *
 * Format characters (`\p{Cf}`) are kept in general — U+200D ZERO WIDTH JOINER
 * and U+200C ZERO WIDTH NON-JOINER carry emoji families and flag sequences and
 * must survive. The one exception is the bidirectional embedding / override /
 * isolate controls, exactly these nine code points:
 *
 *   U+202A LRE  U+202B RLE  U+202C PDF  U+202D LRO  U+202E RLO
 *   U+2066 LRI  U+2067 RLI  U+2068 FSI  U+2069 PDI
 *
 * They reorder every character rendered after them, so a headline carrying one
 * would display scrambled on the network. Those are removed; the visible
 * characters stay. The plain directional marks U+200E LRM, U+200F RLM and
 * U+061C ALM are deliberately NOT stripped — they are invisible hints that
 * reorder nothing, so they are harmless in single-direction Spanish copy and
 * removing them would exceed the "don't corrupt display" rationale (plan §10).
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeText(value) {
  const nfc = String(value ?? '').normalize('NFC');
  const withoutBidi = nfc.replace(/[\u202A-\u202E\u2066-\u2069]/gu, '');
  const withoutControls = withoutBidi.replace(/\p{Cc}/gu, (ch) => (/\s/u.test(ch) ? ' ' : ''));
  return withoutControls.replace(/\s+/gu, ' ').trim();
}

// --- truncate ----------------------------------------------------------

/**
 * Cut `text` on grapheme-cluster boundaries so the result satisfies `fits`.
 *
 * `fits(candidate) => boolean` reports whether a candidate field value fits the
 * caller's final, fully-assembled budget for that field. It MUST be monotone
 * non-decreasing over grapheme prefixes — adding a grapheme never turns a
 * rejected prefix into an accepted one. That holds for every measure used in
 * this module (UTF-16 length, literal length, code-point weight, grapheme
 * count, UTF-8 bytes), so the scan stops at the first prefix `fits` rejects.
 *
 * The ellipsis is appended only when a cut actually happens, is included in
 * what `fits` sees, and trailing whitespace is trimmed before it. The result
 * is never a split grapheme, surrogate half, or broken ZWJ sequence.
 *
 * `text` is expected already `normalizeText`-ed; the function does not require
 * it.
 *
 * @param {string} text
 * @param {{ fits: (candidate: string) => boolean, ellipsis?: string }} options
 * @returns {{ text: string, truncated: boolean }}
 */
export function truncate(text, { fits, ellipsis = ELLIPSIS } = {}) {
  if (typeof fits !== 'function') {
    throw new TypeError('truncate: options.fits must be a function');
  }
  const source = String(text ?? '');
  if (fits(source)) return { text: source, truncated: false };

  let best = '';
  let haveBest = false;
  let acc = '';
  for (const grapheme of toGraphemes(source)) {
    acc += grapheme;
    const candidate = acc.replace(/\s+$/u, '') + ellipsis;
    if (!fits(candidate)) break;
    best = candidate;
    haveBest = true;
  }
  return { text: haveBest ? best : '', truncated: true };
}

// --- makeSocialPost ----------------------------------------------------

/**
 * @typedef {object} LinkCard
 * @property {string} uri canonical URL the card / facet points at
 * @property {string} [title] card title (Bluesky only)
 * @property {string} [description] card description, `''` when the article has none (Bluesky only)
 * @property {string} [label] the linked label inside the post text (Bluesky only)
 * @property {number} [label_byte_start] UTF-8 byte offset of `label` in `text` (Bluesky only)
 * @property {number} [label_byte_end] UTF-8 byte offset one past `label` in `text` (Bluesky only)
 * @property {string|null} [thumb_url] optional public thumbnail; the adapter enforces the size cap (Bluesky only)
 */

/**
 * @typedef {object} SocialPost
 * @property {string} platform one of {@link PLATFORMS}
 * @property {string} account_key opaque destination account identifier
 * @property {string} text the frozen, ready-to-send copy
 * @property {string} canonical_url
 * @property {LinkCard|null} link_card
 * @property {1} generator_version
 * @property {string} payload_hash see {@link hashPayload}
 */

/**
 * Freeze an article + an explicit destination into a `SocialPost` (plan §12).
 *
 * @param {{ title: string, description?: string|null, canonical_url: string, image_url?: string|null }} article
 * @param {{ platform: string, account_key: string }} destination
 * @returns {SocialPost}
 */
export function makeSocialPost(article, destination) {
  if (!article || typeof article !== 'object') {
    throw new SocialContentError('INVALID_ARTICLE', 'article must be an object');
  }
  if (!destination || typeof destination !== 'object') {
    throw new SocialContentError('INVALID_DESTINATION', 'destination must be an object');
  }

  const platform = destination.platform;
  if (!PLATFORMS.includes(platform)) {
    throw new SocialContentError(
      'INVALID_PLATFORM',
      `unknown platform ${JSON.stringify(platform)}`
    );
  }
  const accountKey = destination.account_key;
  if (typeof accountKey !== 'string' || accountKey.trim() === '') {
    throw new SocialContentError(
      'INVALID_DESTINATION',
      'destination.account_key must be a non-empty string'
    );
  }

  const canonicalUrl = String(article.canonical_url ?? '');
  assertCanonical(canonicalUrl, platform);

  const title = normalizeText(article.title);
  if (title === '') {
    throw new SocialContentError('INVALID_TEXT', 'article.title is empty after normalization');
  }
  const description = article.description == null ? '' : normalizeText(article.description);

  let built;
  if (platform === 'facebook') {
    built = buildLinkPost({
      title,
      description,
      canonicalUrl,
      network: 'facebook',
      budget: FACEBOOK,
    });
  } else if (platform === 'linkedin') {
    built = buildLinkPost({
      title,
      description,
      canonicalUrl,
      network: 'linkedin',
      budget: LINKEDIN,
    });
  } else if (platform === 'x') {
    built = buildX({ title, canonicalUrl });
  } else {
    built = buildBluesky({
      title,
      description,
      canonicalUrl,
      imageUrl: article.image_url ?? null,
    });
  }

  const post = {
    platform,
    account_key: accountKey,
    text: built.text,
    canonical_url: canonicalUrl,
    link_card: built.link_card ?? null,
    generator_version: GENERATOR_VERSION,
  };
  post.payload_hash = hashPayload(post);
  return post;
}

// --- canonical guard ---------------------------------------------------

/**
 * Defensive re-check of the canonical contract `article.js` already enforced at
 * the manifest boundary: a bare `https://noticiencias.com/…` URL with no
 * userinfo, query or fragment. X additionally requires it to be ASCII, because
 * the flat 23-unit weight assumes a plain URL with no percent-encoding /
 * internationalized host; the other networks count the URL literally, so that
 * extra rule is scoped to X only (plan §10).
 *
 * @param {string} value
 * @param {string} platform
 */
function assertCanonical(value, platform) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new SocialContentError('INVALID_CANONICAL', 'canonical_url is not a valid URL');
  }
  if (
    url.protocol !== 'https:' ||
    url.host !== ALLOWED_HOST ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new SocialContentError(
      'INVALID_CANONICAL',
      `canonical_url must be a bare https://${ALLOWED_HOST}/… URL`
    );
  }
  // eslint-disable-next-line no-control-regex -- intentional ASCII-only guard
  if (platform === 'x' && !/^[\x00-\x7f]*$/.test(value)) {
    throw new SocialContentError('INVALID_CANONICAL', 'canonical_url must be ASCII for X');
  }
}

// --- per-network builders --------------------------------------------

/**
 * Strip a trailing ellipsis and surrounding whitespace; throw `INVALID_TEXT`
 * when a mandatory field has no useful content left (plan §10 "no crear post
 * vacío").
 */
function requireUseful(result, field) {
  const bare = result.text.endsWith(ELLIPSIS)
    ? result.text.slice(0, -ELLIPSIS.length)
    : result.text;
  if (bare.trim() === '') {
    throw new SocialContentError('INVALID_TEXT', `${field} does not fit the platform budget`);
  }
  return result.text;
}

/** Non-empty content once a trailing ellipsis is removed. */
function hasUsefulContent(text) {
  const bare = text.endsWith(ELLIPSIS) ? text.slice(0, -ELLIPSIS.length) : text;
  return bare.trim() !== '';
}

/**
 * Facebook / LinkedIn: title + block + optional description + block + canonical.
 * Both count field limits in UTF-16 units; the overall ceiling is treated as a
 * literal-character count (also UTF-16 units — the conservative reading of
 * "caracteres literales", plan §10). URLs are never shortened in the payload.
 */
function buildLinkPost({ title, description, canonicalUrl, network, budget }) {
  // The title is bounded by its own field limit AND by what the overall budget
  // leaves once the canonical (+ its block) is appended, so a very long
  // canonical shortens the title instead of tripping the total-budget throw
  // below when a shorter title would still fit (plan §10 — error only when not
  // one useful grapheme plus the link fits). Both terms are non-decreasing over
  // grapheme prefixes, so `truncate`'s first-rejection scan stays valid.
  const t = requireUseful(
    truncate(title, {
      fits: (c) =>
        c.length <= budget.titleMax && [c, canonicalUrl].join(BLOCK).length <= budget.totalMax,
    }),
    'title'
  );

  let text = [t, canonicalUrl].join(BLOCK);

  if (description !== '') {
    const d = truncate(description, {
      fits: (c) =>
        c.length <= budget.descMax && [t, c, canonicalUrl].join(BLOCK).length <= budget.totalMax,
    }).text;
    if (hasUsefulContent(d)) text = [t, d, canonicalUrl].join(BLOCK);
  }

  if (text.length > budget.totalMax) {
    throw new SocialContentError(
      'INVALID_TEXT',
      `assembled ${network} post exceeds its ${budget.totalMax}-unit budget`
    );
  }

  return { text, link_card: { uri: canonicalUrl } };
}

/**
 * X: title + block + canonical, no description. Conservative weight estimate
 * (plan §10) — a URL that appears *inside* the title is over-counted as text
 * (2 per code point) rather than as a 23-unit link, which is the safe direction.
 */
function buildX({ title, canonicalUrl }) {
  const blockWeight = X_UNITS_PER_CODEPOINT * codePointCount(BLOCK);
  const fits = (c) =>
    X_UNITS_PER_CODEPOINT * codePointCount(c) + blockWeight + X_URL_WEIGHT <= X_MAX_WEIGHT;

  const t = requireUseful(truncate(title, { fits }), 'title');
  return { text: [t, canonicalUrl].join(BLOCK), link_card: null };
}

/**
 * Bluesky: title + block + linked `noticiencias.com` label. The canonical lives
 * in the external card and the richtext link facet, not in the visible text.
 * The record text obeys the grapheme and UTF-8 byte ceilings simultaneously.
 */
function buildBluesky({ title, description, canonicalUrl, imageUrl }) {
  const suffix = BLOCK + BLUESKY_LABEL;
  const fits = (c) => {
    const full = c + suffix;
    return graphemeCount(full) <= BLUESKY_MAX_GRAPHEMES && utf8Bytes(full) <= BLUESKY_MAX_BYTES;
  };

  const t = requireUseful(truncate(title, { fits }), 'title');
  const text = t + suffix;

  // UTF-8 byte offsets of the label inside `text`, so the adapter can build the
  // richtext link facet (plan §14) without regenerating the text. Byte indices,
  // not JS string indices or grapheme counts.
  const labelByteStart = utf8Bytes(t + BLOCK);
  const labelByteEnd = labelByteStart + utf8Bytes(BLUESKY_LABEL);

  return {
    text,
    link_card: {
      uri: canonicalUrl,
      title: clampGraphemes(title, BLUESKY_CARD_TITLE_GRAPHEMES),
      description:
        description === '' ? '' : clampGraphemes(description, BLUESKY_CARD_DESC_GRAPHEMES),
      label: BLUESKY_LABEL,
      label_byte_start: labelByteStart,
      label_byte_end: labelByteEnd,
      thumb_url: imageUrl ?? null,
    },
  };
}

/** Clamp to `max` grapheme clusters, appending an ellipsis when it shortens. */
function clampGraphemes(value, max) {
  const graphemes = toGraphemes(value);
  if (graphemes.length <= max) return value;
  return (
    graphemes
      .slice(0, Math.max(0, max - 1))
      .join('')
      .replace(/\s+$/u, '') + ELLIPSIS
  );
}

// --- payload hash ----------------------------------------------------

/**
 * Stable SHA-256 of the rendered payload (plan §12 `payload_hash`).
 *
 * Preimage: the ASCII prefix `noticiencias.com/social/post/v1\n` (the `\n` is a
 * real newline byte) followed by a canonical JSON serialization — object keys
 * sorted lexicographically, no insignificant whitespace, standard
 * `JSON.stringify` string escaping — of exactly:
 *
 *   { account_key, canonical_url, generator_version, link_card, platform, text }
 *
 * where `link_card` is the post's normalized card object (or `null`), sorted by
 * the same rule.
 *
 * Included: the destination (`platform` + `account_key`) and every piece of
 * rendered content — the exact `text`, the `canonical_url`, and for Bluesky the
 * card fields and the facet byte offsets. Excluded on purpose: `social_id` and
 * `collection_id` (identity is the ledger's key, not part of the rendered
 * copy), and anything operational or time-varying — `createdAt`, TID / `rkey`,
 * provider post IDs, uploaded blob references.
 *
 * This hash identifies "the copy we froze". It is deliberately NOT the hash of
 * the provider's stored record (plan §14), which also covers `createdAt`,
 * `rkey`, facets and embed.
 *
 * Bumping `generator_version` changes the hash of payloads generated *after* the
 * bump. It does NOT retroactively re-render or invalidate payloads already
 * frozen for sent, pending, ambiguous or confirmed attempts — those retain their
 * original `generator_version` and bytes and are reconciled against them (plan
 * §15). The same holds for any `Intl.Segmenter` boundary shift from a future ICU
 * upgrade: the frozen bytes are the record.
 *
 * @param {Omit<SocialPost, 'payload_hash'>} post
 * @returns {string} lowercase hex SHA-256
 */
function hashPayload(post) {
  const preimage =
    'noticiencias.com/social/post/v1\n' +
    stableStringify({
      account_key: post.account_key,
      canonical_url: post.canonical_url,
      generator_version: post.generator_version,
      link_card: post.link_card,
      platform: post.platform,
      text: post.text,
    });
  return createHash('sha256').update(Buffer.from(preimage, 'utf8')).digest('hex');
}

/** Deterministic JSON: objects emitted with keys sorted lexicographically. */
function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}
