import { test, expect } from "./fixtures";

test.describe("Sidebar Navigation", () => {
  test("overflow menu exposes secondary navigation links", async ({ page }) => {
    // Navigate to a project page where the new app shell is rendered.
    await page.goto("/lorem-ipsum");

    // Secondary destinations now live under the More overflow menu.
    await page.getByRole('button', { name: 'More' }).click();
    await expect(page.getByRole('menuitem', { name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Repository' })).toBeVisible();

    await page.getByRole('menuitem', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/lorem-ipsum\/settings/);
    await expect(page.locator('main').getByText('Repository', { exact: true }).first()).toBeVisible();
  });
});
