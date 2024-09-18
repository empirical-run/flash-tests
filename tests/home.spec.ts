import { test, expect } from "./fixtures";

test("has title", async ({ page }) => {
  await page.goto("https://dash.empirical.run");
  // Expect a title "to contain" a substring.
  await expect(page.getByText("Welcome to Empirical")).toBeVisible();
  await page.close();
});

test("open home page and login components should be visible", async ({
  page,
}) => {
  await page.goto("https://dash.empirical.run");
  await expect(
    page.getByText("Enter your email and password to sign in"),
  ).toBeVisible();
  await page.close();
});

test("check for email and password elements again", async ({ page }) => {
  await page.goto("https://dash.empirical.run");
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

test("login successful to the application", async ({ page }) => {
  await page.goto("https://dash.empirical.run");
  await page
    .getByPlaceholder("m@example.com")
    .fill("automation-test@empirical.run");
  await page.getByLabel("Password").fill("xiYk85Mw.mZNLfg");
  await page.getByRole("button", { name: "Sign In" }).click();
});
