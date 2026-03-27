import { Page, expect } from '@playwright/test';

/**
 * Navigates to the Sessions page from the home page.
 * Starts at '/', waits for the app to load, clicks the Sessions nav link,
 * and waits for the sessions list URL.
 *
 * Assumes the user is already logged in (auth state is set up).
 *
 * @param page The Playwright page object
 */
export async function navigateToSessions(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByText('Lorem Ipsum', { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Sessions', exact: true }).click();
  await expect(page).toHaveURL(/sessions$/);
}

/**
 * Creates a new session from the Sessions page by clicking the + button,
 * filling in the initial prompt, and clicking Create.
 *
 * Assumes the page is already on the Sessions page.
 *
 * @param page   The Playwright page object
 * @param prompt The initial prompt to fill in
 */
export async function createSession(page: Page, prompt: string): Promise<void> {
  await page.locator('button:has(svg.lucide-plus)').click();
  await page.getByPlaceholder('Enter an initial prompt').fill(prompt);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page).toHaveURL(/sessions/);
}

/**
 * Filters the sessions list by a specific user via the Filters panel.
 * Opens the Filters panel, unchecks "Last 30 days only", selects the given user
 * from the "Created by" dropdown, closes the popover, and verifies the active
 * filter badge shows "Filters 1".
 *
 * Assumes the page is already on the Sessions page.
 *
 * @param page     The Playwright page object
 * @param userName The display name of the user to filter by (e.g. 'Arjun Attam')
 */
export async function filterSessionsByUser(page: Page, userName: string): Promise<void> {
  await page.getByRole('button', { name: 'Filters' }).click();
  await page.getByRole('checkbox', { name: 'Last 30 days only' }).click();
  await page.getByRole('button', { name: 'All users' }).click();
  await expect(page.getByRole('option', { name: '(Select All)' })).toBeVisible();
  await page.getByRole('option', { name: userName }).click();
  await page.locator('body').click({ position: { x: 800, y: 400 } });
  await expect(page.getByRole('button', { name: /Filters 1/ })).toBeVisible();
}

/**
 * Closes the current session via the dropdown menu next to the "Review" button.
 * Opens the chevron dropdown, clicks "Close Session", and confirms the action.
 *
 * Assumes the page is already on the session detail page.
 *
 * @param page The Playwright page object
 */
export async function closeSession(page: Page): Promise<void> {
  await page.getByRole('button').filter({ hasText: 'Review' }).locator('..').locator('.lucide-chevron-down').click();
  await page.getByRole('menuitem', { name: 'Close Session' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
}
