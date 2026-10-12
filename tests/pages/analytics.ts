import { Locator, Page, Request, Response, expect } from '@playwright/test';
import { openHistoryBoxDetails } from './history-box';

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

export type HistoryEntry = {
  test_run_id: string;
  environment_id: string;
  status: "pass" | "fail" | "flaky" | "skip";
};

/** Observe actual UI requests, without replaying credentials or substituting API data for UI proof. */
export function observeAnalyticsHistory(page: Page) {
  const responses: Response[] = [];
  const completed = new Set<Request>();
  const onFinished = (request: Request) => completed.add(request);
  const onResponse = (response: Response) => {
    if (new URL(response.url()).pathname === '/api/v2/analytics/test-case-history/batch' &&
        response.request().method() === 'POST') {
      responses.push(response);
    }
  };
  page.on('response', onResponse);
  page.on('requestfinished', onFinished);
  return {
    stop() {
      page.off('response', onResponse);
      page.off('requestfinished', onFinished);
    },
    async read(testId: string, environmentId?: string, timeoutMs = 15000): Promise<HistoryEntry[]> {
      const deadline = Date.now() + timeoutMs;
      const matches = () => responses.filter(response => {
        const request = response.request().postDataJSON();
        return request.test_case_ids?.includes(testId) &&
          String(request.environment_id ?? '') === (environmentId ?? '');
      });
      await expect.poll(() => matches().length, { message: 'Scoped Analytics history response must arrive', timeout: Math.max(1, deadline - Date.now()) }).toBeGreaterThan(0);
      const response = matches().pop()!;
      await expect.poll(() => completed.has(response.request()), {
        message: 'History response must complete',
        timeout: Math.max(1, deadline - Date.now()),
      }).toBe(true);
      expect(response.status(), 'History API must be healthy').toBe(200);
      const body = await response.json();
      const entries = body.data.history_by_test_case_id[testId];
      expect(Array.isArray(entries)).toBe(true);
      return entries;
    },
  };
}

/** The link also includes file/tags, so anchor identity in its exact test-name span. */
export function analyticsTestCaseRow(page: Page, testCaseName: string): Locator {
  return page.getByRole('row').filter({
    has: page.getByRole('link').filter({ has: page.getByText(testCaseName, { exact: true }) }),
  });
}

export async function analyticsRowTestId(page: Page, testCaseName: string): Promise<string> {
  const row = analyticsTestCaseRow(page, testCaseName);
  await expect(row).toHaveCount(1);
  const link = row.getByRole('link').filter({ has: page.getByText(testCaseName, { exact: true }) });
  await expect(link).toHaveAttribute('href', /\/test-cases\/[a-f0-9-]+$/);
  const pathname = new URL((await link.getAttribute('href'))!, page.url()).pathname;
  const testId = pathname.split('/test-cases/')[1];
  expect(testId).toMatch(/^[a-f0-9]{20}-[a-f0-9]{20}$/);
  return testId;
}

/**
 * Retain the four-minute ingestion budget and existing refresh cadence. Reload
 * only while the actual, scoped UI history response omits the owned run. Once
 * the API contains it, require its rendered button without a reload-to-pass.
 */
export async function waitForRunInTestCaseHistory(
  page: Page,
  options: {
    runId: number;
    testCaseName: string;
    history: ReturnType<typeof observeAnalyticsHistory>;
    timeoutMs?: number;
    pollIntervalMs?: number;
  },
): Promise<void> {
  const { runId, testCaseName, history, timeoutMs = 240000, pollIntervalMs = 18000 } = options;
  const testId = await analyticsRowTestId(page, testCaseName);
  const environmentId = new URL(page.url()).searchParams.get('environment');
  expect(environmentId, 'History must be scoped to the selected environment').toBeTruthy();
  const row = analyticsTestCaseRow(page, testCaseName);
  const expectedRunBox = row.getByRole('button', { name: `Run #${runId}: Failed`, exact: true });
  const deadline = Date.now() + timeoutMs;

  await expect.poll(async () => {
    const entries = await history.read(testId, environmentId!, Math.max(1, deadline - Date.now()));
    const ownedRun = entries.find(entry => Number(entry.test_run_id) === runId);
    if (!ownedRun) {
      await page.reload();
      return false;
    }
    expect(String(ownedRun.environment_id)).toBe(environmentId);
    expect(ownedRun.status).toBe('fail');
    // Healthy API data must render in this same row; do not rescue a UI defect
    // with another reload, and do not extend the ingestion deadline.
    await expect(expectedRunBox).toBeVisible({ timeout: Math.max(1, deadline - Date.now()) });
    return true;
  }, {
    message: `Run #${runId} did not appear in the history for "${testCaseName}" within ${timeoutMs / 60000} minutes`,
    timeout: timeoutMs,
    intervals: [pollIntervalMs],
  }).toBe(true);

  history.stop();
  await openHistoryBoxDetails(page, expectedRunBox, { runId, testId, status: 'Failed' });
}
