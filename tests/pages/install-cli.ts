import { Locator, Page, expect } from "@playwright/test";
import { getProjectSlug } from "./settings";

/**
 * Opens the "Install the Empirical CLI" dialog from the header project
 * switcher (workspace menu → Install CLI) on the Lorem Ipsum project dashboard.
 *
 * The trigger is located by its accessible name rather than the shared
 * projectSwitcher() helper: before the header hydrates, the profile menu can be
 * the first dropdown trigger in the banner, so `.first()` may open the wrong
 * menu.
 */
export async function openInstallCliDialog(page: Page): Promise<Locator> {
  await page.goto(`/${getProjectSlug()}`);
  await page
    .getByRole("banner")
    .getByRole("button", { name: "LI Lorem Ipsum", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Install CLI", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Install the Empirical CLI",
  });
  await expect(dialog).toBeVisible();
  return dialog;
}

/**
 * Clicks "Copy command" in the Install CLI dialog, checks the clipboard matches
 * the command shown in the dialog, and returns it. Each dialog open mints a new
 * single-use login code, so read the command from the same open dialog.
 */
export async function copyInstallCliCommand(
  page: Page,
  dialog: Locator,
): Promise<string> {
  const shownCommand = (await dialog.locator("code").innerText()).trim();
  await dialog.getByRole("button", { name: "Copy command" }).click();
  const copiedCommand = await page.evaluate(() =>
    navigator.clipboard.readText(),
  );
  expect(copiedCommand.trim()).toBe(shownCommand);
  return copiedCommand.trim();
}
