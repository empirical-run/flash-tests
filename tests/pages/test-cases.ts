import { expect, Page } from '@playwright/test';

/**
 * Navigates to the Test Cases page from the project home page.
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
}
