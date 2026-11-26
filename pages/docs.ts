import { expect, Locator, Page } from "@playwright/test";

/**
 * Opens the docs search dialog and returns its input. The "Search..." button
 * (accessible name "Search... Ctrl K") renders before the docs site hydrates,
 * and a click that lands earlier does nothing, so retry the click until the
 * dialog's input shows.
 */
export async function openDocsSearch(page: Page): Promise<Locator> {
  const searchInput = page.getByRole("combobox", { name: "Search..." });
  await expect(async () => {
    await page.getByRole("button", { name: /^Search\.\.\./ }).click();
    await expect(searchInput).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
  return searchInput;
}
