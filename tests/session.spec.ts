import { test, expect } from "./fixtures";

let sessionName: string | undefined;

test.afterEach(async ({ loggedInPage }) => {
  if (sessionName) {
    await loggedInPage.getByRole("link", { name: "sessions" }).click();
    await loggedInPage
      .getByRole("row", { name: new RegExp(sessionName) })
      .last()
      .getByRole("button")
      .click();
    await loggedInPage.getByRole("button", { name: "Close session" }).click();
    sessionName = undefined;
  }
});

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

  sessionName = "login.spec.ts ability to login with correct credentials";
});

test("Session should be ready to send", async ({ loggedInPage }) => {
  await loggedInPage.getByRole("link", { name: "Sessions" }).click();
  await loggedInPage.getByRole("button", { name: "New Session" }).click();
  await loggedInPage
    .getByRole("button", { name: "Make changes across repository" })
    .click();
  // Assert default environment is loaded
  await expect(
    loggedInPage.locator("button").filter({ hasText: "Production" }),
  ).toBeVisible();
  await expect(
    loggedInPage.getByRole("button", { name: "Send" }),
  ).toBeEnabled();

  sessionName = "automation-test@empirical.run - Awaiting request -";
});
