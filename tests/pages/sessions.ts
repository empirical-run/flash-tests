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
