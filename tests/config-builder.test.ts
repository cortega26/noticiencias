import { describe, expect, it } from 'vitest';
import configBuilder from '../src/integration/utils/configBuilder';

describe('configBuilder', () => {
  it('fills every section with defaults when given an empty config', () => {
    const result = configBuilder({});

    expect(result.SITE).toMatchObject({ name: 'Website', base: '/', trailingSlash: false });
    expect(result.I18N).toEqual({ language: 'en', textDirection: 'ltr' });
    expect(result.APP_BLOG.isEnabled).toBe(false);
    expect(result.APP_BLOG.post.permalink).toBe('/blog/%slug%');
    expect(result.UI).toEqual({ theme: 'system' });
    expect(result.ANALYTICS.vendors.googleAnalytics.id).toBeUndefined();
    expect(result.APP_CONFIG!.form.endpoint).toBe('');
  });

  it('deep-merges user overrides on top of defaults without discarding sibling defaults', () => {
    const result = configBuilder({
      site: { name: 'Noticiencias' },
      apps: {
        blog: {
          isEnabled: true,
          post: {
            permalink: '/%category%/%slug%',
            isEnabled: true,
            robots: { index: true, follow: true },
          },
        },
      },
    });

    expect(result.SITE.name).toBe('Noticiencias');
    // Untouched sibling default fields must survive the merge.
    expect(result.SITE.base).toBe('/');
    expect(result.APP_BLOG.isEnabled).toBe(true);
    expect(result.APP_BLOG.post.permalink).toBe('/%category%/%slug%');
    // Nested sibling default (post.robots) must survive too.
    expect(result.APP_BLOG.post.robots).toEqual({ index: true, follow: true });
  });

  it("derives the metadata title default from the site's own name", () => {
    const result = configBuilder({ site: { name: 'Custom Name' } });
    expect(result.METADATA.title).toMatchObject({ default: 'Custom Name', template: '%s' });
  });

  it('lets an explicit form endpoint override the empty default', () => {
    const result = configBuilder({ form: { endpoint: 'https://example.com/api/report' } });
    expect(result.APP_CONFIG!.form.endpoint).toBe('https://example.com/api/report');
  });

  it('lets an explicit newsletter endpoint override the empty default without dropping the sibling form endpoint', () => {
    const result = configBuilder({
      form: { newsletter_endpoint: 'https://buttondown.com/api/emails/embed-subscribe/example' },
    });
    const form = result.APP_CONFIG?.form;
    expect(form?.newsletter_endpoint).toBe(
      'https://buttondown.com/api/emails/embed-subscribe/example'
    );
    // Untouched sibling default field must survive the merge.
    expect(form?.endpoint).toBe('');
  });

  // Regression guard (plan 009): `partytown: true` used to be the default while
  // `@astrojs/partytown` was never installed, so Analytics.astro tagged both GA
  // scripts with an unknown `text/partytown` MIME type and the browser never ran
  // them — the GA branch was dead, not merely disabled. Re-introducing the flag
  // without the integration would silently break GA again.
  it('does not carry a partytown flag (the integration is not installed)', () => {
    const result = configBuilder({});
    expect(result.ANALYTICS.vendors.googleAnalytics).not.toHaveProperty('partytown');
  });

  it('defaults the cloudflare analytics token to undefined (tracking stays off)', () => {
    const result = configBuilder({});
    expect(result.ANALYTICS?.vendors.cloudflare?.token).toBeUndefined();
  });

  it('lets an explicit cloudflare token override the default without dropping GA defaults', () => {
    const result = configBuilder({
      analytics: { vendors: { cloudflare: { token: 'TEST-TOKEN' } } },
    });
    const vendors = result.ANALYTICS?.vendors;
    expect(vendors?.cloudflare?.token).toBe('TEST-TOKEN');
    expect(vendors?.googleAnalytics).toMatchObject({
      id: undefined,
    });
  });
});
