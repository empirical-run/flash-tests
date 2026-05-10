import { Page, expect } from '@playwright/test';

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
/**
 * Creates a new API key with the given name.
 * Clicks "Generate New Key", fills in the name, clicks "Generate", then closes the dialog.
 *
 * Assumes the page is already on the API Keys settings page.
 *
 * @param page       The Playwright page object
 * @param apiKeyName The name to assign to the new API key
 */
export async function createApiKey(page: Page, apiKeyName: string): Promise<void> {
  await page.getByRole('button', { name: 'Generate New Key' }).click();
  await page.getByPlaceholder('e.g. Production API Key').fill(apiKeyName);
  await page.getByRole('button', { name: 'Generate' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
}

/**
 * Deletes an API key by name via the confirmation dialog.
 * Finds the row matching the key name, clicks its delete button,
 * fills in the confirmation field with the key name, confirms deletion,
 * and verifies the key is no longer listed.
 *
 * Assumes the page is already on the API Keys settings page.
 *
 * @param page       The Playwright page object
 * @param apiKeyName The exact name of the API key to delete
 */
export async function deleteApiKey(page: Page, apiKeyName: string): Promise<void> {
  const keyRow = page.getByRole('row').filter({ hasText: apiKeyName });
  await keyRow.getByRole('button').last().click();
  const confirmationField = page.locator(`input[placeholder*="${apiKeyName}"]`);
  await confirmationField.fill(apiKeyName);
  await page.getByRole('button', { name: 'Delete Permanently' }).click();
  await expect(page.locator('tbody').getByText(apiKeyName)).not.toBeVisible();
}

export async function navigateToSettings(
  page: Page,
  section: string,
  options?: { exact?: boolean }
): Promise<void> {
  await page.goto('/');
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('link', { name: section, exact: options?.exact }).click();
}
