import { Page, expect } from '@playwright/test';

/**
 * Navigates to a specific section within the Settings page.
 * Goes to '/', clicks the Settings nav link, then clicks the specified sub-section link.
 *
 * Assumes the user is already logged in (auth state is set up).
 *
 * @param page    The Playwright page object
 * @param section The name of the settings sub-section to navigate to
 *                (e.g. 'Repo', 'Environments', 'Environment variables', 'API keys', 'Notifications', 'Integrations')
 * @param options Optional link matching options (e.g. { exact: true })
 */
/**
 * Deletes an environment variable by name via the Settings > Environment variables UI.
 * Navigates to the env vars settings page, finds the row by name, and confirms deletion.
 * Safe to call even if the variable doesn't exist (no-op).
 */
export async function deleteEnvVar(page: Page, name: string): Promise<void> {
  await navigateToSettings(page, 'Environment variables');
  const row = page.getByRole('row').filter({ hasText: name });
  const rowCount = await row.count();
  if (rowCount === 0) return;
  await row.getByRole('button').last().click();
  await expect(page.getByText('Are you sure you want to delete')).toBeVisible();
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('Are you sure you want to delete')).not.toBeVisible();
}

export async function navigateToSettings(
  page: Page,
  section: string,
  options?: { exact?: boolean }
): Promise<void> {
  await page.goto('/');
  await page.getByRole('link', { name: 'Settings' }).click();
  // Scope to settings sub-nav links (href contains /settings/) to avoid
  // strict mode violations with identically named main nav links (e.g. 'Requests')
  const escapedSection = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matcher = options?.exact ? new RegExp(`^${escapedSection}$`) : section;
  await page.locator('a[href*="/settings"]').filter({ hasText: matcher }).click();
}
