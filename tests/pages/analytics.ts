import { Page, expect } from '@playwright/test';

/**
 * Navigates to the Analytics page from the home page.
 * Starts at '/', clicks the Analytics nav link, and waits for the analytics URL.
 *
 * Assumes the user is already logged in (auth state is set up).
 *
 * @param page The Playwright page object
 */
export async function navigateToAnalytics(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('link', { name: 'Analytics' }).click();
  await expect(page).toHaveURL(/analytics/);
}

/**
 * Searches the analytics test cases list by typing a query into the
 * "Search tests..." input and submitting with Enter.
 *
 * Supports both plain-text name searches (e.g. 'login') and filter expressions
 * (e.g. 'fail_rate:>50').
 *
 * Assumes the page is already on the Analytics page.
 *
 * @param page  The Playwright page object
 * @param query The search text or filter expression to submit
 */
export async function searchTests(page: Page, query: string): Promise<void> {
  const searchInput = page.getByPlaceholder('Search tests...');
  await searchInput.fill(query);
  await searchInput.press('Enter');
}

/**
 * Filters the Analytics page by a single environment.
 *
 * Opens the environment combobox (defaults to "All environments") and selects
 * the option matching `environmentName`. Waits for the filter to be applied,
 * which the app signals by rendering a "Clear" button.
 *
 * Assumes the page is already on the Analytics page.
 *
 * @param page            The Playwright page object
 * @param environmentName The environment option to select (e.g. 'production')
 */
export async function filterAnalyticsEnvironment(page: Page, environmentName: string): Promise<void> {
  await page.getByRole('combobox').filter({ hasText: 'All environments' }).click();
  await page.getByRole('option', { name: environmentName }).click();
  // The environment filter renders a "Clear" button once applied.
  await expect(page.getByRole('button', { name: 'Clear' })).toBeVisible();
}

/**
 * Polls the Analytics test-case history until a specific test run appears as the
 * most recent history entry for a given test case.
 *
 * Each per-test-case row renders a strip of history boxes (data-testid
 * "pass-box"/"fail-box"), ordered newest-first. Each box is a link whose href
 * points at that run (`/test-runs/<runId>?test_id=...`) and whose tooltip shows
 * "Run #<runId>". Analytics ingestion lags run completion, so this reloads every
 * ~18s (up to ~3 min by default) until the newest box is the expected run, then
 * verifies the tooltip shows the matching run id.
 *
 * Assumes the page is on the Analytics page, already filtered/searched down to
 * the target test case (its row must be visible).
 *
 * @param page    The Playwright page object
 * @param options runId (expected run), testCaseName (row to inspect), and
 *                optional timeoutMs / pollIntervalMs overrides
 */
export async function waitForRunInTestCaseHistory(
  page: Page,
  options: { runId: number; testCaseName: string; timeoutMs?: number; pollIntervalMs?: number },
): Promise<void> {
  const { runId, testCaseName, timeoutMs = 180000, pollIntervalMs = 18000 } = options;

  // Scope to the test case's table row. The row's accessible name includes the
  // test case name, so getByRole('row', { name }) resolves it resiliently and,
  // crucially, excludes the page-level "Test Run History" chart which reuses the
  // same pass-box/fail-box testids (but whose links omit the test_id param).
  const row = page.getByRole('row', { name: testCaseName });
  // History boxes are ordered newest-first, so the first box is the most recent run.
  const mostRecentBox = row.getByTestId('fail-box').or(row.getByTestId('pass-box')).first();

  // Analytics ingestion lags run completion, so poll (reloading each attempt) until
  // the newest history box links to the just-completed run.
  await expect
    .poll(
      async () => {
        const href = await mostRecentBox.getAttribute('href');
        if (href?.includes(`/test-runs/${runId}?`)) {
          return href;
        }
        await page.reload();
        return href;
      },
      {
        message: `Run #${runId} never became the most recent history entry for "${testCaseName}"`,
        timeout: timeoutMs,
        intervals: [pollIntervalMs],
      },
    )
    .toContain(`/test-runs/${runId}?`);

  // Confirm the newest box's tooltip identifies the just-completed run.
  await mostRecentBox.hover();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toBeVisible();
  await expect(tooltip.getByText(`Run #${runId}`, { exact: true })).toBeVisible();
}
