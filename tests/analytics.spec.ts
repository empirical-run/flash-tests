import { test, expect } from "./fixtures";

test.describe("Analytics Page", () => {
  test("clicking on failed test opens test run", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
    
    // Navigate to Analytics section from sidebar
    await page.getByRole('link', { name: 'Analytics' }).click();
    
    // Wait for analytics page to load
    await expect(page).toHaveURL(/analytics/);
    
    // Find a red box (failed test indicator) in the history column
    const redBox = page.getByRole('link').filter({ hasText: /^$/ }).first();
    await expect(redBox).toBeVisible();
    
    // Hover on the red box to show tooltip with test run ID
    await redBox.hover();
    
    // Wait for tooltip to appear and verify it shows Run # with test run ID
    // The tooltip shows "Fail" and "Run #[number]" when hovering over a red box
    await expect(page.getByText(/Run #\d+/)).toBeVisible({ timeout: 5000 });
    
    // Verify tooltip shows "Fail" status
    await expect(page.getByText('Fail')).toBeVisible();
    
    // Extract the test run ID from the tooltip for later verification
    const tooltipText = await page.getByText(/Run #\d+/).textContent();
    const testRunIdMatch = tooltipText?.match(/Run #(\d+)/);
    const testRunId = testRunIdMatch ? testRunIdMatch[1] : null;
    expect(testRunId).toBeTruthy();
    
    console.log(`Found test run ID in tooltip: ${testRunId}`);
    
    // Click the red box to navigate to the test run page
    await redBox.click();
    
    // Verify that we've navigated to the test run page with the correct ID
    await expect(page).toHaveURL(new RegExp(`test-runs/${testRunId}`));
    
    // Verify the test run page has loaded by checking for the test run heading
    await expect(page.getByText('Test run on')).toBeVisible();
    
    // Verify the test run ID is displayed in the breadcrumb or heading
    await expect(page.getByText(`#${testRunId}`)).toBeVisible();
  });
});
