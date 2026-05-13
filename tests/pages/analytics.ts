import { Page, expect } from '@playwright/test';

/**
 * Navigates to the Analytics page from the home page.
 * Starts at '/', clicks the Analytics nav link, and waits for the analytics URL.
 *
 * Assumes the user is already logged in (auth state is set up).
 *
 * @param page The Playwright page object
 */
export async function navigateToAnalytics(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('link', { name: 'Analytics' }).click();
  await expect(page).toHaveURL(/analytics/);
}
