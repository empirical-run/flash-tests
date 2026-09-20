import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
import {
  openCommandBar,
  recentGroupItems,
  getRecentItemTexts,
  visitAndRecord,
} from "./pages/command-bar";
import { getApiWorkerAuthHeaders } from "./pages/api-auth";
import { getApiBaseUrl } from "./pages/urls";

const PROJECT_SLUG = 'lorem-ipsum';

/**
 * Fetches an accessible, completed test run for the Lorem Ipsum project so we
 * can exercise a project-scoped detail route in the Recent group.
 */
async function getAccessibleTestRunId(page: Page): Promise<number> {
  const headers = await getApiWorkerAuthHeaders(page);
  const response = await page.request.get(
    `${getApiBaseUrl()}/api/test-runs?project_id=${process.env.LOREM_IPSUM_PROJECT_ID}&per_page=100&page=1&interval_in_days=30`,
    { headers },
  );
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  const items = data.data.test_runs.items as any[];
  const run = items.find((item) => item.state === 'ended' && item.total_count > 0);
  expect(run, 'Expected an accessible completed test run for Lorem Ipsum').toBeTruthy();
  return run.id;
}

/**
 * Opens the command bar and polls the Recent group until `predicate` holds.
 *
 * The per-user recent list is shared and eventually-consistent (optimistic UI +
 * backend refetch), and other activity for the same signed-in user can add
 * entries concurrently. Polling absorbs that settling; asserting a freshly
 * visited page while it is still the newest entry keeps checks robust against
 * the 10-item cap.
 */
async function expectRecent(
  page: Page,
  predicate: (texts: string[]) => boolean,
  message: string,
  options: { skipHydrationWait?: boolean } = {},
): Promise<void> {
  await openCommandBar(page, options);
  await expect
    .poll(async () => predicate(await getRecentItemTexts(page)), { timeout: 10_000, message })
    .toBeTruthy();
}

async function closeCommandBar(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(page.getByPlaceholder('Type a command or search...')).toBeHidden();
}

test.describe('Command Bar', () => {
  test('Search and navigate to settings via command bar', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for the main content to be fully loaded
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    
    // Open the command bar and wait explicitly for its input to be visible.
    const commandBarInput = await openCommandBar(page);

    // Include the project name so the shared user's many stale projects do not
    // make every project's settings pages match. Keep a generous action timeout
    // while the large command list finishes rendering.
    await commandBarInput.fill('lorem settings', { timeout: 45_000 });
    
    // Wait for the settings option to be visible. Scope to the "Projects" group
    // and use exact match: the command bar now also lists nested settings
    // sub-pages (e.g. "Lorem Ipsum › Settings › Profile") and can surface the
    // same "Lorem Ipsum › Settings" entry in the "Recent" group, both of which
    // would otherwise trigger a strict-mode violation.
    await expect(
      page.getByLabel('Projects').getByText('Lorem Ipsum › Settings', { exact: true }),
    ).toBeVisible();
    
    // Press Enter to select the first result
    await commandBarInput.press('Enter');
    
    // Verify we're navigated to the settings page
    await expect(page).toHaveURL(/settings/);
  });
});

// These tests exercise the per-user "Recent" destinations feature via the
// command bar. They mutate the shared per-user recent list, so run them
// serially to avoid the two tests racing each other's state.
test.describe('Command Bar - Recent pages', () => {
  test.describe.configure({ mode: 'serial' });

  // NOTE ON ROBUSTNESS: the Recent group is capped at 10 items and this per-user
  // list is shared and mutated concurrently — during a full suite run (and on the
  // busy production instance generally) many foreign Session / Test Run entries
  // for the same signed-in user land within seconds and evict older entries.
  // Ordering checks therefore use the server-generated timestamps returned by
  // each PUT. UI checks require only the just-written entry and never compare two
  // entries that both need to survive in the shared rendered list.
  test('records visited destinations in the Recent group, newest-first, with useful labels', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    const testRunId = await getAccessibleTestRunId(page);

    // 1) Verify newest-first ordering from the two authoritative writes rather
    // than requiring both entries to coexist in the shared, capped UI list.
    const analyticsRecord = await visitAndRecord(page, `/${PROJECT_SLUG}/analytics`);
    const memoriesRecord = await visitAndRecord(page, `/${PROJECT_SLUG}/memories`);
    expect(memoriesRecord.path).toBe('/memories');
    expect(Date.parse(memoriesRecord.viewed_at)).toBeGreaterThan(Date.parse(analyticsRecord.viewed_at));

    // 2) A nested settings page must be recorded under its specific registry
    // id/path and never persist the temporary generic "Empirical" document title.
    // Assert the write itself: this entry can be evicted before the command bar's
    // shared list renders, which made the previous UI-label assertion flaky.
    const webhooksRecord = await visitAndRecord(page, `/${PROJECT_SLUG}/settings/webhooks`);
    expect(webhooksRecord.page_id).toBe('settings-webhooks');
    expect(webhooksRecord.path).toBe('/settings/webhooks');
    expect(webhooksRecord.title).not.toBe('Empirical');

    // 3) A test-run detail is recorded after Webhooks, with a useful label, and
    // is selectable straight from Recent. Ordering and label correctness come
    // from the PUT response, so neither assertion depends on the item surviving
    // concurrent eviction. We still open the command bar immediately (without
    // the normal post-write delay) to validate the fresh UI entry is clickable.
    const testRunRecord = await visitAndRecord(
      page,
      `/${PROJECT_SLUG}/test-runs/${testRunId}`,
      { waitAfterRecord: false },
    );
    expect(testRunRecord.path).toBe(`/test-runs/${testRunId}`);
    expect(testRunRecord.title).toContain(String(testRunId));
    expect(testRunRecord.title).not.toBe('Empirical');
    expect(Date.parse(testRunRecord.viewed_at)).toBeGreaterThan(Date.parse(webhooksRecord.viewed_at));
    await expectRecent(
      page,
      (texts) => texts.some((text) => text.includes(String(testRunId))),
      'The exact test-run detail should appear in Recent with its run id',
      { skipHydrationWait: true },
    );
    await recentGroupItems(page)
      .filter({ hasText: new RegExp(`\\b${testRunId}\\b`) })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`/${PROJECT_SLUG}/test-runs/${testRunId}(?:[/?#]|$)`));
  });

  test('recent destinations persist across reload for the same signed-in user', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    await visitAndRecord(page, `/${PROJECT_SLUG}/analytics`);
    await visitAndRecord(page, `/${PROJECT_SLUG}/memories`);

    // Reload the current page and confirm the JUST-VISITED (newest) destination
    // is re-fetched and still present for the same signed-in user. We only assert
    // the newest entry (Memories): the Recent list is capped at 10 and shared +
    // heavily mutated by concurrent activity on production, so requiring an older
    // entry (Analytics) to co-survive the cap is fragile (see the
    // command-bar-recent-pages memory). Persistence is proven by the newest
    // entry being re-fetched from the backend after a full reload.
    await page.reload();
    await expectRecent(
      page,
      (texts) => texts.some((t) => /Memories/.test(t)),
      'Memories (newest visited) should persist in Recent after reload',
    );
    await closeCommandBar(page);
  });
});
