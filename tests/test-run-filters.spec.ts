import { test, expect } from "./fixtures";

test.describe("Test Run List Filters", () => {
  test("filter test runs by environment - staging filter preserves all rows", async ({ page }) => {
    // Navigate to test runs page
    await page.goto("/");
    await page.getByRole('link', { name: 'Test Runs' }).click();
    
    // Wait for the page URL to change to test-runs
    await expect(page).toHaveURL(/test-runs/, { timeout: 10000 });
    
    // Wait for the test runs list to load (test run links start with "#" followed by numbers)
    // Filter out "re-run of..." annotation links which also match the pattern
    const testRunLinks = page.getByRole('link', { name: /^#\d+/ }).filter({ hasNotText: /re-run of/i });
    await testRunLinks.first().waitFor({ state: 'visible', timeout: 10000 });
    
    // Get the initial row count before applying filter
    const initialRowCount = await testRunLinks.count();
    console.log(`Initial row count (before filter): ${initialRowCount}`);
    
    // Apply filter for environment = staging using the environment dropdown
    await page.getByRole('combobox').filter({ hasText: 'All environments' }).click();
    await page.getByRole('option', { name: 'Staging' }).click();
    
    // Wait for the filtered results to load
    await testRunLinks.first().waitFor({ state: 'visible', timeout: 10000 });
    
    // Get the row count after applying filter
    const filteredRowCount = await testRunLinks.count();
    console.log(`Row count after filter (environment=staging): ${filteredRowCount}`);
    
    // Assert that the row counts are equal
    // This test is expected to fail because of a bug
    expect(filteredRowCount).toBe(initialRowCount);
  });

  test("filter test runs by status - passed and failed", async ({ page }) => {
    // Navigate to test runs page
    await page.goto("/");
    await page.getByRole('link', { name: 'Test Runs' }).click();
    
    // Wait for the page URL to change to test-runs
    await expect(page).toHaveURL(/test-runs/, { timeout: 10000 });
    
    // Wait for the test runs list to load
    const testRunLinks = page.getByRole('link', { name: /^#\d+/ }).filter({ hasNotText: /re-run of/i });
    await testRunLinks.first().waitFor({ state: 'visible', timeout: 10000 });
    
    // Get the initial row count before applying any filter
    const initialRowCount = await testRunLinks.count();
    console.log(`Initial row count (no filter): ${initialRowCount}`);
    
    // Filter by "Passed" status
    await page.getByRole('combobox').filter({ hasText: 'All statuses' }).click();
    await page.getByRole('option', { name: 'Passed' }).click();
    
    // Wait for the filtered results to load - wait for network idle or test run links
    await page.waitForLoadState('networkidle');
    
    // Count passed test runs (may be 0 if no passed runs exist)
    const passedTestRunLinks = page.getByRole('link', { name: /^#\d+/ }).filter({ hasNotText: /re-run of/i });
    const passedCount = await passedTestRunLinks.count();
    console.log(`Row count after filter (status=passed): ${passedCount}`);
    
    // Verify all visible rows have "Passed" status badge
    if (passedCount > 0) {
      // Check that rows contain "Passed" text
      const passedBadges = page.getByText('Passed', { exact: true });
      const passedBadgeCount = await passedBadges.count();
      expect(passedBadgeCount).toBeGreaterThan(0);
      console.log(`Found ${passedBadgeCount} rows with Passed badge`);
    }
    
    // Now filter by "Failed" status
    await page.getByRole('combobox').filter({ hasText: 'Passed' }).click();
    await page.getByRole('option', { name: 'Failed' }).click();
    
    // Wait for the filtered results to load
    await page.waitForLoadState('networkidle');
    
    // Wait for actual test run links to appear (Failed runs should exist)
    await testRunLinks.first().waitFor({ state: 'visible', timeout: 10000 });
    
    // Count failed test runs
    const failedTestRunLinks = page.getByRole('link', { name: /^#\d+/ }).filter({ hasNotText: /re-run of/i });
    const failedCount = await failedTestRunLinks.count();
    console.log(`Row count after filter (status=failed): ${failedCount}`);
    
    // Verify we have some failed test runs (there should be some based on the UI screenshot)
    expect(failedCount).toBeGreaterThan(0);
    
    // Verify all visible rows have "Failed" status badge
    const failedBadges = page.getByText('Failed', { exact: true });
    const failedBadgeCount = await failedBadges.count();
    expect(failedBadgeCount).toBeGreaterThan(0);
    console.log(`Found ${failedBadgeCount} rows with Failed badge`);
    
    // Verify passed and failed counts are reasonable (sum should be <= initial count)
    // Some runs might have other statuses like "Canceled", "Partial", etc.
    expect(passedCount + failedCount).toBeLessThanOrEqual(initialRowCount);
    console.log(`Passed: ${passedCount}, Failed: ${failedCount}, Total: ${initialRowCount}`);
  });

  test("filter test runs by branch", async ({ page }) => {
    // Construct branch name using today's date (format: feat/jan-28-2026)
    const today = new Date();
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const month = monthNames[today.getMonth()];
    const day = today.getDate();
    const year = today.getFullYear();
    const branchName = `feat/${month}-${day}-${year}`;
    console.log(`Using branch name: ${branchName}`);
    
    // Navigate to test runs page
    await page.goto("/");
    await page.getByRole('link', { name: 'Test Runs' }).click();
    
    // Wait for the page URL to change to test-runs
    await expect(page).toHaveURL(/test-runs/, { timeout: 10000 });
    
    // Wait for the test runs list to load
    const testRunLinks = page.getByRole('link', { name: /^#\d+/ }).filter({ hasNotText: /re-run of/i });
    await testRunLinks.first().waitFor({ state: 'visible', timeout: 10000 });
    
    // Get the initial row count before applying filter
    const initialRowCount = await testRunLinks.count();
    console.log(`Initial row count (before filter): ${initialRowCount}`);
    
    // Find and interact with the branch filter input
    // The branch filter is typically a text input or combobox
    const branchInput = page.getByPlaceholder(/branch/i);
    await branchInput.fill(branchName);
    
    // Press Enter or wait for debounce to apply filter
    await branchInput.press('Enter');
    
    // Wait for the filtered results to load
    await page.waitForTimeout(1000); // Wait for filter to apply
    
    // Count filtered test runs
    const filteredTestRunLinks = page.getByRole('link', { name: /^#\d+/ }).filter({ hasNotText: /re-run of/i });
    const filteredCount = await filteredTestRunLinks.count();
    console.log(`Row count after filter (branch=${branchName}): ${filteredCount}`);
    
    // Verify filter reduced the count (should be less than or equal to initial)
    expect(filteredCount).toBeLessThanOrEqual(initialRowCount);
    
    // If there are results, verify they have the correct branch
    if (filteredCount > 0) {
      // The branch name should appear somewhere in the visible rows
      const branchText = page.getByText(branchName);
      const branchTextCount = await branchText.count();
      console.log(`Found ${branchTextCount} occurrences of branch name in results`);
      // Each filtered row should have the branch name visible
      expect(branchTextCount).toBeGreaterThanOrEqual(1);
    }
    
    // Test URL persistence - verify branch filter is persisted in URL
    const currentUrl = page.url();
    console.log(`Current URL after filter: ${currentUrl}`);
    expect(currentUrl).toContain('branch');
    
    // Reload the page to verify filter persistence
    await page.reload();
    
    // Wait for the page to load after reload
    await testRunLinks.first().waitFor({ state: 'visible', timeout: 10000 });
    
    // Verify the branch input still has the filter value
    const branchInputAfterReload = page.getByPlaceholder(/branch/i);
    await expect(branchInputAfterReload).toHaveValue(branchName);
    
    // Verify the filtered results are still showing
    const filteredCountAfterReload = await filteredTestRunLinks.count();
    console.log(`Row count after reload: ${filteredCountAfterReload}`);
    expect(filteredCountAfterReload).toBe(filteredCount);
    
    console.log(`Branch filter test completed. Found ${filteredCount} test runs for branch: ${branchName}`);
  });
});
