import { Page, expect } from '@playwright/test';

/**
 * Asserts that the dashboard app has finished loading by waiting for the
 * "Lorem Ipsum" project name to be visible. This is the seeded project that the
 * dashboard lands on after login, so its presence is a reliable signal that the
 * app shell has hydrated and rendered.
 *
 * `.first()` is used because the project name can appear in more than one place
 * (e.g. the project switcher button and an option list), and `exact: true`
 * avoids matching longer strings like "Lorem Ipsum › Settings".
 *
 * @param page The Playwright page object
 */
export async function expectAppLoaded(page: Page): Promise<void> {
  await expect(page.getByText('Lorem Ipsum', { exact: true }).first()).toBeVisible();
}
