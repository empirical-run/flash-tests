import { Page, expect } from '@playwright/test';

/**
 * Adds an environment variable via the "Add Variable" modal.
 * Opens the modal, fills in the name and value, optionally scopes the variable
 * to specific environments, and submits by clicking the modal's "Add Variable"
 * button.
 *
 * Assumes the page is already on the Environment Variables settings page.
 *
 * @param page    The Playwright page object
 * @param name    The environment variable name
 * @param value   The environment variable value
 * @param options Optional settings. When `environments` is provided, the
 *                variable is scoped to those specific environments.
 */
export async function addEnvironmentVariable(
  page: Page,
  name: string,
  value: string,
  options?: { environments?: string[] }
): Promise<void> {
  // Click Add Variable button to open the modal
  await page.getByRole('button', { name: 'Add Variable' }).click();

  // Wait for the modal to appear
  await expect(page.getByText('Add Environment Variable')).toBeVisible();

  // Fill in the environment variable name and value
  await page.getByPlaceholder('e.g., DATABASE_URL').fill(name);
  await page.getByPlaceholder('e.g., postgres://...').fill(value);

  // Optionally scope the variable to specific environments
  if (options?.environments?.length) {
    await page.getByRole('radio', { name: 'Specific environments' }).click();
    for (const environment of options.environments) {
      await page.getByRole('checkbox', { name: environment }).check();
    }
  }

  // Save the environment variable by clicking the modal's Add Variable button
  await page.getByRole('dialog').getByRole('button', { name: 'Add Variable' }).click();
}
