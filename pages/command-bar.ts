import { Page, Locator, expect } from "@playwright/test";

/**
 * Opens the command bar via the global Ctrl+K shortcut.
 *
 * The shortcut listener is attached after React hydration, so we wait briefly
 * before dispatching a synthetic keydown. Returns the search input locator once
 * it is visible.
 *
 * @param page The Playwright page object
 * @returns The command bar search input locator
 */
export async function openCommandBar(page: Page): Promise<Locator> {
  // Wait for keyboard shortcut listeners to fully register after React hydration.
  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "k",
        ctrlKey: true,
        metaKey: false,
        bubbles: true,
        cancelable: true,
        composed: true,
      }),
    );
  });

  const input = page.getByPlaceholder("Type a command or search...");
  await expect(input).toBeVisible();
  return input;
}
