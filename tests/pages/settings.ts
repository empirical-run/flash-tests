import { Page } from '@playwright/test';

/**
 * Navigates to the API Keys settings page from the home page.
 * Starts at '/', clicks the Settings nav link, then the API Keys sub-link.
 *
 * Assumes the user is already logged in (auth state is set up).
 *
 * @param page The Playwright page object
 */
export async function navigateToApiKeys(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('link', { name: 'API Keys' }).click();
}
