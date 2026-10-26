import { test, expect } from "./fixtures";

test.describe("Sidebar Navigation", () => {
  test("overflow menu exposes secondary navigation links", async ({ page }) => {
    await page.goto("/lorem-ipsum");
    await expect(
      page
        .getByRole("banner")
        .getByRole("link", { name: "Repository", exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: "More", exact: true }).click();
    await expect(
      page.getByRole("menuitem", { name: "Memories", exact: true }),
    ).toBeVisible();
    await page.getByRole("menuitem", { name: "Memories", exact: true }).click();
    await expect(page).toHaveURL(/\/lorem-ipsum\/memories$/);

    // Settings now lives in the user menu and overlays the current destination.
    await page
      .getByRole("button", { name: process.env.AUTOMATED_USER_EMAIL! })
      .click();
    await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
    await expect(page).toHaveURL(/\/lorem-ipsum\/memories#settings\/profile$/);
    const settings = page.getByRole("dialog").filter({
      has: page.getByRole("heading", { name: "Settings", exact: true }),
    });
    await expect(
      settings.getByRole("heading", { name: "Profile", exact: true }),
    ).toBeVisible();
    await settings
      .getByRole("link", { name: "Repository", exact: true })
      .click();
    await expect(page).toHaveURL(
      /\/lorem-ipsum\/memories#settings\/repository$/,
    );
    await expect(
      settings.getByRole("heading", { name: "Repository", exact: true }),
    ).toBeVisible();
    await settings.getByRole("button", { name: "Close", exact: true }).click();
    await expect(settings).toBeHidden();
    await expect(page).toHaveURL(/\/lorem-ipsum\/memories$/);
  });
});
