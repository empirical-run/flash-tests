import { test, expect } from "../fixtures";

test.describe("Playwright.dev", () => {
  test("visit playwright.dev and click Get Started button", async ({ page }) => {
    await page.goto("https://playwright.dev");

    await page.getByRole("link", { name: "Get started" }).click();

    await expect(page).toHaveURL(/intro/);
    await expect(page.getByRole("heading", { name: "Installation" })).toBeVisible();
  });
});
