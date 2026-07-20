import { Page, expect } from '@playwright/test';

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

/**
 * Verifies the login `returnTo` redirect flow for a protected page.
 *
 * Navigates to `protectedPath` in an unauthenticated context, asserts the
 * redirect to the login page with the URL-encoded `returnTo` param, performs a
 * password login, and asserts the user is redirected back to `protectedPath`.
 *
 * The page must belong to a fresh, unauthenticated browser context.
 *
 * @param page The Playwright page object (unauthenticated)
 * @param protectedPath The protected path to visit, e.g. "/lorem-ipsum/memories"
 */
export async function loginViaReturnToRedirect(page: Page, protectedPath: string): Promise<void> {
  await page.goto(protectedPath);

  // Should redirect to login with the URL-encoded returnTo parameter
  const encodedPath = encodeURIComponent(protectedPath);
  await expect(page).toHaveURL(new RegExp(`/login\\?returnTo=${encodedPath}`));

  await loginWithPassword(page);

  // After successful login, should be redirected back to the original page
  const escapedPath = protectedPath.replace(/\//g, '\\/');
  await expect(page).toHaveURL(new RegExp(escapedPath), { timeout: 15000 });
}
