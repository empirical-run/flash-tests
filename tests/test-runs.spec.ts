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

    // Set up network interception to capture the test run creation response
    const testRunCreationPromise = page.waitForResponse(response => 
      response.url().includes('/api/test-runs') && response.request().method() === 'PUT'
    );

    // Trigger the test run
    await page.getByRole('button', { name: 'Trigger Test Run' }).click();

    // Wait for the test run creation response and extract the ID
    const response = await testRunCreationPromise;
    const responseBody = await response.json();
    const testRunId = responseBody.data.test_run.id;
    
    // Click on the specific test run using the captured ID
    const testRunLink = page.locator(`a[href*="/test-runs/${testRunId}"]`);
    await expect(testRunLink).toBeVisible();
    await testRunLink.click();
    
    // Wait for the test run page to load and show queued status
    await expect(page.getByText('Test run queued')).toBeVisible();
    
    // Wait a moment for the test run to potentially start (so it can be cancelled)
    await page.waitForTimeout(2000);
    
    // Cancel the test run
    await page.getByRole('button', { name: 'Cancel run' }).nth(1).click();
    await page.getByRole('button', { name: 'Cancel Run' }).click();
    
    // Wait for the cancellation to complete - check for the heading
    await expect(page.getByRole('heading', { name: 'Test run cancelled' })).toBeVisible();
  });

});