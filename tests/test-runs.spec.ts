import { test, expect } from "./fixtures";

test.describe("Test Runs Page", () => {
  test("submit button is not disabled when triggering test run", async ({ page }) => {
    // Navigate to test runs page
    await page.goto("/");
    
    // Navigate to Test Runs section
    await page.getByRole('link', { name: 'Test Runs' }).click();
    
    // Click "New Test Run" button to open the trigger dialog
    await page.getByRole('button', { name: 'New Test Run' }).click();
    
    // Verify that the "Trigger Test Run" button is not disabled
    const triggerButton = page.getByRole('button', { name: 'Trigger Test Run' });
    await expect(triggerButton).toBeVisible();
    await expect(triggerButton).not.toBeDisabled();
  });

  test("create and cancel test run", async ({ page }) => {
    // Navigate to test runs page
    await page.goto("/");
    
    // Navigate to Test Runs section
    await page.getByRole('link', { name: 'Test Runs' }).click();
    
    // Click "New Test Run" button to open the trigger dialog
    await page.getByRole('button', { name: 'New Test Run' }).click();
    
    // Trigger the test run
    await page.getByRole('button', { name: 'Trigger Test Run' }).click();
    
    // Wait for success message
    await expect(page.getByText('Successfully triggered tests')).toBeVisible();
    
    // Find and click on the newly created test run link
    // The test run ID will be dynamic, so we need to find the most recent one
    const testRunLinks = page.getByRole('link').filter({ hasText: /^\d+$/ });
    const firstTestRunLink = testRunLinks.first();
    await firstTestRunLink.click();
    
    // Cancel the test run
    await page.getByRole('button', { name: 'Cancel run' }).first().click();
    await page.getByRole('button', { name: 'Cancel Run' }).click();
    
    // Verify the test run was cancelled
    await expect(page.getByRole('heading', { name: 'Test run cancelled' })).toBeVisible();
  });
});