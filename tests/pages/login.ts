import { Page } from '@playwright/test';

/**
 * Performs a standard email + password login flow on the login page.
 * Fills in the email, clicks Continue, fills in the password, and clicks Submit.
 *
 * Assumes the page is already on the login page (or has been redirected there).
 * Uses `AUTOMATED_USER_EMAIL` and `AUTOMATED_USER_PASSWORD` environment variables.
 *
 * @param page The Playwright page object
 */
export async function loginWithPassword(page: Page): Promise<void> {
  await page.getByRole('textbox', { name: /email/i }).fill(process.env.AUTOMATED_USER_EMAIL!);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('textbox', { name: 'Password' }).fill(process.env.AUTOMATED_USER_PASSWORD!);
  await page.getByRole('button', { name: 'Submit' }).click();
}
