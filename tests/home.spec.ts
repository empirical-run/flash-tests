import { test, expect } from "./fixtures";

test.describe("describe 1", () => {
  // this is an example describe block serial mode testing
  test.describe.configure({ mode: "serial" });
  test.describe("describe 2", () => {
    test("has title", async ({ page }) => {
      await page.goto("https://dash.empirical.run");
      // Expect a title "to contain" a substring.
      await expect(page.getByText("Welcome to Empirical")).toBeVisible();
    });
  });

  test.describe("describe 3", () => {
    test("has title", async ({ page }) => {
      await page.goto("https://dash.empirical.run");
      // Expect a title "to contain" a substring.
      await expect(page.getByText("Welcome to to to Empirical")).toBeVisible();
    });
  });
});

test("open home page and login components should be visible", async ({
  page,
}) => {
  await page.goto("https://dash.empirical.run");
  await expect(
    page.getByText("Enter your email and password to sign in"),
  ).toBeVisible();
});

test("login successful to the application", async ({ page }) => {
  await page.goto("https://dash.empirical.run");
  await page
    .getByPlaceholder("m@example.com")
    .fill("automation-test@empirical.run");
  await page.getByLabel("Password").fill("xiYk85Mw.mZNLfg");
  await page.getByRole("button", { name: "Sign In" }).click();
});

test("hello world infra", async ({ page }) => {
  await page.goto("https://dash.empirical.run");
  await page.fill('input[type="email"]', "automation-test@empirical.run");
  await page.fill('input[type="password"]', "xiYk85Mw.mZNLfg");
});
