import { test, expect } from "./fixtures";

test.describe("Analytics Page", () => {
  test("filter by environment, change time period, and search test cases", async ({ page }) => {
    // Navigate to the analytics page
    await page.goto("/");
    await page.getByRole('link', { name: 'Analytics' }).click();
    await expect(page).toHaveURL(/analytics/);

    // Verify the main analytics components are visible
    await expect(page.getByText('Test Run History')).toBeVisible();
    await expect(page.getByText('Test Count Trend')).toBeVisible();
    await expect(page.getByText('Test Case', { exact: true })).toBeVisible();

    // Verify the default filters are set
    await expect(page.getByRole('combobox').filter({ hasText: 'All environments' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Last 7 days/ })).toBeVisible();

    // Open environment dropdown and select "Production"
    await page.getByRole('combobox').filter({ hasText: 'All environments' }).click();
    await page.getByRole('option', { name: 'Production' }).click();

    // Verify the environment filter is applied (shows "Clear" button)
    await expect(page.getByRole('button', { name: 'Clear' })).toBeVisible();

    // Clear the environment filter
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(page.getByRole('combobox').filter({ hasText: 'All environments' })).toBeVisible();

    // Change time period to "Last 2 weeks"
    await page.getByRole('button', { name: /Last 7 days/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Last 2 weeks' }).click();
    await expect(page.getByRole('button', { name: /Last 2 weeks/ })).toBeVisible();

    // Change time period to "Last 30 days"
    await page.getByRole('button', { name: /Last 2 weeks/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Last 30 days' }).click();
    await expect(page.getByRole('button', { name: /Last 30 days/ })).toBeVisible();

    // Search for test cases using the search input
    await page.getByPlaceholder('Search tests...').fill('login');
    await page.getByPlaceholder('Search tests...').press('Enter');

    // Verify a Clear button appears for the search filter
    await expect(page.getByRole('button', { name: 'Clear' })).toBeVisible();

    // Clear the search filter
    await page.getByRole('button', { name: 'Clear' }).click();

    // Verify the search is cleared
    await expect(page.getByPlaceholder('Search tests...')).toHaveValue('');
  });

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

  test("search for test cases by name and fail rate filter", async ({ page }) => {
    // Navigate to the analytics page
    await page.goto("/");
    await page.getByRole('link', { name: 'Analytics' }).click();
    await expect(page).toHaveURL(/analytics/);

    // Part 1: Search for "auth" and verify the expected test case shows up
    await page.getByPlaceholder('Search tests...').fill('auth');
    await page.getByPlaceholder('Search tests...').press('Enter');
    
    // Assert the specific test case is visible in results
    await expect(page.getByText('search for auth shows only 1 card')).toBeVisible();

    // Part 1.1: Clear the search box and verify all results show up
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(page.getByPlaceholder('Search tests...')).toHaveValue('');
    
    // Verify test cases are visible (the one we searched for should still be there among all results)
    await expect(page.getByText('search for auth shows only 1 card')).toBeVisible();

    // Part 2: Search for "fail_rate:>50" filter
    // First assert the test case is visible before applying the filter
    await expect(page.getByText('search for auth shows only 1 card')).toBeVisible();
    
    // Apply the fail rate filter
    await page.getByPlaceholder('Search tests...').fill('fail_rate:>50');
    await page.getByPlaceholder('Search tests...').press('Enter');
    
    // Wait for results to load by checking that some test case row has actual content
    // The Fail % column should show percentage values when loaded
    await expect(page.locator('table tbody tr').first().getByText('%')).toBeVisible();
    
    // Assert the test case is NOT visible (it should have low fail rate)
    // This is expected to fail today as the feature is being fixed
    await expect(page.getByText('search for auth shows only 1 card')).not.toBeVisible();
  });
});
