import { test, expect } from "./fixtures";

test.describe("Test Runs Page", () => {
  test("submit button is not disabled when triggering test run", async ({ page }) => {
    // Navigate to test runs page
    await page.goto("/");
    
    // Navigate to Test Runs section
    await page.getByRole('link', { name: 'Test Runs' }).click();
    
    // Click "New Test Run" button to open the trigger dialog
    await page.getByRole('button', { name: 'New Test Run' }).click();
    
    // Wait for environments to load and select one to enable the Trigger Test Run button  
    const environmentDropdown = page.getByLabel('Environment');
    await expect(environmentDropdown).toBeVisible();
    
    // Click the dropdown to open it
    await environmentDropdown.click();
    
    // Wait for and select the first available environment option
    await page.locator('[data-radix-select-content] [data-radix-select-item]').first().click();
    
    // Verify that the "Trigger Test Run" button is not disabled after selecting environment
    const triggerButton = page.getByRole('button', { name: 'Trigger Test Run' });
    await expect(triggerButton).toBeVisible();
    await expect(triggerButton).not.toBeDisabled();
  });
});