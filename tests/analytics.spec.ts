import { test, expect } from "./fixtures";
import { navigateToAnalytics, searchTests } from "./pages/analytics";

test.describe("Analytics Page", () => {
  test("filter by environment, change time period, and search test cases", async ({ page }) => {
    // Navigate to the analytics page
    await navigateToAnalytics(page);

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
    await page.getByRole('main').getByRole('button', { name: /Last 7 days/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Last 2 weeks' }).click();
    await expect(page.getByRole('main').getByRole('button', { name: /Last 2 weeks/ })).toBeVisible();

    // Change time period to "Last 30 days"
    await page.getByRole('main').getByRole('button', { name: /Last 2 weeks/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Last 30 days' }).click();
    await expect(page.getByRole('main').getByRole('button', { name: /Last 30 days/ })).toBeVisible();

    // Search for test cases using the search input
    await searchTests(page, 'login');

    // Verify a Clear button appears for the search filter
    await expect(page.getByRole('button', { name: 'Clear' })).toBeVisible();

    // Clear the search filter
    await page.getByRole('button', { name: 'Clear' }).click();

    // Verify the search is cleared
    await expect(page.getByPlaceholder('Search tests...')).toHaveValue('');
  });

  test("clicking on failed test opens test run", async ({ page }) => {
    // Navigate to the analytics page
    await navigateToAnalytics(page);
    
    // Find and click the red box (failed test indicator) using test id
    const redBox = page.getByTestId('fail-box').first();
    await expect(redBox).toBeVisible();
    
    // Hover on the red box to show tooltip with test run ID
    await redBox.hover();
    
    // Wait for tooltip to appear - it appears as a role="tooltip" element
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toBeVisible();
    
    // Verify tooltip shows "Fail" status
    await expect(tooltip.getByText('Fail')).toBeVisible();
    
    // Verify tooltip shows Run # with test run ID
    await expect(tooltip.getByText(/Run #\d+/)).toBeVisible();
    
    // Extract the test run ID from the tooltip for later verification
    const tooltipText = await tooltip.getByText(/Run #\d+/).textContent();
    const testRunIdMatch = tooltipText?.match(/Run #(\d+)/);
    const testRunId = testRunIdMatch ? testRunIdMatch[1] : null;
    expect(testRunId).toBeTruthy();
    
    
    // Click the red box to navigate to the test case page
    await redBox.click();
    
    // Verify that we've navigated to a test case detail page
    await expect(page).toHaveURL(/test-runs\/\d+\?test_id=/);
    
    // Verify the test run ID is displayed in the breadcrumb
    await expect(page.getByText(`#${testRunId}`).first()).toBeVisible();
    
    // Assert that a video is visible on the test case page
    const video = page.locator('video').first();
    await expect(video).toBeVisible();
  });

  test("search for test cases by name and fail rate filter", async ({ page }) => {
    // Navigate to the analytics page
    await navigateToAnalytics(page);

    // Wait for the page to fully load before searching
    await expect(page.getByText(/Showing \d+ of \d+ test cases/)).toBeVisible();

    // Part 1: Search for "auth" and verify the expected test case shows up
    await searchTests(page, 'auth');
    
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
    await searchTests(page, 'fail_rate:>50');
    
    // Wait for results to load by checking that a test case with high fail rate is visible
    // "search for database shows only 1 card" has 100% fail rate, so it should appear
    await expect(page.getByText('search for database shows only 1 card', { exact: false })).toBeVisible();
    
    // Assert the test case is NOT visible (it should have low fail rate)
    // This is expected to fail today as the feature is being fixed
    await expect(page.getByText('search for auth shows only 1 card')).not.toBeVisible();
  });
});
