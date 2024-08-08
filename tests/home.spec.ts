import { test, expect } from "./fixtures";
test("has title", async ({ page }) => {
  await page.goto("https://test-generator-dashboard.vercel.app/");
  // Expect a title "to contain" a substring.
  await expect(page.getByText("Welcome to Flash")).toBeVisible();
  await page.close();
});

test("open home page and login components should be visible", async ({
  page,
}) => {
  await page.goto("https://test-generator-dashboard.vercel.app/");
  await expect(
    page.getByText("Enter your email and password to sign in"),
  ).toBeVisible();
  await page.close();
});

test("check for email and password elements again", async ({ page }) => {
  await page.goto("https://test-generator-dashboard.vercel.app/");
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

test("login successful to the application", async ({ page }) => {
  //
  // navigate to https://test-generator-dashboard.vercel.app/ and login with username as "automation-test@empirical.run" and password "xiYk85Mw.mZNLfg"
  //
  await page.goto("https://test-generator-dashboard.vercel.app/");
  await page
    .getByPlaceholder("m@example.com")
    .fill("automation-test@empirical.run");
  await page.getByLabel("Password").fill("xiYk85Mw.mZNLfg");
  await page.getByRole("button", { name: "Sign In" }).click();
});
