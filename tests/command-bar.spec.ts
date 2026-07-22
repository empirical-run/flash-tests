import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
import {
  openCommandBar,
  recentGroupItems,
  getRecentItemTexts,
  visitAndRecord,
  fetchRecentPagesFromApi,
} from "./pages/command-bar";

const PROJECT_SLUG = 'lorem-ipsum';
const PROJECT_NAME = 'Lorem Ipsum';

/**
 * Fetches an accessible, completed test run for the Lorem Ipsum project so we
 * can exercise a project-scoped detail route in the Recent group.
 */
async function getAccessibleTestRunId(page: Page): Promise<number> {
  const response = await page.request.get(
    `/api/test-runs?project_id=${process.env.LOREM_IPSUM_PROJECT_ID}&per_page=100&page=1&interval_in_days=30`,
  );
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  const items = data.data.test_runs.items as any[];
  const run = items.find((item) => item.state === 'ended' && item.total_count > 0);
  expect(run, 'Expected an accessible completed test run for Lorem Ipsum').toBeTruthy();
  return run.id;
}

function indexOfMatch(texts: string[], pattern: RegExp): number {
  return texts.findIndex((text) => pattern.test(text));
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
    
    // Wait for the settings option to be visible. Use exact match because the
    // command bar now also lists nested settings sub-pages (e.g. "Lorem Ipsum ›
    // Settings › Profile"), which would otherwise trigger a strict-mode violation.
    await expect(page.getByText('Lorem Ipsum › Settings', { exact: true })).toBeVisible();
    
    // Press Enter to select the first result
    await commandBarInput.press('Enter');
    
    // Verify we're navigated to the settings page
    await expect(page).toHaveURL(/settings/);
  });
});

// These tests exercise the per-user "Recent" destinations feature. They mutate
// shared per-user recent-page state, so run them serially to avoid the two
// tests racing each other's recent list.
test.describe('Command Bar - Recent pages', () => {
  test.describe.configure({ mode: 'serial' });

  test('records visited pages in the Recent group and keeps base vs detail routes distinct', async ({ page }) => {
    const projectId = Number(process.env.LOREM_IPSUM_PROJECT_ID);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    const testRunId = await getAccessibleTestRunId(page);

    // Visit several registered pages in a known order. The Recent group is
    // newest-first, so the reverse of this visit order is the expected order.
    await visitAndRecord(page, `/${PROJECT_SLUG}/analytics`);
    await visitAndRecord(page, `/${PROJECT_SLUG}/memories`);
    await visitAndRecord(page, `/${PROJECT_SLUG}/failure-groups`);
    // Nested settings page (requirement: must not fall back to generic "Empirical").
    await visitAndRecord(page, `/${PROJECT_SLUG}/settings/webhooks`);
    // Base list route and an exact detail route, visited back to back.
    await visitAndRecord(page, `/${PROJECT_SLUG}/test-runs`);
    await visitAndRecord(page, `/${PROJECT_SLUG}/test-runs/${testRunId}`);

    // Open the command bar and read the Recent group in order.
    await openCommandBar(page);
    const texts = await getRecentItemTexts(page);
    console.log('DEBUG recent item texts:', JSON.stringify(texts, null, 2));
    console.log('DEBUG api recent pages:', JSON.stringify(await fetchRecentPagesFromApi(page), null, 2));

    // 1) Newest-first ordering among the base pages we visited.
    const iFailure = indexOfMatch(texts, /Failure Groups/);
    const iMemories = indexOfMatch(texts, /Memories/);
    const iAnalytics = indexOfMatch(texts, /Analytics/);
    expect(iFailure, 'Failure Groups should be in the Recent group').toBeGreaterThanOrEqual(0);
    expect(iMemories, 'Memories should be in the Recent group').toBeGreaterThanOrEqual(0);
    expect(iAnalytics, 'Analytics should be in the Recent group').toBeGreaterThanOrEqual(0);
    // failure-groups was visited after memories, which was visited after analytics.
    expect(iFailure).toBeLessThan(iMemories);
    expect(iMemories).toBeLessThan(iAnalytics);

    // 4) Settings > Webhooks appears with a useful label, not the generic "Empirical".
    const webhooksText = texts.find((text) => /Webhooks/.test(text));
    expect(webhooksText, 'Settings > Webhooks should appear in the Recent group').toBeTruthy();
    expect(webhooksText!).not.toMatch(/Empirical/);

    // 2) Base Test Runs list and the exact detail route are distinct entries.
    const apiPages = await fetchRecentPagesFromApi(page);
    const baseEntry = apiPages.find(
      (p) => p.project_id === projectId && p.path === '/test-runs',
    );
    const detailEntry = apiPages.find(
      (p) => p.project_id === projectId && p.path === `/test-runs/${testRunId}`,
    );
    expect(baseEntry, 'Base Test Runs destination should be recorded').toBeTruthy();
    expect(detailEntry, 'Exact test-run detail should be recorded separately').toBeTruthy();

    // Both are also visible as separate items in the command bar.
    const baseItem = recentGroupItems(page).filter({ hasText: /Test Runs/ });
    await expect(baseItem.filter({ hasText: new RegExp(`\\b${testRunId}\\b`) })).toHaveCount(1);
    const baseOnlyItem = texts.filter(
      (text) => /Test Runs/.test(text) && !text.includes(String(testRunId)),
    );
    expect(baseOnlyItem.length, 'Base Test Runs entry should be present and distinct').toBeGreaterThanOrEqual(1);

    // 3) Detail entry carries a useful title or an exact-path fallback that
    // contains the detail id.
    const detailText = texts.find((text) => text.includes(String(testRunId)));
    expect(detailText, 'Detail entry should reference the test-run id').toBeTruthy();

    // Selecting the detail entry returns to the exact detail URL from elsewhere.
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await openCommandBar(page);
    const detailItem = recentGroupItems(page).filter({ hasText: new RegExp(`\\b${testRunId}\\b`) });
    await detailItem.first().click();
    await expect(page).toHaveURL(new RegExp(`/${PROJECT_SLUG}/test-runs/${testRunId}(?:[/?#]|$)`));
  });

  test('recent destinations persist across reload for the same signed-in user', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    await visitAndRecord(page, `/${PROJECT_SLUG}/analytics`);
    await visitAndRecord(page, `/${PROJECT_SLUG}/memories`);

    // Backend has persisted the visits (source of truth, independent of the UI).
    const apiPages = await fetchRecentPagesFromApi(page);
    expect(apiPages.some((p) => p.path === '/analytics')).toBeTruthy();
    expect(apiPages.some((p) => p.path === '/memories')).toBeTruthy();

    // Reload the current page: recent destinations should be re-fetched and
    // still present for the same signed-in user.
    await page.reload();
    await openCommandBar(page);
    const texts = await getRecentItemTexts(page);
    expect(texts.some((text) => /Analytics/.test(text)), 'Analytics should persist after reload').toBeTruthy();
    expect(texts.some((text) => /Memories/.test(text)), 'Memories should persist after reload').toBeTruthy();
  });
});
