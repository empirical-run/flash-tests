import { Page, expect } from '@playwright/test';

/**
 * Builds the standard headers for requests authenticated with an API key.
 *
 * @param apiKey The API key value to send as a Bearer token
 * @returns Headers for authenticated JSON API requests
 */
export function getApiKeyRequestHeaders(apiKey: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Creates a new API key via the Generate New Key dialog.
 * Clicks "Generate New Key", fills in the name, clicks "Generate", then closes
 * the dialog with "Done".
 *
 * Assumes the page is already on the API Keys settings page.
 *
 * @param page       The Playwright page object
 * @param apiKeyName The name to give the new API key
 */
export async function waitForApiKeysListToLoad(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/settings\/api-keys/);
  await expect(page.getByRole('heading', { name: 'API Keys' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate New Key' })).toBeVisible();
  await expect(page.locator('.animate-pulse')).toHaveCount(0);
}

export async function createApiKey(page: Page, apiKeyName: string): Promise<void> {
  await waitForApiKeysListToLoad(page);
  await page.getByRole('button', { name: 'Generate New Key' }).click();
  await page.getByPlaceholder('e.g. Production API Key').fill(apiKeyName);
  await page.getByRole('button', { name: 'Generate' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
}

/**
 * Deletes an API key by name via the delete confirmation dialog.
 * Clicks the delete button in the key's row, types the key name to confirm,
 * clicks "Delete Permanently", and asserts the key is no longer in the table.
 *
 * Assumes the page is already on the API Keys settings page.
 *
 * @param page       The Playwright page object
 * @param apiKeyName The exact name of the API key to delete
 */
export async function deleteApiKey(page: Page, apiKeyName: string): Promise<void> {
  await page.getByRole('row').filter({ hasText: apiKeyName }).getByRole('button').last().click();
  await page.locator(`input[placeholder*="${apiKeyName}"]`).fill(apiKeyName);
  await page.getByRole('button', { name: 'Delete Permanently' }).click();
  await expect(page.locator('tbody').getByText(apiKeyName)).not.toBeVisible();
}
