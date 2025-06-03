import { test, expect } from "./fixtures";

test.describe("Test Runs Page", () => {
  test("submit button is not disabled when triggering test run", async ({ page }) => {
    // Navigate to test runs page
    await page.goto("/");
    
    // Navigate to Test Runs section
    await page.getByRole('link', { name: 'Test Runs' }).click();
    
    // Click "New Test Run" button to open the trigger dialog
    await page.getByRole('button', { name: 'New Test Run' }).click();
    
    // Select an environment to enable the "Trigger Test Run" button
    await page.getByLabel('Environment').click();
    // Wait for dropdown options to appear and select the first one  
    await page.getByText('Select environment').waitFor();
    // Click on any visible environment option in the dropdown
    await page.locator('[data-radix-collection-item]').first().click();
    
    // Verify that the "Trigger Test Run" button is not disabled after selecting environment
    const triggerButton = page.getByRole('button', { name: 'Trigger Test Run' });
    await expect(triggerButton).toBeVisible();
    await expect(triggerButton).not.toBeDisabled();
  });
});