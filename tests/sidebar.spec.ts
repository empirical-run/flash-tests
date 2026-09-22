import { test, expect } from "./fixtures";

test.describe("Sidebar Navigation", () => {
  test("overflow menu exposes secondary navigation links", async ({ page }) => {
    // Navigate to a project page where the new app shell is rendered.
    await page.goto("/lorem-ipsum");

    // Repository is always available in the persistent top navigation, while
    // less frequently used destinations remain in the More overflow menu.
    await expect(
      page
        .getByRole("banner")
        .getByRole("link", { name: "Repository", exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: "More" }).click();
    await expect(
      page.getByRole("menuitem", { name: "Settings" }),
    ).toBeVisible();

    await page.getByRole('menuitem', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/lorem-ipsum\/settings/);
    await expect(page.locator('main').getByText('Repository', { exact: true }).first()).toBeVisible();
  });
});
