import { test, expect } from "./fixtures";

test.describe("Analytics Page", () => {
  test("clicking on failed test opens test run", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
    
    // Navigate to Analytics section from sidebar
    await page.getByRole('link', { name: 'Analytics' }).click();
    
    // Wait for analytics page to load
    await expect(page).toHaveURL(/analytics/);
    
    // TODO(agent on page): Hover on one of the red boxes on the analytics page, assert that a tooltip with test run id is shown, then click the red box
  });
});
