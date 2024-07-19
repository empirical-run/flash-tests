import { test, expect } from "@playwright/test";

test("has title", async ({ page }) => {
  await page.goto("https://test-generator-dashboard.vercel.app/");
  // Expect a title "to contain" a substring.
  await expect(page.getByText("Welcome to Flash")).toBeVisible();
  await page.close();
});

test("open home page and login components should be visible", async ({
  page,
}) => {
  await page.goto("https://test-generator-dashboard.vercel.app/");
  await expect(
    page.getByText("Enter your email and password to sign in"),
  ).toBeVisible();
  await page.close();
});

test("check for email and password elements again", async ({ page }) => {
  await page.goto("https://test-generator-dashboard.vercel.app/");
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

test("merge this pr", async ({ page }) => {
  //
  // login to flash dashboard, open a testcase, press the three dots next to view, and then click that to see Merge PR option, click it, confirm and check that the pr gets merged
  //
});
