import { Page, expect } from '@playwright/test';

/**
 * Creates a new API key via the Settings > API Keys UI.
 * Clicks "Generate New Key", fills the name, clicks "Generate", then "Done".
 *
 * Assumes the page is already on the Settings > API Keys page.
 *
 * @param page       The Playwright page object
 * @param apiKeyName The name to give the new API key
 */
export async function createApiKey(page: Page, apiKeyName: string): Promise<void> {
  await page.getByRole('button', { name: 'Generate New Key' }).click();
  await page.getByPlaceholder('e.g. Production API Key').fill(apiKeyName);
  await page.getByRole('button', { name: 'Generate' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
}

/**
 * Deletes an API key by name via the Settings > API Keys UI.
 * Clicks the delete button in the key's row, fills the confirmation field with
 * the exact key name, and clicks "Delete Permanently".
 *
 * Assumes the page is already on the Settings > API Keys page.
 *
 * @param page       The Playwright page object
 * @param apiKeyName The exact name of the API key to delete
 */
export async function deleteApiKey(page: Page, apiKeyName: string): Promise<void> {
  const keyRow = page.getByRole('row').filter({ hasText: apiKeyName });
  await keyRow.getByRole('button').last().click();
  await page.getByPlaceholder(apiKeyName).fill(apiKeyName);
  await page.getByRole('button', { name: 'Delete Permanently' }).click();
  await expect(page.getByRole('row').filter({ hasText: apiKeyName })).not.toBeVisible();
}
