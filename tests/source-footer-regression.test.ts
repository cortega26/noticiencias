import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const postsDir = path.resolve(__dirname, '..', 'src', 'content', 'posts');

// The prose footer `Fuente original: [URL](URL)` was historically appended
// to article bodies by the backend pipeline. It is redundant with the
// `source_url` frontmatter field, which the TrustPanel component already
// renders semantically. Re-introducing the footer produces a duplicate
// source visible to the reader. This test guards against regression.
const FOOTER_RE = /^Fuente original:\s*\[[^\]]+\]\([^)]+\)\s*$/m;

describe('legacy source footer regression guard', () => {
  it('no published post contains a prose "Fuente original" footer', () => {
    const offenders: string[] = [];
    for (const file of fs.readdirSync(postsDir)) {
      if (!file.endsWith('.md') && !file.endsWith('.mdx')) continue;
      const body = fs.readFileSync(path.join(postsDir, file), 'utf8');
      if (FOOTER_RE.test(body)) {
        offenders.push(file);
      }
    }
    expect(offenders, `Posts with redundant prose source footer:\n${offenders.join('\n')}`).toEqual(
      []
    );
  });
});
