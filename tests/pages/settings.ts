import { Page } from '@playwright/test';

/**
 * Navigates to a specific section within the Settings page.
 * Goes to '/', clicks the Settings nav link, then clicks the specified sub-section link.
 *
 * Assumes the user is already logged in (auth state is set up).
 *
 * @param page    The Playwright page object
 * @param section The name of the settings sub-section to navigate to
 *                (e.g. 'API Keys', 'Environment variables', 'Integrations', 'General')
 * @param options Optional link matching options (e.g. { exact: true })
 */
export async function navigateToSettings(
  page: Page,
  section: string,
  options?: { exact?: boolean }
): Promise<void> {
  await page.goto('/');
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('link', { name: section, exact: options?.exact }).click();
}

/**
 * Creates a new API key via the Settings > API Keys UI.
 * Opens the "Generate New Key" modal, fills in the name, generates the key, and closes the modal.
 *
 * Assumes the page is already on the API Keys settings page.
 *
 * @param page The Playwright page object
 * @param name The name to give the new API key
 */
export async function createApiKey(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Generate New Key' }).click();
  await page.getByPlaceholder('e.g. Production API Key').fill(name);
  await page.getByRole('button', { name: 'Generate' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
}
