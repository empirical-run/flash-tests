import { test, expect } from "./fixtures";

test("test case session should be visible for already added test", async ({
  page,
}) => {
  await page.goto("https://test-generator-dashboard.vercel.app/");
  await page.fill('input[type="email"]', "automation-test@empirical.run");
  await page.fill('input[type="password"]', "xiYk85Mw.mZNLfg");
  await page.click('button[type="submit"]');
  await expect(page.getByRole("button", { name: "Add" })).toBeVisible();

  await page
    .getByRole("link", { name: "Import new wallet using keplr" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Test case session" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
});
