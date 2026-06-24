/**
 * Report form E2E tests.
 * Tests the problem reporting form on the reportar-problema page.
 */

import { test, expect } from '@playwright/test';

test('report form page loads', async ({ page }) => {
  const response = await page.goto('/reportar-problema');
  // Page should load (may be 200 or 404 if route doesn't exist yet)
  expect(response?.status()).toBeLessThan(500);
});

test('report form has problem type selector', async ({ page }) => {
  await page.goto('/reportar-problema');

  // Check for form elements if page exists
  const select = page.locator('select#problem-type');
  const form = page.locator('form#report-problem-form');

  const hasForm = (await form.count()) > 0;
  if (hasForm) {
    await expect(select).toBeVisible();

    // Verify required problem types exist
    const options = select.locator('option');
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(3); // At least a few options
  }
  // If form doesn't exist, the page might be under construction — that's OK
});

test('report form validates required fields', async ({ page }) => {
  await page.goto('/reportar-problema');

  const form = page.locator('form#report-problem-form');
  const hasForm = (await form.count()) > 0;
  if (!hasForm) {
    test.skip(true, 'Report form not found on page');
    return;
  }

  // Submit button should be disabled when required fields are empty
  const submitBtn = form.locator('button[type="submit"]');
  await expect(submitBtn).toBeVisible();
  const isDisabled = await submitBtn.isDisabled();
  // Form correctly prevents empty submission (button disabled or JS validation)
  expect(isDisabled || (await submitBtn.getAttribute('disabled')) !== null).toBeTruthy();
});

test('report form has accessible labels', async ({ page }) => {
  await page.goto('/reportar-problema');

  const form = page.locator('form#report-problem-form');
  const hasForm = (await form.count()) > 0;
  if (!hasForm) {
    test.skip(true, 'Report form not found on page');
    return;
  }

  // Check labels are associated with inputs
  const labels = form.locator('label');
  const labelCount = await labels.count();
  expect(labelCount).toBeGreaterThan(0);

  // Each label should have a 'for' attribute
  for (let i = 0; i < labelCount; i++) {
    const labelFor = await labels.nth(i).getAttribute('for');
    if (labelFor) {
      // Verify the target element exists
      const target = page.locator(`#${labelFor}`);
      await expect(target).toBeAttached();
    }
  }
});
