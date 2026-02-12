import getReadingTime from 'reading-time';
import { toString } from 'mdast-util-to-string';
import { visit } from 'unist-util-visit';
import type { RehypePlugin, RemarkPlugin } from '@astrojs/markdown-remark';

interface AstroData {
  astro: {
    frontmatter: {
      readingTime?: number;
    };
  };
}

function hasAstroData(data: unknown): data is AstroData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'astro' in data &&
    typeof (data as AstroData).astro === 'object' &&
    (data as AstroData).astro !== null &&
    'frontmatter' in (data as AstroData).astro
  );
}

export const readingTimeRemarkPlugin: RemarkPlugin = () => {
  return function (tree, file: unknown) {
    const textOnPage = toString(tree);
    const readingTime = Math.ceil(getReadingTime(textOnPage).minutes);

    if (
      typeof file === 'object' &&
      file !== null &&
      'data' in file &&
      hasAstroData((file as { data: unknown }).data)
    ) {
      ((file as { data: AstroData }).data).astro.frontmatter.readingTime = readingTime;
    }
  };
};

export const responsiveTablesRehypePlugin: RehypePlugin = () => {
  return function (tree) {
    if (!tree.children) return;

    for (let i = 0; i < tree.children.length; i++) {
      const child = tree.children[i];

      if (child.type === 'element' && child.tagName === 'table') {
        tree.children[i] = {
          type: 'element',
          tagName: 'div',
          properties: {
            style: 'overflow:auto',
          },
          children: [child],
        };

        i++;
      }
    }
  };
};

export const lazyImagesRehypePlugin: RehypePlugin = () => {
  return function (tree) {
    if (!tree.children) return;

    visit(tree, 'element', function (node) {
      if (node.tagName === 'img') {
        node.properties.loading = 'lazy';
      }
    });
  };
};
