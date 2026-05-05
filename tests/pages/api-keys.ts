import { Page, expect } from '@playwright/test';

/**
 * Creates a new API key with the given name via the Generate New Key dialog.
 * Fills in the name, generates the key, and closes the modal.
 *
 * Does NOT copy the key to the clipboard — for tests that need the raw key
 * value, copy it to the clipboard before calling this helper.
 *
 * Assumes the page is already on the API Keys settings page.
 *
 * @param page       The Playwright page object
 * @param apiKeyName The display name to give the new API key
 */
export async function createApiKey(page: Page, apiKeyName: string): Promise<void> {
  await page.getByRole('button', { name: 'Generate New Key' }).click();
  await page.getByPlaceholder('e.g. Production API Key').fill(apiKeyName);
  await page.getByRole('button', { name: 'Generate' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
}

/**
 * Deletes an API key by name from the API Keys settings page.
 * Finds the row with that name, clicks the delete button, types the key name
 * in the confirmation field, confirms the deletion, and verifies the row is gone.
 *
 * Assumes the page is already on the API Keys settings page and that no
 * delete-confirmation dialog is currently open.
 *
 * @param page       The Playwright page object
 * @param apiKeyName The display name of the API key to delete
 */
export async function deleteApiKey(page: Page, apiKeyName: string): Promise<void> {
  const keyRow = page.getByRole('row').filter({ hasText: apiKeyName });
  await keyRow.getByRole('button').last().click();
  const confirmationField = page.locator(`input[placeholder*="${apiKeyName}"]`);
  await confirmationField.fill(apiKeyName);
  await page.getByRole('button', { name: 'Delete Permanently' }).click();
  await expect(page.locator('tbody').getByText(apiKeyName)).not.toBeVisible();
}
