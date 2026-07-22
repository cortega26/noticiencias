/**
 * Narrow local SEO types — replaces `@astrolib/seo`.
 *
 * The site's metadata contract (see `Metadata.astro`, `images.ts`,
 * `~/types.d.ts MetaData`) only uses a small subset of what `@astrolib/seo`
 * rendered. This module mirrors exactly that subset, so the rendered
 * `<head>` output stays byte-identical after the wrapper is removed.
 */

export interface OpenGraphMedia {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
  type?: string;
  secureUrl?: string;
}

export interface OpenGraph {
  url?: string;
  /** snake_case — matches the runtime shape from `config.yaml` (lodash.merge preserves it). */
  site_name?: string;
  images?: ReadonlyArray<OpenGraphMedia>;
  videos?: ReadonlyArray<OpenGraphMedia>;
  locale?: string;
  type?: string;
  title?: string;
  description?: string;
}

export interface Twitter {
  cardType?: string;
  site?: string;
  handle?: string;
  creator?: string;
}

export type ImagePreviewSize = 'none' | 'standard' | 'large';

export interface AdditionalRobotsProps {
  nosnippet?: boolean;
  maxSnippet?: number;
  maxImagePreview?: ImagePreviewSize;
  maxVideoPreview?: number;
  noarchive?: boolean;
  unavailableAfter?: string;
  noimageindex?: boolean;
  notranslate?: boolean;
}

export interface MobileAlternate {
  media: string;
  href: string;
}

export interface LanguageAlternate {
  hrefLang: string;
  href: string;
}

export interface AdditionalMetaTag {
  content: string;
  name?: string;
  property?: string;
  httpEquiv?: string;
}

export interface AdditionalLinkTag {
  rel: string;
  href: string;
  sizes?: string;
  media?: string;
  type?: string;
  color?: string;
  as?: string;
  crossOrigin?: string;
}

export interface SeoProps {
  title?: string;
  titleTemplate?: string;
  noindex?: boolean;
  nofollow?: boolean;
  robotsProps?: AdditionalRobotsProps;
  description?: string;
  canonical?: string;
  mobileAlternate?: MobileAlternate;
  languageAlternates?: ReadonlyArray<LanguageAlternate>;
  openGraph?: OpenGraph;
  facebook?: { appId: string };
  twitter?: Twitter;
  additionalMetaTags?: ReadonlyArray<AdditionalMetaTag>;
  additionalLinkTags?: ReadonlyArray<AdditionalLinkTag>;
}
