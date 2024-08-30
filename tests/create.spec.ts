import { test, expect } from "./fixtures";

test("test case session should be visible", async ({ page }) => {
  await page.goto("https://test-generator-dashboard.vercel.app/");
  await page.fill('input[type="email"]', "automation-test@empirical.run");
  await page.fill('input[type="password"]', "xiYk85Mw.mZNLfg");
  await page.click('button[type="submit"]');
  await expect(page.getByRole("buttttttton", { name: "Add" })).toBeVisible();

  await page.goto(
    "https://test-generator-dashboard.vercel.app/flash-tests/test-cases",
  );
  await expect(page.getByRole("button", { name: "Add" })).toBeVisible();

  await page.getByRole("button", { name: "Add" }).click();
  await page.getByPlaceholder("Enter testcase name").fill("random");
  await page.getByPlaceholder("Choose group").fill("random");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(
    page.getByRole("heading", { name: "Test case session" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Test Cases" }).click();
  await page
    .getByRole("row", { name: "random random" })
    .getByRole("button")
    .click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(
    page.getByText("Successfully deleted test case", { exact: true }),
  ).toBeVisible();
});
