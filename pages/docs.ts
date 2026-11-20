import { expect, Locator, Page } from "@playwright/test";

/**
 * Opens the docs search dialog and returns its input. The "Open search"
 * button renders before the docs site hydrates, and a click that lands
 * earlier does nothing, so retry the click until the dialog's input shows.
 */
export async function openDocsSearch(page: Page): Promise<Locator> {
  const searchInput = page.getByRole("combobox", { name: "Search..." });
  await expect(async () => {
    await page.getByRole("button", { name: "Open search" }).click();
    await expect(searchInput).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
  return searchInput;
}
