import { Page, expect } from '@playwright/test';

/**
 * Asserts that the dashboard home page has finished loading by waiting for the
 * project name ("Lorem Ipsum") to be visible.
 *
 * The app renders the project name in multiple places (header, project switcher),
 * so this scopes to the first match to avoid strict-mode violations.
 *
 * Assumes the page has navigated to the app (e.g. after `page.goto('/')`).
 *
 * @param page The Playwright page object
 */
export async function expectHomePageLoaded(page: Page): Promise<void> {
  await expect(page.getByText('Lorem Ipsum', { exact: true }).first()).toBeVisible();
}
