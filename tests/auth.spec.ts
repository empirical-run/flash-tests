import { test, expect } from "./fixtures";

test("should show unauthorised page for unauthorised urls", async ({
  loggedInPage,
}) => {
  await loggedInPage.goto(`/quizizz-tests/test-cases`);
  await expect(
    loggedInPage.getByRole("heading", { name: "Unauthorized" }),
  ).toBeVisible();
  await expect(
    loggedInPage.getByRole("button", { name: "Sign out" }),
  ).toBeVisible();
});

test("should show unauthorized for admin pages", async ({ loggedInPage }) => {
  await loggedInPage.goto(`/admin/debug`);
  await expect(
    loggedInPage.getByRole("heading", { name: "Unauthorized" }),
  ).toBeVisible();
  // Also check for /admin/invoices
  await loggedInPage.goto(`/admin/invoices`);
  await expect(
    loggedInPage.getByRole("heading", { name: "Unauthorized" }),
  ).toBeVisible();
});
