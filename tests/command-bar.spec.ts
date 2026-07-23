import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
import {
  openCommandBar,
  recentGroupItems,
  getRecentItemTexts,
  visitAndRecord,
} from "./pages/command-bar";

const PROJECT_SLUG = 'lorem-ipsum';

/**
 * Fetches an accessible, completed test run for the Lorem Ipsum project so we
 * can exercise a project-scoped detail route in the Recent group.
 */
async function getAccessibleTestRunId(page: Page): Promise<number> {
  const response = await page.request.get(
    `/api/test-runs?project_id=${process.env.LOREM_IPSUM_PROJECT_ID}&per_page=100&page=1&interval_in_days=30`,
    { headers: { 'x-project-slug': 'lorem-ipsum' } },
  );
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  const items = data.data.test_runs.items as any[];
  const run = items.find((item) => item.state === 'ended' && item.total_count > 0);
  expect(run, 'Expected an accessible completed test run for Lorem Ipsum').toBeTruthy();
  return run.id;
}

function firstIndex(texts: string[], pattern: RegExp): number {
  return texts.findIndex((text) => pattern.test(text));
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
): Promise<void> {
  await openCommandBar(page);
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
    
    // Wait for keyboard shortcut listeners to fully register after React hydration
    await page.waitForTimeout(1500);
    
    // Dispatch Ctrl+K keyboard event to open the command bar
    await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        metaKey: false,
        bubbles: true,
        cancelable: true,
        composed: true
      }));
    });
    
    // Wait for command bar to be visible
    const commandBarInput = page.getByPlaceholder('Type a command or search...');
    
    // Type "settings" in the command bar
    await commandBarInput.fill('settings');
    
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
  // for the same signed-in user land within seconds and evict older entries. So
  // every assertion below depends only on the JUST-visited (newest) entry, which
  // is written last; checks never require an older entry to survive the cap.
  test('records visited destinations in the Recent group, newest-first, with useful labels', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    const testRunId = await getAccessibleTestRunId(page);

    // 1) Newest-first ordering, asserted pairwise and eviction-tolerant: the
    // just-visited page must be present, and appear before the page visited just
    // before it WHEN that older page survives the shared 10-item cap. If foreign
    // concurrent writes evicted the older page, that is still consistent with
    // newest-first (not an ordering bug), so we don't fail on its absence.
    await visitAndRecord(page, `/${PROJECT_SLUG}/analytics`);
    await visitAndRecord(page, `/${PROJECT_SLUG}/memories`);
    await expectRecent(
      page,
      (texts) => {
        const iMemories = firstIndex(texts, /› Memories$/);
        const iAnalytics = firstIndex(texts, /› Analytics$/);
        return iMemories >= 0 && (iAnalytics < 0 || iMemories < iAnalytics);
      },
      'Memories (newer) should appear before Analytics in the Recent group',
    );
    await closeCommandBar(page);

    // 2) A nested settings page must surface with a useful label and never fall
    // back to the temporary generic "Empirical" title.
    await visitAndRecord(page, `/${PROJECT_SLUG}/settings/webhooks`);
    await expectRecent(
      page,
      (texts) => {
        const webhookEntries = texts.filter((text) => /Webhooks/.test(text));
        return webhookEntries.length > 0 && webhookEntries.every((text) => !/Empirical/.test(text));
      },
      'Settings > Webhooks should appear in Recent with a real label (never "Empirical")',
    );
    await closeCommandBar(page);

    // 3) A test-run detail is recorded as its own destination whose label
    // references the run id, and is selectable straight from Recent — returning to
    // the exact detail URL. We navigate away (to memories) before selecting so the
    // click performs a real navigation; the detail is still the newest test-run
    // entry, so this only relies on the just-visited entries surviving.
    await visitAndRecord(page, `/${PROJECT_SLUG}/test-runs/${testRunId}`);
    await visitAndRecord(page, `/${PROJECT_SLUG}/memories`);
    await expectRecent(
      page,
      (texts) => texts.some((text) => text.includes(String(testRunId))),
      'The exact test-run detail should appear in Recent with its run id',
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
