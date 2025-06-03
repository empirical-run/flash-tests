import { test, expect } from "./fixtures";

test.describe("Test Runs Page", () => {
  test("submit button is not disabled when triggering test run", async ({ page }) => {
    // Navigate to test runs page
    await page.goto("/");
    
    // Navigate to Test Runs section
    await page.getByRole('link', { name: 'Test Runs' }).click();
    
    // Click "New Test Run" button to open the trigger dialog
    await page.getByRole('button', { name: 'New Test Run' }).click();
    
    // Wait for environments to load by waiting for the loading text to disappear
    await expect(page.getByText('Loading environments...')).not.toBeVisible();
    
    // Click on the environment dropdown to open it
    await page.getByLabel('Environment').click();
    
    // TODO(agent on page): Select the first available environment option from the dropdown and then verify that the "Trigger Test Run" button is not disabled
  });
});