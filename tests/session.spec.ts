import { test, expect } from "./fixtures";

test("Session name falls back to test name", async ({ loggedInPage }) => {
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

  // Close session to clean up
  await loggedInPage.getByRole("link", { name: "sessions" }).click();
  await loggedInPage
    .getByRole("row", {
      name: "automation-test@empirical.run - Awaiting request login.spec.ts ability to login with correct credentials",
    })
    .first()
    .getByRole("button")
    .click();
  await loggedInPage.getByRole("button", { name: "Close session" }).click();
});

test("Session should be ready to send", async ({ loggedInPage }) => {
  await loggedInPage.getByRole("link", { name: "Sessions" }).click();
  await loggedInPage.getByRole("button", { name: "New Session" }).click();
  await loggedInPage
    .getByRole("button", { name: "Make changes across repository" })
    .click();
  // Assert default environment is loaded
  await expect(
    loggedInPage.locator('button').filter({ hasText: 'Production' })
  ).toBeVisible();
  await expect(
    loggedInPage.getByRole("button", { name: "Send" }),
  ).toBeEnabled();
  // Close session to clean up
  await loggedInPage.getByRole("link", { name: "sessions" }).click();
  await loggedInPage
    .getByRole("row", {
      name: "automation-test@empirical.run - Awaiting request -",
    })
    .last()
    .getByRole("button")
    .click();
  await loggedInPage.getByRole("button", { name: "Close session" }).click();
});
