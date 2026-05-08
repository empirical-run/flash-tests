import { Page, expect } from '@playwright/test';

/**
 * Navigates to the Test Cases page from the home page and expands all test cases.
 * Starts at '/', waits for the app to load, clicks the Test Cases nav link,
 * waits for the test-cases URL, waits for rows to load, and expands the tree view.
 *
 * Assumes the user is already logged in (auth state is set up).
 *
 * @param page The Playwright page object
 */
export async function navigateToTestCases(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByText('Lorem Ipsum', { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Test Cases', exact: true }).click();
  await expect(page).toHaveURL(/test-cases$/);
  await expect(page.getByRole('row').first()).toBeVisible();
  await page.getByRole('button', { name: 'Expand all' }).click();
}
