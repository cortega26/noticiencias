import { expect, test } from '@playwright/test';

for (const [width, scale, slot] of [
  [375, 2, 96],
  [1280, 1, 160],
  [1280, 3, 160],
]) {
  test.describe(`row thumbnails at ${width}px and DPR ${scale}`, () => {
    test.use({ viewport: { width, height: 850 }, deviceScaleFactor: scale });

    test('select a responsive image for the rendered slot', async ({ page }) => {
      await page.goto('/blog/');
      const source = page.locator('article figure picture source[srcset]').first();
      await expect(source).toHaveAttribute('sizes', '(min-width: 40rem) 160px, 96px');
      const image = source.locator('..').locator('img');
      await image.scrollIntoViewIfNeeded();
      await expect
        .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
        .toBeGreaterThan(0);
      const actualWidth = await image.evaluate((img) => img.getBoundingClientRect().width);
      expect(actualWidth).toBeCloseTo(slot, 0);
      const selectedWidth = await image.evaluate((img: HTMLImageElement) => {
        const srcset = img.parentElement?.querySelector('source')?.srcset ?? '';
        return srcset
          .split(',')
          .map((candidate) => candidate.trim().split(/\s+/))
          .find(([url]) => new URL(url, document.baseURI).href === img.currentSrc)?.[1];
      });
      expect(selectedWidth).toBe(scale === 3 ? '640w' : '320w');
    });
  });
}
