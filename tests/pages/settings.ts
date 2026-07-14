import { Page, expect } from '@playwright/test';

const DEFAULT_PROJECT_SLUG = 'lorem-ipsum';

export function getProjectSlug(): string {
  return process.env.TEST_PROJECT_SLUG || DEFAULT_PROJECT_SLUG;
}

const SETTINGS_ROUTE_SUFFIXES: Record<string, string> = {
  'repository': '/settings',
  'repo': '/settings',
  'environments': '/settings/environments',
  'environment variables': '/settings/environment-variables',
  'branches': '/settings/branches',
  'sandbox snapshots': '/settings/sandbox-snapshots',
  'reporters': '/settings/reporters',
  'slack channels': '/settings/slack-channels',
  'requests': '/settings/requests',
  'api keys': '/settings/api-keys',
  'webhooks': '/settings/webhooks',
  'profile': '/settings/profile',
  'team': '/settings/team',
};

/**
 * Navigates to a specific section within the Lorem Ipsum Settings page.
 *
 * The new app layout moved Settings into the overflow navigation, so tests should
 * not depend on a top-level Settings link being visible. Direct routing is stable
 * across desktop/mobile shells and keeps the helper focused on reaching the
 * settings section under test.
 *
 * Assumes the user is already logged in (auth state is set up).
 *
 * @param page    The Playwright page object
 * @param section The name of the settings sub-section to navigate to
 *                (e.g. 'Repository', 'Environments', 'Environment variables', 'API Keys', 'Reporters')
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
  _options?: { exact?: boolean }
): Promise<void> {
  // `_options` is intentionally accepted for backwards compatibility with the
  // previous link-clicking implementation, where callers could request exact
  // text matching. Direct routing no longer needs those matching options.
  const routeSuffix = SETTINGS_ROUTE_SUFFIXES[section.toLowerCase()];
  if (!routeSuffix) {
    throw new Error(`Unknown settings section: ${section}`);
  }

  await page.goto(`/${getProjectSlug()}${routeSuffix}`);
}
