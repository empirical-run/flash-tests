import { test, expect } from "./fixtures";

test("ability to login with correct credentials", async ({ page }) => {
  await page.goto("https://test-generator-dashboard.vercel.app/");
  await page.fill('input[type="email"]', "automation-test@empirical.run");
  await page.fill('input[type="password"]', "xiYk85Mw.mZNLfg");
  await page.click('button[type="submit"]');
  await expect(page.getByRole("button", { name: "Add" })).toBeVisible();
});
