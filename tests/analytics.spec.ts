import { test, expect } from "./fixtures";

test.describe("Analytics Page", () => {
  test("clicking on failed test opens test run", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
    
    // Navigate to Analytics section from sidebar
    await page.getByRole('link', { name: 'Analytics' }).click();
    
    // Wait for analytics page to load
    await expect(page).toHaveURL(/analytics/);
    
    // Find and click the red box (failed test indicator) using test id
    const redBox = page.getByTestId('fail-box').first();
    await expect(redBox).toBeVisible();
    
    // Hover on the red box to show tooltip with test run ID
    await redBox.hover();
    
    // Wait for tooltip to appear - it appears as a role="tooltip" element
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toBeVisible({ timeout: 5000 });
    
    // Verify tooltip shows "Fail" status
    await expect(tooltip.getByText('Fail')).toBeVisible();
    
    // Verify tooltip shows Run # with test run ID
    await expect(tooltip.getByText(/Run #\d+/)).toBeVisible();
    
    // Extract the test run ID from the tooltip for later verification
    const tooltipText = await tooltip.getByText(/Run #\d+/).textContent();
    const testRunIdMatch = tooltipText?.match(/Run #(\d+)/);
    const testRunId = testRunIdMatch ? testRunIdMatch[1] : null;
    expect(testRunId).toBeTruthy();
    
    console.log(`Found test run ID in tooltip: ${testRunId}`);
    
    // Click the red box to navigate to the test case page
    await redBox.click();
    
    // Verify that we've navigated to a test case detail page
    await expect(page).toHaveURL(/test-runs\/\d+\?pw_test_id=/);
    
    // Verify the test run ID is displayed in the breadcrumb
    await expect(page.getByText(`#${testRunId}`).first()).toBeVisible();
    
    // Assert that a video is visible on the test case page
    const video = page.locator('video').first();
    await expect(video).toBeVisible({ timeout: 10000 });
  });
});
