import { Page, Locator, expect } from '@playwright/test';

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
export async function openCommandBar(page: Page, options: { skipHydrationWait?: boolean } = {}): Promise<Locator> {
  // Wait for keyboard shortcut listeners to fully register after React hydration.
  // Callers already sitting on a fully-hydrated page (e.g. right after
  // visitAndRecord, which dwells ~1.2s) can skip this to minimise the window
  // before reading the Recent group — that list is flooded with foreign Session
  // entries on production and a freshly recorded entry only survives near the top
  // for a very short time (see the command-bar-recent-pages memory).
  if (!options.skipHydrationWait) {
    await page.waitForTimeout(1500);
  }

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
 * @param page The Playwright page object
 * @param path The in-app path to visit (e.g. `/lorem-ipsum/analytics`)
 */
export async function visitAndRecord(page: Page, path: string): Promise<void> {
  const recordWrite = page.waitForResponse(
    (response) =>
      response.url().includes('/api/recent-pages') &&
      response.request().method() === 'PUT',
    { timeout: 15_000 },
  );
  await page.goto(path);
  await expect(page).toHaveURL(new RegExp(escapeRegExp(path)));
  await recordWrite;
  // Space consecutive visits apart so their recorded `viewed_at` timestamps are
  // distinct, which keeps the newest-first ordering in the Recent group
  // deterministic (back-to-back writes could otherwise tie).
  await page.waitForTimeout(1200);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
