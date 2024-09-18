import { test, expect } from "./fixtures";

test("test case session should be visible for already added test", async ({
  page,
}) => {
  await page.goto("https://dash.empirical.run");
  await page.fill('input[type="email"]', "automation-test@empirical.run");
  await page.fill('input[type="password"]', "xiYk85Mw.mZNLfg");
  await page.click('button[type="submit"]');
  await expect(page.getByRole("button", { name: "Add" })).toBeVisible();
  await page
    .getByRole("link", { name: "Import new wallet using keplr" })
    .click();
  await expect(page.getByText("Import new wallet using keplr")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
});
