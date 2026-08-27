/**
 * Minimal RFC 9110 §12.5.1 `Accept` header negotiation — media type +
 * q-value only (no accept-params/extensions, not needed here). Used to
 * decide whether a request explicitly prefers `text/markdown` over
 * `text/html`, per docs/adr/0008-markdown-for-agents.md constraint #1:
 * no substring check, and a bare wildcard (`*` over `*`) or an ordinary browser Accept
 * header must resolve to HTML.
 */

interface AcceptEntry {
  type: string;
  subtype: string;
  q: number;
}

function parseAccept(header: string | null): AcceptEntry[] {
  if (!header) return [];

  const entries: AcceptEntry[] = [];
  for (const rawPart of header.split(',')) {
    const part = rawPart.trim();
    if (!part) continue;

    const [mediaRange, ...params] = part.split(';').map((s) => s.trim());
    const [rawType, rawSubtype] = mediaRange.split('/');
    if (!rawType || !rawSubtype) continue;

    let q = 1;
    for (const param of params) {
      const [key, value] = param.split('=').map((s) => s.trim());
      if (key === 'q') {
        const parsed = Number.parseFloat(value);
        q = Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 1;
      }
    }

    if (q > 0) {
      entries.push({ type: rawType.toLowerCase(), subtype: rawSubtype.toLowerCase(), q });
    }
  }
  return entries;
}

/** -1 = no match, 0 = matched via `*\/*`, 1 = matched via `type/*`, 2 = exact match. */
type Specificity = -1 | 0 | 1 | 2;

function matchQuality(
  entries: AcceptEntry[],
  type: string,
  subtype: string
): { q: number; specificity: Specificity } {
  let best: { q: number; specificity: Specificity } = { q: 0, specificity: -1 };

  for (const entry of entries) {
    let specificity: Specificity = -1;
    if (entry.type === type && entry.subtype === subtype) specificity = 2;
    else if (entry.type === type && entry.subtype === '*') specificity = 1;
    else if (entry.type === '*' && entry.subtype === '*') specificity = 0;

    if (specificity === -1) continue;
    if (specificity > best.specificity || (specificity === best.specificity && entry.q > best.q)) {
      best = { q: entry.q, specificity };
    }
  }

  return best;
}

/**
 * True only when the request explicitly prefers `text/markdown` (via an
 * exact `text/markdown` or `text/*` entry, weighted at least as high as
 * the best match for `text/html`). A bare wildcard (`*` over `*`) never counts as explicit
 * preference — it falls through to HTML, matching ordinary browsers and
 * generic HTTP clients that send no real Accept header.
 */
export function prefersMarkdown(acceptHeader: string | null): boolean {
  const entries = parseAccept(acceptHeader);
  if (entries.length === 0) return false;

  const markdown = matchQuality(entries, 'text', 'markdown');
  if (markdown.specificity < 1) return false;

  const html = matchQuality(entries, 'text', 'html');
  return markdown.q >= html.q;
}
