import { Page, expect } from '@playwright/test';

/**
 * Navigates to the Requests page and creates a new request by filling in the
 * title and description, then clicking Create.
 *
 * Starts at '/', waits for the app to load, clicks the Requests nav link,
 * opens the new-request form, fills in the fields, submits, and verifies the
 * request appears in the sidebar list.
 *
 * @param page        The Playwright page object
 * @param title       The request title
 * @param description The request description
 * @param options     Optional settings (e.g. create as draft)
 */
export async function createRequest(
  page: Page,
  title: string,
  description: string,
  options?: { createAsDraft?: boolean }
): Promise<void> {
  await page.goto('/');
  await expect(page.getByText('Lorem Ipsum', { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Requests' }).click();
  await page.getByRole('heading', { name: 'Requests' }).locator('..').getByRole('button').click();
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Description').fill(description);
  if (options?.createAsDraft) {
    await page.getByRole('switch', { name: 'Create as draft' }).click();
  }
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.locator('.text-sm').filter({ hasText: title }).first()).toBeVisible();
}
