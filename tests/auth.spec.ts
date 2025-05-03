import { test, expect } from "./fixtures";

test("should show unauthorised page for unauthorised urls", async ({
  loggedInPage,
}) => {
  await loggedInPage.goto(
    "https://dash.empirical.run/quizizz-tests/test-cases",
  );
  await expect(
    loggedInPage.getByRole("heading", { name: "Unauthorized" }),
  ).toBeVisible();
  await expect(
    loggedInPage.getByRole("button", { name: "Sign out" }),
  ).toBeVisible();
});

test("should show unauthorized for admin pages", async ({ loggedInPage }) => {
  await loggedInPage.goto("https://dash.empirical.run/admin/debug");
  await expect(
    loggedInPage.getByRole("heading", { name: "Unauthorized" }),
  ).toBeVisible();

  // Also check for /admin/invoices
  await loggedInPage.goto("https://dash.empirical.run/admin/invoices");
  await expect(
    loggedInPage.getByRole("heading", { name: "Unauthorized" }),
  ).toBeVisible();

});

