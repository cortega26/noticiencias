/**
 * Head-tag builder — reproduces the exact rendered output of
 * `@astrolib/seo`'s `buildTags` (same tag order, same attribute order,
 * same self-closing style) so the rendered `<head>` is byte-identical
 * after the wrapper is removed.
 *
 * Returns a structured list of tag descriptors; `Metadata.astro` renders
 * them as real (auto-escaped) Astro elements — no `set:html` string blob.
 */
import type { SeoProps, OpenGraphMedia, AdditionalRobotsProps } from './seo';

export type HeadTag =
  | { tag: 'title'; content: string }
  | { tag: 'meta'; attrs: Record<string, string> }
  | { tag: 'link'; attrs: Record<string, string> };

export const buildHead = (config: SeoProps): HeadTag[] => {
  const tags: HeadTag[] = [];
  const push = (t: HeadTag) => tags.push(t);

  // Title
  if (config.title) {
    const formatted = config.titleTemplate
      ? config.titleTemplate.replace('%s', config.title)
      : config.title;
    push({ tag: 'title', content: formatted });
  }

  // Description
  if (config.description) {
    push({ tag: 'meta', attrs: { name: 'description', content: config.description } });
  }

  // Robots: noindex, nofollow, and robotsProps
  const robots: string[] = [];
  if (typeof config.noindex !== 'undefined') robots.push(config.noindex ? 'noindex' : 'index');
  if (typeof config.nofollow !== 'undefined') robots.push(config.nofollow ? 'nofollow' : 'follow');

  if (config.robotsProps) {
    const r: AdditionalRobotsProps = config.robotsProps;
    if (r.nosnippet) robots.push('nosnippet');
    if (typeof r.maxSnippet === 'number') robots.push(`max-snippet:${r.maxSnippet}`);
    if (r.maxImagePreview) robots.push(`max-image-preview:${r.maxImagePreview}`);
    if (typeof r.maxVideoPreview === 'number') robots.push(`max-video-preview:${r.maxVideoPreview}`);
    if (r.noarchive) robots.push('noarchive');
    if (r.unavailableAfter) robots.push(`unavailable_after:${r.unavailableAfter}`);
    if (r.noimageindex) robots.push('noimageindex');
    if (r.notranslate) robots.push('notranslate');
  }
  if (robots.length > 0) {
    push({ tag: 'meta', attrs: { name: 'robots', content: robots.join(',') } });
  }

  // Canonical
  if (config.canonical) {
    push({ tag: 'link', attrs: { rel: 'canonical', href: config.canonical } });
  }

  // Mobile Alternate
  if (config.mobileAlternate) {
    push({
      tag: 'link',
      attrs: { rel: 'alternate', media: config.mobileAlternate.media, href: config.mobileAlternate.href },
    });
  }

  // Language Alternates
  if (config.languageAlternates) {
    for (const la of config.languageAlternates) {
      push({ tag: 'link', attrs: { rel: 'alternate', hreflang: la.hrefLang, href: la.href } });
    }
  }

  // OpenGraph
  if (config.openGraph) {
    const og = config.openGraph;
    const ogTitle = og.title || config.title;
    if (ogTitle) push({ tag: 'meta', attrs: { property: 'og:title', content: ogTitle } });

    const ogDescription = og.description || config.description;
    if (ogDescription) push({ tag: 'meta', attrs: { property: 'og:description', content: ogDescription } });

    if (og.url) push({ tag: 'meta', attrs: { property: 'og:url', content: og.url } });
    if (og.type) push({ tag: 'meta', attrs: { property: 'og:type', content: og.type } });

    if (og.images?.length) {
      for (const medium of og.images as ReadonlyArray<OpenGraphMedia>) {
        push({ tag: 'meta', attrs: { property: 'og:image', content: medium.url } });
        if (medium.alt) push({ tag: 'meta', attrs: { property: 'og:image:alt', content: medium.alt } });
        if (medium.secureUrl) push({ tag: 'meta', attrs: { property: 'og:image:secure_url', content: medium.secureUrl } });
        if (medium.type) push({ tag: 'meta', attrs: { property: 'og:image:type', content: medium.type } });
        if (typeof medium.width === 'number') push({ tag: 'meta', attrs: { property: 'og:image:width', content: String(medium.width) } });
        if (typeof medium.height === 'number') push({ tag: 'meta', attrs: { property: 'og:image:height', content: String(medium.height) } });
      }
    }
    if (og.videos?.length) {
      for (const medium of og.videos as ReadonlyArray<OpenGraphMedia>) {
        push({ tag: 'meta', attrs: { property: 'og:video', content: medium.url } });
        if (medium.alt) push({ tag: 'meta', attrs: { property: 'og:video:alt', content: medium.alt } });
        if (medium.secureUrl) push({ tag: 'meta', attrs: { property: 'og:video:secure_url', content: medium.secureUrl } });
        if (medium.type) push({ tag: 'meta', attrs: { property: 'og:video:type', content: medium.type } });
        if (typeof medium.width === 'number') push({ tag: 'meta', attrs: { property: 'og:video:width', content: String(medium.width) } });
        if (typeof medium.height === 'number') push({ tag: 'meta', attrs: { property: 'og:video:height', content: String(medium.height) } });
      }
    }
    if (og.locale) push({ tag: 'meta', attrs: { property: 'og:locale', content: og.locale } });
    if (og.site_name) push({ tag: 'meta', attrs: { property: 'og:site_name', content: og.site_name } });
  }

  // Facebook
  if (config.facebook?.appId) {
    push({ tag: 'meta', attrs: { property: 'fb:app_id', content: config.facebook.appId } });
  }

  // Twitter
  if (config.twitter) {
    if (config.twitter.cardType) push({ tag: 'meta', attrs: { name: 'twitter:card', content: config.twitter.cardType } });
    if (config.twitter.site) push({ tag: 'meta', attrs: { name: 'twitter:site', content: config.twitter.site } });
    if (config.twitter.handle) push({ tag: 'meta', attrs: { name: 'twitter:creator', content: config.twitter.handle } });
  }

  // Additional Meta Tags
  if (config.additionalMetaTags) {
    for (const m of config.additionalMetaTags) {
      const attrs: Record<string, string> = { content: m.content };
      if (m.name) attrs.name = m.name;
      else if (m.property) attrs.property = m.property;
      else if (m.httpEquiv) attrs['http-equiv'] = m.httpEquiv;
      push({ tag: 'meta', attrs });
    }
  }

  // Additional Link Tags
  if (config.additionalLinkTags) {
    for (const l of config.additionalLinkTags) {
      const attrs: Record<string, string> = { rel: l.rel, href: l.href };
      if (l.sizes) attrs.sizes = l.sizes;
      if (l.media) attrs.media = l.media;
      if (l.type) attrs.type = l.type;
      if (l.color) attrs.color = l.color;
      if (l.as) attrs.as = l.as;
      if (l.crossOrigin) attrs.crossorigin = l.crossOrigin;
      push({ tag: 'link', attrs });
    }
  }

  return tags;
};
