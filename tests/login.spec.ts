import { test, expect } from "./fixtures";
// this is an example serial file testing
test.describe.configure({ mode: "serial" });

test("check for email and password elements again", async ({ page }) => {
  await page.goto("https://dash.empirical.run");
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

test("ability to login with correct credentials", async ({ page }) => {
  await page.goto("https://dash.empirical.run");
  await page.fill('input[type="email"]', "automation-test@empirical.run");
  await page.fill('input[type="password"]', "xiYk85Mw.mZNLfg");
  await page.click('button[type="submit"]');
  await expect(page.getByRole("button", { name: "Add" })).toBeVisible();
});
