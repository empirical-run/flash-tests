import { Page } from '@playwright/test';

const SETTINGS_ROUTES: Record<string, string> = {
  'repository': '/lorem-ipsum/settings',
  'repo': '/lorem-ipsum/settings',
  'environments': '/lorem-ipsum/settings/environments',
  'environment variables': '/lorem-ipsum/settings/environment-variables',
  'branches': '/lorem-ipsum/settings/branches',
  'sandbox snapshots': '/lorem-ipsum/settings/sandbox-snapshots',
  'reporters': '/lorem-ipsum/settings/reporters',
  'slack channels': '/lorem-ipsum/settings/slack-channels',
  'requests': '/lorem-ipsum/settings/requests',
  'api keys': '/lorem-ipsum/settings/api-keys',
  'webhooks': '/lorem-ipsum/settings/webhooks',
  'profile': '/lorem-ipsum/settings/profile',
  'team': '/lorem-ipsum/settings/team',
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
export async function navigateToSettings(
  page: Page,
  section: string,
  _options?: { exact?: boolean }
): Promise<void> {
  const route = SETTINGS_ROUTES[section.toLowerCase()];
  if (!route) {
    throw new Error(`Unknown settings section: ${section}`);
  }

  await page.goto(route);
}
