import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Slug / Permalink Uniqueness (B-04 / F-0021)', () => {
  const postsDir = path.join(__dirname, '../src/content/posts');

  it('should have no duplicate post filenames (slug collisions)', () => {
    if (!fs.existsSync(postsDir)) {
      throw new Error('Posts directory not found.');
    }

    const files = fs.readdirSync(postsDir).filter((f) => f.endsWith('.md'));
    const slugs = new Map<string, string>();
    const duplicates: string[] = [];

    for (const file of files) {
      // The slug is the filename without .md extension
      const slug = file.replace(/\.md$/, '');
      const existing = slugs.get(slug);
      if (existing) {
        duplicates.push(`Duplicate slug "${slug}": "${existing}" and "${file}"`);
      }
      slugs.set(slug, file);
    }

    expect(duplicates, `Found slug collisions:\n${duplicates.join('\n')}`).toEqual([]);
  });

  it('should detect duplicate permalinks from frontmatter', () => {
    if (!fs.existsSync(postsDir)) {
      throw new Error('Posts directory not found.');
    }

    const files = fs.readdirSync(postsDir).filter((f) => f.endsWith('.md'));
    const permalinks = new Map<string, string>();
    const duplicates: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(path.join(postsDir, file), 'utf-8');
      // Extract permalink from frontmatter if present
      const match = content.match(/^permalink:\s*(.+)$/m);
      if (match) {
        const permalink = match[1].trim().replace(/["']/g, '');
        const existing = permalinks.get(permalink);
        if (existing) {
          duplicates.push(`Duplicate permalink "${permalink}": "${existing}" and "${file}"`);
        }
        permalinks.set(permalink, file);
      }
    }

    expect(duplicates, `Found permalink collisions:\n${duplicates.join('\n')}`).toEqual([]);
  });
});
