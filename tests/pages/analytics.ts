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

/**
 * Searches the analytics test cases list by typing a query into the
 * "Search tests..." input and submitting with Enter.
 *
 * Supports both plain-text name searches (e.g. 'login') and filter expressions
 * (e.g. 'fail_rate:>50').
 *
 * Assumes the page is already on the Analytics page.
 *
 * @param page  The Playwright page object
 * @param query The search text or filter expression to submit
 */
export async function searchTests(page: Page, query: string): Promise<void> {
  const searchInput = page.getByPlaceholder('Search tests...');
  await searchInput.fill(query);
  await searchInput.press('Enter');
}
