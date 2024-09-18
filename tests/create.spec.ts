import { test, expect } from "./fixtures";

test.only("test case session should be visible", async ({ page }) => {
  await page.goto("https://dash.empirical.run");
  await page.fill('input[type="email"]', "automation-test@empirical.run");
  await page.fill('input[type="password"]', "xiYk85Mw.mZNLfg");
  await page.click('button[type="submit"]');
  await expect(page.getByRole("button", { name: "Add" })).toBeVisible();

  await page.goto("https://dash.empirical.runflash-tests/test-cases");
  await expect(page.getByRole("button", { name: "Add" })).toBeVisible();

  await page.getByRole("button", { name: "Add" }).click();
  const uniqueTestName = `test-${Date.now()}`;
  await page.getByPlaceholder("Enter testcase name").fill(uniqueTestName);
  await page.getByPlaceholder("Choose group").fill("random");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText(uniqueTestName)).toBeVisible();
  await page.getByRole("link", { name: "Test Cases" }).click();
  await page
    .getByRole("row", { name: `random ${uniqueTestName}` })
    .getByRole("button")
    .click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(
    page.getByText("Successfully deleted test case", { exact: true }),
  ).toBeVisible();
});
