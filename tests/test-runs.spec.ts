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

  test("create and cancel a test run", async ({ page }) => {
    await page.goto("/");
    await page.getByRole('link', { name: 'Test Runs' }).click();
    await page.getByRole('button', { name: 'New Test Run' }).click();
    await page.getByRole('button', { name: 'Trigger Test Run' }).click();

    // Wait for the new test run to appear in the list (first row)
    await expect(page.locator('tbody tr:first-child')).toBeVisible();
    
    // The new test run should be the first one in the list.
    const newTestRunLink = page.locator('tbody tr:first-child a').first();
    await newTestRunLink.click();
    
    // Wait for the test run page to load and show "Test run queued" status
    await expect(page.getByText('Test run queued')).toBeVisible();
    
    // Cancel the test run
    await page.getByRole('button', { name: 'Cancel run' }).nth(1).click();
    await page.getByRole('button', { name: 'Cancel Run' }).click();
    
    // Wait for the cancellation to complete - check for the "Cancelled" badge
    await expect(page.getByText('Cancelled')).toBeVisible();
  });

});