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

  test("trigger a new test run and monitor through completion", async ({ page }) => {
    // Navigate to test runs page
    await page.goto("/");
    await page.getByRole('link', { name: 'Test Runs' }).click();
    
    // Click "New Test Run" button to open the trigger dialog
    await page.getByRole('button', { name: 'New Test Run' }).click();
    
    // Set up network interception to capture the test run creation response
    const testRunCreationPromise = page.waitForResponse(response => 
      response.url().includes('/api/test-runs') && response.request().method() === 'PUT'
    );

    // Trigger the test run on default preselected environment
    await page.getByRole('button', { name: 'Trigger Test Run' }).click();

    // Wait for the test run creation response and extract the ID
    const response = await testRunCreationPromise;
    const responseBody = await response.json();
    const testRunId = responseBody.data.test_run.id;
    
    // Click on the specific test run to open run details page
    const testRunLink = page.locator(`a[href*="/test-runs/${testRunId}"]`);
    await expect(testRunLink).toBeVisible();
    await testRunLink.click();
    
    // Assert it shows queued status first
    await expect(page.getByText('Test run queued')).toBeVisible();
    
    // Wait for and assert it shows in progress status
    await expect(page.getByText('Test run in progress')).toBeVisible({ timeout: 60000 });
    
    // Wait for run to complete and show failed status - wait up to 5 mins
    await expect(page.getByText('Failed').first()).toBeVisible({ timeout: 300000 }); // 5 minutes timeout
    
    // Click on a failing test in the list of failed tests
    await page.getByLabel('Tests').getByText('Failed').click();
    
    // Click the Video button for the failed test and verify video player appears and plays
    await page.getByRole('button', { name: 'Video' }).click();
    await expect(page.getByRole('heading', { name: 'Video' })).toBeVisible();
    await page.getByRole('button', { name: 'play' }).click();
    await expect(page.locator('video')).toBeVisible();
    
    // Close the video modal
    await page.keyboard.press('Escape');
    
    // Click on the "Trace" button and verify it opens a new tab with "trace" in the URL
    const tracePagePromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Trace' }).click();
    const tracePage = await tracePagePromise;
    await expect(tracePage.url()).toContain('trace');
    await tracePage.close();
    
    // Now also test the detailed test report page functionality
    // Click on the first failed test name to open the detailed report page
    // Look for a test row that contains "Failed" status and click its link
    await page.locator('tr:has-text("Failed") a').first().click();
    
    // Verify we are on a detailed test page (should have test report elements)
    await expect(page.getByText('Visual Comparison')).toBeVisible();
    await expect(page.getByText('Failure Type').first()).toBeVisible();
    
    // Test video functionality from detailed page - the video player should already be visible
    await expect(page.locator('video, .video-player, [data-testid*="video"]').first()).toBeVisible();
    
    // Test trace functionality from detailed page
    const detailedTracePagePromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'View trace' }).click();
    const detailedTracePage = await detailedTracePagePromise;
    await expect(detailedTracePage.url()).toContain('trace');
  });



});