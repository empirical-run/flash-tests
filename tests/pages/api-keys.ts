import { Page, expect } from '@playwright/test';

/**
 * Creates a new API key via the "Generate New Key" modal.
 * Clicks the button, fills in the name, generates the key, and closes the modal with "Done".
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
 * Deletes an API key by clicking its row's delete button, confirming by typing the
 * key name, and clicking "Delete Permanently". Verifies the row is removed from the table.
 *
 * Assumes the page is already on the API Keys settings page with the key row visible.
 *
 * @param page       The Playwright page object
 * @param apiKeyName The exact name of the API key to delete
 */
export async function deleteApiKey(page: Page, apiKeyName: string): Promise<void> {
  const keyRow = page.getByRole('row').filter({ hasText: apiKeyName });
  await keyRow.getByRole('button').last().click();
  const confirmationField = page.getByPlaceholder(apiKeyName, { exact: false });
  await confirmationField.fill(apiKeyName);
  await page.getByRole('button', { name: 'Delete Permanently' }).click();
  await expect(page.locator('tbody').getByText(apiKeyName)).not.toBeVisible();
}
