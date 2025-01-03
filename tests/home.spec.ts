import { test, expect } from "./fixtures";

//test 2

test.describe("describe 1", () => {
  // this is an example describe block serial mode testing
  test.describe.configure({ mode: "serial" });
  test.describe("describe 2", () => {
    test("has title", async ({ page }) => {
      // Expect the text "Welcome to Empirical" to be visible
      await expect(page.getByText("Welcome to Empirical")).toBeVisible();
      // Assert that the text is exactly "Welcome to Empirical"
      await expect(page.getByText("Welcome to Empirical")).toHaveText(
        "Welcome to Empirical",
      );
    });
  });

  test.describe("describe 3", () => {
    test("has title", async ({ page }) => {
      // Expect a title "to contain" a substring.
      await expect(page.getByText("Welcome to Empirical")).toBeVisible();
    });
  });
});

test("open home page and login components should be visible", async ({
  page,
}) => {
  await expect(
    page.getByText("Enter your email and password to sign in"),
  ).toBeVisible();
});

test.skip("logout should work", async ({ loggedInPage }) => {
  await loggedInPage.waitForTimeout(5000);
  await loggedInPage.getByRole("button", { name: "Toggle user menu" }).click();
  await loggedInPage.getByRole("menuitem", { name: "Logout" }).click();
  await expect(
    loggedInPage.getByRole("heading", { name: "Welcome to Empirical" }),
  ).toBeVisible();
});

test("anonymous user should be redirected to login page", async ({ page }) => {
  await page.goto("https://dash.empirical.run/test-cases");
  await expect(
    page.getByRole("heading", { name: "Welcome to Empirical" }),
  ).toBeVisible();
});

test.skip("Failed Test", async ({ page, userContext }) => {
  await page.fill('input[type="email"]', userContext.email);
  await page.fill('input[type="password"]', userContext.password);
  await page.getByRole("button", { name: "Submit" }).click({ timeout: 3_000 });
});

test.skip("Flaky test", async ({ page, userContext }, testInfo) => {
  await page.fill('input[type="email"]', userContext.email);
  await page.fill('input[type="password"]', userContext.password);
  if (!testInfo.retry) {
    // Only fails on the first run
    throw new Error("Flaky error triggered - fail it!");
  }
});

test("Failing test", async () => {
  throw new Error("This test is intentionally failing");
});
