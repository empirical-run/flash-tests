import { expect, Page } from '@playwright/test';

/**
 * Navigates from the home page to a project sidebar link.
 *
 * Starts at '/', waits for the default Lorem Ipsum project to load, clicks the
 * requested sidebar link, and waits for the destination URL.
 *
 * @param page       The Playwright page object
 * @param linkName   The sidebar link's accessible name
 * @param urlPattern The URL pattern expected after navigation
 */
export async function navigateToProjectSidebarLink(
  page: Page,
  linkName: string,
  urlPattern: RegExp,
): Promise<void> {
  await page.goto('/');
  await expect(page.getByText('Lorem Ipsum', { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: linkName, exact: true }).click();
  await expect(page).toHaveURL(urlPattern);
}
