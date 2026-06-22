import { Page, expect } from '@playwright/test';

/**
 * Navigates to the Repository files page from the home page.
 *
 * Assumes the user is already logged in (auth state is set up).
 *
 * @param page The Playwright page object
 */
export async function navigateToRepository(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('link', { name: 'Repository' }).click();
  await expect(page).toHaveURL(/\/repo$/);
}
