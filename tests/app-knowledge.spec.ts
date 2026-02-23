import { test, expect } from "./fixtures";

test.describe("App Knowledge", () => {
  test("explore add knowledge file form", async ({ page }) => {
    await page.goto("/lorem-ipsum/app-knowledge");
    await expect(page.getByText("Knowledge Files").first()).toBeVisible();
    
    // Click the "+" button to add a new knowledge file
    // The button is next to "Knowledge Files" heading
    await page.getByText('Knowledge Files').locator('..').getByRole('button').click();
    
    // Pause to take a screenshot of the form
    await expect(page.locator('body')).toBeVisible();
  });
});
