/**
 * Newsletter capture states (P1-06).
 *
 * The form is a no-JS Buttondown POST first (ADR-0009); the script only adds
 * accessible loading/success/error states. These tests mock Buttondown so no
 * real subscription is ever attempted.
 */
import { test, expect } from './fixtures';

const BUTTONDOWN = 'https://buttondown.com/**';
const EARLY_FORM = 'section[aria-labelledby="home-newsletter-cta"] form';
const STATUS = '[data-newsletter-status]';
const SUBMIT = 'button[type="submit"]';

test('shows accessible loading and success states for the early capture', async ({ page }) => {
  await page.route(BUTTONDOWN, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await route.fulfill({
      status: 302,
      headers: { location: 'https://buttondown.com/subscribe/confirm' },
    });
  });

  await page.goto('/');
  const form = page.locator(EARLY_FORM);
  await form.locator('input[type="email"]').fill('lector@example.com');
  await form.locator(SUBMIT).click();

  await expect(form).toHaveAttribute('aria-busy', 'true');
  await expect(form.locator(STATUS)).toHaveText('Enviando…');
  await expect(form.locator(STATUS)).toHaveText('Revisa tu correo para confirmar tu suscripción.');
  await expect(form.locator(SUBMIT)).toBeDisabled();
});

test('shows an error state and re-enables the capture when the provider fails', async ({
  page,
}) => {
  await page.route(BUTTONDOWN, (route) => route.fulfill({ status: 500, body: '' }));

  await page.goto('/');
  const form = page.locator(EARLY_FORM);
  await form.locator('input[type="email"]').fill('lector@example.com');
  await form.locator(SUBMIT).click();

  await expect(form.locator(STATUS)).toHaveText(
    'No pudimos completar la suscripción. Inténtalo de nuevo.'
  );
  await expect(form.locator(SUBMIT)).toBeEnabled();
  await expect(form).not.toHaveAttribute('aria-busy', 'true');
});
