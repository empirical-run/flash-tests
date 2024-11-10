import { test, expect } from "./fixtures";
// this is an example serial file testing #1
test.describe.configure({ mode: "serial" });

test("check for email and password elements again", async ({ page }) => {
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

test("ability to login with correct credentials", async ({
  page,
  userContext,
}) => {
  await page.fill('input[type="email"]', userContext.email);
  await page.fill('input[type="password"]', userContext.password);
  await page.click('button[type="submit"]');
  await expect(page.getByRole("button", { name: "Add" })).toBeVisible();
});
