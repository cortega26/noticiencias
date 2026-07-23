/**
 * Plan 044: Pagination configuration regression test.
 *
 * Verifies that the blog archive route uses the configured `postsPerPage`
 * value (6) from src/config.yaml, not a hardcoded inline value. The test
 * parses the route file to check for the `blogPostsPerPage` import and
 * asserts no hardcoded `pageSize: <number>` exists.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const routePath = resolve(process.cwd(), 'src/pages/blog/[...page].astro');
const routeSource = readFileSync(routePath, 'utf-8');

describe('Pagination configuration (plan 044)', () => {
  it('blog archive should import blogPostsPerPage from utils/blog', () => {
    expect(
      routeSource.includes('blogPostsPerPage'),
      'blog archive route must import blogPostsPerPage from ~/utils/blog'
    ).toBe(true);
  });

  it('blog archive should not hardcode pageSize to a literal number', () => {
    // Check that there's no `pageSize: <number>` pattern (the only valid
    // usage is `pageSize: blogPostsPerPage`).
    const hardcodedMatch = routeSource.match(/pageSize:\s*\d+/);
    expect(
      hardcodedMatch,
      `blog archive route must not hardcode pageSize — found: ${hardcodedMatch?.[0]}`
    ).toBeNull();
  });

  it('blog archive should use blogPostsPerPage as pageSize', () => {
    expect(
      routeSource.includes('pageSize: blogPostsPerPage'),
      'blog archive route must use pageSize: blogPostsPerPage'
    ).toBe(true);
  });

  it('config.yaml postsPerPage should be 6', () => {
    const configPath = resolve(process.cwd(), 'src/config.yaml');
    const config = readFileSync(configPath, 'utf-8');
    const match = config.match(/postsPerPage:\s*(\d+)/);
    expect(match, 'config.yaml must define postsPerPage').toBeTruthy();
    expect(parseInt(match![1], 10)).toBe(6);
  });
});
