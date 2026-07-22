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
export async function openCommandBar(page: Page): Promise<Locator> {
  // Wait for keyboard shortcut listeners to fully register after React hydration
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
 * Navigates to an in-app path and waits long enough for the RecentPageTracker
 * to persist the visit.
 *
 * The tracker debounces recording (~400ms) and cancels a pending write when the
 * pathname changes, so we must dwell on each page before navigating away,
 * otherwise the visit is never recorded. We also wait for the document title to
 * settle so recent entries capture a meaningful title where available.
 *
 * @param page The Playwright page object
 * @param path The in-app path to visit (e.g. `/lorem-ipsum/analytics`)
 */
export async function visitAndRecord(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page).toHaveURL(new RegExp(escapeRegExp(path)));
  // Dwell so the debounced recorder fires and the PUT to /api/recent-pages
  // completes before we navigate elsewhere.
  await page.waitForTimeout(1800);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
