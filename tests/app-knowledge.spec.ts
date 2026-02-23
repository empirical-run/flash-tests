import { test, expect } from "./fixtures";

test.describe("App Knowledge", () => {
  test("navigate to app knowledge page", async ({ page }) => {
    await page.goto("/lorem-ipsum/app-knowledge");
    await expect(page.getByText("Knowledge Files").first()).toBeVisible();
    // Take a screenshot to understand the UI
    await expect(page).toHaveURL(/app-knowledge/);
  });
});
