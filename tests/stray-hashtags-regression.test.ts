import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const postsDir = path.resolve(__dirname, '..', 'src', 'content', 'posts');

// Hashtags (`#palabra`) are social-media surface code and do not belong in
// editorial content. The backend pipeline categorizes via the `tags[]`
// frontmatter array, which is rendered semantically by <TagPill /> without
// the `#` prefix. Any literal `#word` that leaks into the visible surfaces
// — title, excerpt, body prose — is a publication bug. This test fails
// the build if it detects one, so we never ship a "#Astronomía"-style
// trailing hashtag in a dek again. (See docs/EDITORIAL_VOICE.md section 1
// "Qué NO es Noticiencias" — we are not a social aggregator.)
//
// Detection rule: `#` immediately followed by a letter (including Spanish
// accented letters). Markdown ATX headings (`# Heading`, `## Heading`)
// require a space after the `#`, so they are not caught.
const HASHTAG_RE = /#[A-Za-zÁÉÍÓÚÑáéíóúñ]/;

describe('stray hashtags regression guard', () => {
  it('no published post leaks a `#palabra` hashtag into title, excerpt, or body', () => {
    const offenders: string[] = [];

    for (const file of fs.readdirSync(postsDir)) {
      if (!file.endsWith('.md') && !file.endsWith('.mdx')) continue;
      const fullPath = path.join(postsDir, file);
      const content = fs.readFileSync(fullPath, 'utf8');

      // Split frontmatter / body.
      const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (!match) continue;
      const [, frontmatter, body] = match;

      // Frontmatter: only the visible-to-reader fields (title, excerpt).
      // We intentionally skip `tags:` and `categories:` entries — they are
      // structured data, not prose, and the front-end strips them anyway.
      for (const line of frontmatter.split('\n')) {
        if (!/^(title|excerpt):/.test(line)) continue;
        if (HASHTAG_RE.test(line)) {
          offenders.push(`${file} frontmatter: ${line.trim()}`);
        }
      }

      // Body: strip HTML comments (the backend writes a source_identity
      // comment that may contain `#` in URLs), then scan each line. Skip
      // Markdown ATX headings, which require a space after the `#` and so
      // would not match the regex anyway — but skipping them explicitly
      // makes the intent clear.
      const bodyWithoutComments = body.replace(/<!--[\s\S]*?-->/g, '');
      for (const line of bodyWithoutComments.split('\n')) {
        if (/^#+\s/.test(line)) continue;
        if (HASHTAG_RE.test(line)) {
          offenders.push(`${file} body: ${line.trim()}`);
        }
      }
    }

    expect(offenders, `Posts with stray hashtags:\n${offenders.join('\n')}`).toEqual([]);
  });
});
