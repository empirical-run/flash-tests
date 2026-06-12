import { Page, expect } from '@playwright/test';

/**
 * Builds auth headers for direct API-worker calls using the browser's logged-in
 * session cookie and the configured Lorem Ipsum project id.
 *
 * Assumes the test is running with an authenticated storageState.
 *
 * @param page The Playwright page object
 * @returns Headers accepted by the API worker
 */
export async function getApiWorkerAuthHeaders(page: Page): Promise<Record<string, string>> {
  const cookies = await page.context().cookies();
  const authTokenCookies = cookies
    .filter(cookie => cookie.name.includes('auth-token'))
    .sort((a, b) => a.name.localeCompare(b.name));

  expect(authTokenCookies.length).toBeGreaterThan(0);

  const rawCookieValue = authTokenCookies.map(cookie => cookie.value).join('');
  const encodedSession = decodeURIComponent(rawCookieValue).replace(/^base64-/, '');
  const session = JSON.parse(Buffer.from(encodedSession, 'base64').toString('utf8'));

  expect(session.access_token).toBeTruthy();
  expect(process.env.LOREM_IPSUM_PROJECT_ID).toBeTruthy();

  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
    'x-project-id': process.env.LOREM_IPSUM_PROJECT_ID!,
  };
}
