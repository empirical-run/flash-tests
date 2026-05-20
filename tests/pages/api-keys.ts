import { Page } from '@playwright/test';

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
export async function createApiKey(page: Page, apiKeyName: string): Promise<void> {
  await page.getByRole('button', { name: 'Generate New Key' }).click();
  await page.getByPlaceholder('e.g. Production API Key').fill(apiKeyName);
  await page.getByRole('button', { name: 'Generate' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
}
