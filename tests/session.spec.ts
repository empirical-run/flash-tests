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

  await loggedInPage.getByRole("link", { name: "sessions" }).click();

  await loggedInPage
    .getByRole("row", {
      name: "automation-test@empirical.run - Awaiting request login.spec.ts ability to login with correct credentials"
    })
    .first()
    .getByRole("button")
    .click();
  await loggedInPage.getByRole("button", { name: "Close session" }).click();
});
