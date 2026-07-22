import { describe, expect, it } from 'vitest';
import {
  readingTimeRemarkPlugin,
  responsiveTablesRehypePlugin,
  lazyImagesRehypePlugin,
} from '../src/utils/frontmatter';

// The real transformer type carries a unified `this`/3-arg `next` callback
// signature we don't need for these characterization tests; call the
// returned transformer through a loose shape instead of fighting it.
type LooseTransform = (tree: unknown, file?: unknown) => void;
const call = (plugin: () => unknown, tree: unknown, file?: unknown) =>
  (plugin() as LooseTransform)(tree, file);

describe('readingTimeRemarkPlugin', () => {
  it('writes the computed reading time onto astro frontmatter data', () => {
    const tree = { type: 'root', children: [{ type: 'text', value: 'word '.repeat(400) }] };
    const file = { data: { astro: { frontmatter: {} as { readingTime?: number } } } };

    call(readingTimeRemarkPlugin, tree, file);

    expect(file.data.astro.frontmatter.readingTime).toBeGreaterThan(0);
  });

  it('does nothing when the file has no astro frontmatter data', () => {
    const tree = { type: 'root', children: [{ type: 'text', value: 'word' }] };
    const file = {};

    expect(() => call(readingTimeRemarkPlugin, tree, file)).not.toThrow();
  });
});

describe('responsiveTablesRehypePlugin', () => {
  it('wraps a top-level table element in a scrollable div', () => {
    const table = { type: 'element', tagName: 'table', children: [] };
    const tree = { children: [table] };

    call(responsiveTablesRehypePlugin, tree);

    expect(tree.children).toHaveLength(1);
    expect(tree.children[0]).toMatchObject({
      type: 'element',
      tagName: 'div',
      properties: { style: 'overflow:auto' },
      children: [table],
    });
  });

  it('leaves non-table elements untouched', () => {
    const paragraph = { type: 'element', tagName: 'p', children: [] };
    const tree = { children: [paragraph] };

    call(responsiveTablesRehypePlugin, tree);

    expect(tree.children[0]).toBe(paragraph);
  });

  it('is a no-op on a tree with no children', () => {
    const tree = {};
    expect(() => call(responsiveTablesRehypePlugin, tree)).not.toThrow();
  });
});

describe('lazyImagesRehypePlugin', () => {
  it('adds loading=lazy to every img element found anywhere in the tree', () => {
    const img = { type: 'element', tagName: 'img', properties: {} as Record<string, string> };
    const tree = { type: 'root', children: [{ type: 'element', tagName: 'p', children: [img] }] };

    call(lazyImagesRehypePlugin, tree);

    expect(img.properties.loading).toBe('lazy');
  });

  it('is a no-op on a tree with no children', () => {
    const tree = {};
    expect(() => call(lazyImagesRehypePlugin, tree)).not.toThrow();
  });
});
