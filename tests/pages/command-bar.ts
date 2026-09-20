import { Page, Locator, expect } from '@playwright/test';

export interface RecentPageRecord {
  page_id: string;
  project_id: number | null;
  path: string;
  title: string;
  viewed_at: string;
}

/**
 * Opens the command bar via the global Ctrl+K shortcut.
 *
 * The shortcut listener is attached after React hydration, so we wait briefly
 * before dispatching a synthetic keydown (mirrors the existing command-bar
 * tests). Returns the search input locator once it is visible.
 *
 * @param page The Playwright page object
 * @returns The command bar search input locator
 */
export async function openCommandBar(page: Page): Promise<Locator> {
  // Wait for keyboard shortcut listeners to fully register after React hydration.
  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      metaKey: false,
      bubbles: true,
      cancelable: true,
      composed: true,
    }));
  });

  const input = page.getByPlaceholder('Type a command or search...');
  await expect(input).toBeVisible();
  return input;
}

/**
 * Locates the "Recent" command group inside the open command bar.
 *
 * cmdk renders each command group as an element carrying the `cmdk-group`
 * attribute, with a `cmdk-group-heading` child holding the section title.
 */
export function recentGroup(page: Page): Locator {
  return page
    .locator('[cmdk-group]')
    .filter({ has: page.locator('[cmdk-group-heading]', { hasText: /^Recent$/ }) });
}

/**
 * Returns the individual items rendered inside the "Recent" command group, in
 * DOM order (which is newest-first, matching the recent-pages payload).
 */
export function recentGroupItems(page: Page): Locator {
  return recentGroup(page).locator('[cmdk-item]');
}

/**
 * Reads the visible text of every item in the "Recent" group, in order.
 */
export async function getRecentItemTexts(page: Page): Promise<string[]> {
  const items = recentGroupItems(page);
  await expect(items.first()).toBeVisible();
  return (await items.allInnerTexts()).map((text) => text.replace(/\s+/g, ' ').trim());
}

/**
 * Navigates to a registered in-app path and waits until the RecentPageTracker
 * has actually persisted the visit.
 *
 * The tracker debounces recording (~400ms) and cancels a pending write when the
 * pathname changes, so a visit is only recorded once its `PUT /api/recent-pages`
 * fires. Rather than guess with a fixed dwell, we await that request directly,
 * which is deterministic and resilient to slower environments. Only use this for
 * resolvable destinations (registered pages) — the tracker never records
 * unresolvable routes such as `/`, so no write would fire.
 *
 * Returns the persisted record from the PUT response. Its server-generated
 * `viewed_at` is the authoritative ordering signal and, unlike the capped
 * rendered Recent list, cannot be evicted by concurrent activity.
 *
 * @param page The Playwright page object
 * @param path The in-app path to visit (e.g. `/lorem-ipsum/analytics`)
 * @param options Set `waitAfterRecord` false when the caller must inspect the
 * freshly written UI entry immediately and no subsequent write needs spacing.
 */
export async function visitAndRecord(
  page: Page,
  path: string,
  options: { waitAfterRecord?: boolean } = {},
): Promise<RecentPageRecord> {
  const recordWrite = page.waitForResponse(
    (response) =>
      response.url().includes('/api/recent-pages') &&
      response.request().method() === 'PUT',
    { timeout: 15_000 },
  );
  await page.goto(path);
  await expect(page).toHaveURL(new RegExp(escapeRegExp(path)));

  const response = await recordWrite;
  expect(response.ok(), `Expected recent-page write to succeed for ${path}`).toBeTruthy();
  const body = await response.json() as { data: { recent_page: RecentPageRecord } };
  const record = body.data.recent_page;
  expect(record, `Expected recent-page write response to include a record for ${path}`).toBeTruthy();

  if (options.waitAfterRecord !== false) {
    // Space consecutive visits apart so their recorded `viewed_at` timestamps
    // are distinct. This lets callers verify newest-first ordering directly
    // from the authoritative writes without reading the shared 10-item UI list.
    await page.waitForTimeout(1200);
  }

  return record;
}

/**
 * Reloads the current route and verifies that its initial Recent-pages fetch
 * contains the exact record just persisted by `visitAndRecord`.
 *
 * The tracker PUT does not invalidate the already-mounted Recent query. Opening
 * the command bar immediately after that write therefore renders the GET that
 * started before the PUT and can remain stale indefinitely. A reload triggers a
 * fresh GET; matching `viewed_at` (not only the route) proves that this specific
 * write reached the UI hydration payload while keeping the write-to-read window
 * as short as possible for the shared, capped list.
 */
export async function reloadAndHydrateRecentPage(
  page: Page,
  expectedRecord: RecentPageRecord,
): Promise<void> {
  const recentPagesRead = page.waitForResponse(
    (response) =>
      response.url().includes('/api/recent-pages') &&
      response.request().method() === 'GET',
    { timeout: 15_000 },
  );

  await page.reload();

  const response = await recentPagesRead;
  expect(response.ok(), 'Expected Recent pages hydration fetch to succeed').toBeTruthy();
  const body = await response.json() as { data: { recent_pages: RecentPageRecord[] } };
  expect(
    body.data.recent_pages.some(
      (record) =>
        record.page_id === expectedRecord.page_id &&
        record.project_id === expectedRecord.project_id &&
        record.path === expectedRecord.path &&
        record.viewed_at === expectedRecord.viewed_at,
    ),
    `Expected Recent pages hydration to include ${expectedRecord.path} from the latest write`,
  ).toBeTruthy();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
