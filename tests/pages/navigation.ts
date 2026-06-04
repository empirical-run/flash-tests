import { Page, expect } from '@playwright/test';

/**
 * Navigates from the project home page to a primary sidebar section.
 *
 * This captures the repeated pattern of opening '/', waiting for the project
 * shell to load, clicking a primary nav link, and verifying the destination URL.
 *
 * @param page       The Playwright page object
 * @param linkName   The accessible name of the primary nav link
 * @param urlPattern Regex that should match the destination URL
 * @param options    Optional link matching options (e.g. { exact: true })
 */
export async function navigateToPrimarySection(
  page: Page,
  linkName: string | RegExp,
  urlPattern: RegExp,
  options?: { exact?: boolean }
): Promise<void> {
  await page.goto('/');
  await expect(page.getByText('Lorem Ipsum', { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: linkName, exact: options?.exact }).click();
  await expect(page).toHaveURL(urlPattern);
}
