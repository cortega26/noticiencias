import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Compliance & Security Suite', () => {
  const publicDir = path.join(__dirname, '../public');
  const headersFile = path.join(publicDir, '_headers');

  it('should have an OWASP-compliant _headers file', () => {
    expect(fs.existsSync(headersFile)).toBe(true);
    const content = fs.readFileSync(headersFile, 'utf-8');
    expect(content).toContain('X-Frame-Options: SAMEORIGIN');
    expect(content).toContain('X-Content-Type-Options: nosniff');
    expect(content).toContain('Strict-Transport-Security');
  });

  // Plan 009: the CSP lives in three places — the meta tag (the only copy that
  // actually enforces, because GitHub Pages cannot emit response headers),
  // public/_headers, and the deployment doc that the operator pastes into the
  // Cloudflare Transform Rule. They had already drifted once (the doc and
  // _headers were missing static.cloudflareinsights.com and buttondown.com)
  // with nothing to catch it. The meta tag is the source of truth here.
  describe('Content-Security-Policy stays in sync across its three copies', () => {
    const metaSource = fs.readFileSync(
      path.join(__dirname, '../src/components/template/common/CommonMeta.astro'),
      'utf-8'
    );
    const canonical = metaSource.match(/content="(default-src[^"]+)"/)?.[1];

    it('finds the canonical policy in the meta tag', () => {
      expect(canonical).toBeDefined();
    });

    it('matches the policy documented for the edge in _headers', () => {
      // Stripped of the leading "# " because the directives ship commented out:
      // GitHub Pages ignores _headers, so the file is reference material.
      const content = fs
        .readFileSync(headersFile, 'utf-8')
        .split('\n')
        .map((line) => line.trim().replace(/^#\s*/, ''))
        .join('\n');
      expect(content).toContain(`Content-Security-Policy: ${canonical}`);
    });

    it('matches the policy documented in DEPLOYMENT_SECURITY_HEADERS.md', () => {
      const content = fs.readFileSync(
        path.join(__dirname, '../docs/DEPLOYMENT_SECURITY_HEADERS.md'),
        'utf-8'
      );
      expect(content).toContain(`Content-Security-Policy: ${canonical}`);
    });
  });

  it('should have critical placeholder images', () => {
    const defaultImg = path.join(publicDir, 'assets/images/default.png');
    const heroImg = path.join(publicDir, 'assets/images/hero-image.png');

    expect(fs.existsSync(defaultImg)).toBe(true);
    expect(fs.existsSync(heroImg)).toBe(true);
  });
});
