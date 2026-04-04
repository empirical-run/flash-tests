import { Page, expect } from '@playwright/test';

/**
 * Navigates to the Issues page from the home page.
 * Starts at '/', waits for the app to load, clicks the Issues nav link,
 * and waits for the issues list URL.
 *
 * Assumes the user is already logged in (auth state is set up).
 *
 * @param page The Playwright page object
 */
export async function navigateToIssues(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByText('Lorem Ipsum', { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Issues', exact: true }).click();
  await expect(page).toHaveURL(/issues(\?|$)/);
}
