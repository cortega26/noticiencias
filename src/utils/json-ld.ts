/**
 * Script-safe JSON-LD serialization for inline `<script type="application/ld+json">`.
 *
 * `JSON.stringify` alone is NOT safe inside inline scripts because article-
 * controlled strings (titles, excerpts, breadcrumb labels) may contain the
 * closing sequence `</script>`, the HTML-significant characters `<`, `>`, `&`,
 * or Unicode line/paragraph separators that break JavaScript string literals.
 *
 * This helper escapes those five classes into JSON-legal Unicode escapes
 * WITHOUT corrupting the JSON structure — the output remains parseable by
 * `JSON.parse` and any structured-data validator.
 */

export function serializeJsonLd(data: Record<string, unknown>): string {
  const json = JSON.stringify(data);
  return json
    .replace(/</g, '\\u003C')
    .replace(/>/g, '\\u003E')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
