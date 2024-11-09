import { test, expect } from "./fixtures";

//test 2

test.describe("describe 1", () => {
  // this is an example describe block serial mode testing
  test.describe.configure({ mode: "serial" });
  test.describe("describe 2", () => {
    test("has title", async ({ page }) => {
      // Expect a title "to contain" a substring.
      await expect(page.getByText("Welcome to Empirical")).toBeVisible();
    });
  });

  test.describe("describe 3", () => {
    test("has title", async ({ page }) => {
      // Expect a title "to contain" a substring.
      await expect(page.getByText("Welcome to to to Empirical")).toBeVisible();
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

test("logout should work", async ({ loggedInPage }) => {
  await loggedInPage.waitForTimeout(5000);
  await loggedInPage.getByRole("button", { name: "Toggle user menu" }).click();
  await loggedInPage.getByRole("menuitem", { name: "Logout" }).click();
  await expect(
    loggedInPage.getByRole("heading", { name: "Welcome to Empirical" }),
  ).toBeVisible();
});


