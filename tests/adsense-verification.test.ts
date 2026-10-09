import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const meta = readFileSync(fileURLToPath(new URL('../src/components/template/common/CommonMeta.astro', import.meta.url)), 'utf8');
const adsTxt = readFileSync(fileURLToPath(new URL('../public/ads.txt', import.meta.url)), 'utf8');

describe('AdSense site ownership and seller authorization', () => {
  it('renders exactly one ownership meta tag in the shared document head', () => {
    expect(meta.match(/name="google-adsense-account"/g)).toHaveLength(1);
    expect(meta).toContain('<meta name="google-adsense-account" content="ca-pub-2907085573636183" />');
  });

  it('publishes the exact AdSense seller record at the site root', () => {
    expect(adsTxt).toBe('google.com, pub-2907085573636183, DIRECT, f08c47fec0942fa0\n');
  });
});
