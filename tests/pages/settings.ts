import { Page } from '@playwright/test';

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
export async function navigateToSettings(
  page: Page,
  section: string,
  options?: { exact?: boolean }
): Promise<void> {
  await page.goto('/');
  await page.getByRole('link', { name: 'Settings' }).click();
  // Scope to settings sub-nav links (href contains /settings/) to avoid
  // strict mode violations with identically named main nav links (e.g. 'Requests')
  const matcher = options?.exact ? new RegExp(`^${section}$`) : section;
  await page.locator('a[href*="/settings"]').filter({ hasText: matcher }).click();
}
