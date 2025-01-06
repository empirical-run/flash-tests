import { test, expect } from "./fixtures";

test("Session name falls back to test name", async ({ loggedInPage }) => {
  // Reason: Case 2 was chosen because the test case scenario did not mention specific page navigation, and other tests in the same file that use the loggedInPage fixture do not add separate steps for navigation.

  await loggedInPage
    .getByRole("row", { name: "login.spec.ts ability to" })
    .getByRole("button")
    .click();
  await loggedInPage.getByRole("menuitem", { name: "Edit" }).click();
  await expect(
    loggedInPage.getByRole("button", { name: "Send" }),
  ).toBeVisible();
  await expect(
    loggedInPage.getByRole("link", { name: "ability to login with correct" }),
  ).toBeVisible();
});
