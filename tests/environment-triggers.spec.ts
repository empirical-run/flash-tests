import { test, expect } from "./fixtures";

test.describe("Environment Triggers", () => {
  test("two environments should not have overlapping cron triggers", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
    
    // Navigate to Environments (expand Settings menu first)
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Environments' }).click();
    
    // Wait for the environments table to load
    await expect(page.getByRole('row').filter({ hasText: /Active|Disabled/ }).first()).toBeVisible();
    
    // TODO(agent on page): Click on the first environment row to view its details
  });
});
