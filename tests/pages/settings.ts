import { Page, expect } from '@playwright/test';

/**
 * Navigates to the API Keys settings page.
 * Starts at '/', clicks the Settings nav link, then the API Keys sub-link,
 * and waits for the API Keys heading to confirm the page has loaded.
 *
 * Assumes the user is already logged in (auth state is set up).
 *
 * @param page The Playwright page object
 */
export async function navigateToApiKeys(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('link', { name: 'API Keys' }).click();
  await expect(page.getByRole('heading', { name: 'API Keys' })).toBeVisible();
}
