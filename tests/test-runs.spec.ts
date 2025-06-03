import { test, expect } from "./fixtures";

test.describe("Test Runs Page", () => {
  test("submit button is not disabled when triggering test run", async ({ page }) => {
    // Navigate to test runs page
    await page.goto("/");
    
    // Navigate to Test Runs section
    await page.getByRole('link', { name: 'Test Runs' }).click();
    
    // Click "New Test Run" button to open the trigger dialog
    await page.getByRole('button', { name: 'New Test Run' }).click();
    
    // Click the environment dropdown to open it
    await page.getByLabel('Environment').click();
    
    // Wait for dropdown to open and try clicking on any dropdown option
    // Using a generic approach since the specific selectors aren't working
    await page.locator('[cmdk-item]').first().click();
    
    // Verify that the "Trigger Test Run" button is not disabled after selecting environment
    const triggerButton = page.getByRole('button', { name: 'Trigger Test Run' });
    await expect(triggerButton).toBeVisible();
    await expect(triggerButton).not.toBeDisabled();
  });
});