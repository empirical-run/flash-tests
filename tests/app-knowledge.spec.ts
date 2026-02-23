import { test, expect } from "./fixtures";

test.describe("App Knowledge", () => {
  test("explore add knowledge file form", async ({ page }) => {
    await page.goto("/lorem-ipsum/app-knowledge");
    await expect(page.getByText("Knowledge Files").first()).toBeVisible();
    
    // Click the "+" button to add a new knowledge file
    await page.getByRole('button', { name: '+' }).click();
    
    // Take screenshot to understand the form
    await expect(page.locator('body')).toBeVisible();
  });
});
