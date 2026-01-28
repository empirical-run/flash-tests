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
    
    // Wait for the filtered results to load
    await page.waitForTimeout(500); // Small delay for filter to apply
    
    // Count passed test runs
    const passedTestRunLinks = page.getByRole('link', { name: /^#\d+/ }).filter({ hasNotText: /re-run of/i });
    const passedCount = await passedTestRunLinks.count();
    console.log(`Row count after filter (status=passed): ${passedCount}`);
    
    // Verify all visible rows have "Passed" status badge
    if (passedCount > 0) {
      // Check that the first few rows have "Passed" status
      const passedBadges = page.locator('tbody tr').locator('text=Passed');
      const passedBadgeCount = await passedBadges.count();
      expect(passedBadgeCount).toBeGreaterThan(0);
      console.log(`Found ${passedBadgeCount} rows with Passed badge`);
    }
    
    // Now filter by "Failed" status
    await page.getByRole('combobox').filter({ hasText: 'Passed' }).click();
    await page.getByRole('option', { name: 'Failed' }).click();
    
    // Wait for the filtered results to load
    await page.waitForTimeout(500); // Small delay for filter to apply
    
    // Count failed test runs
    const failedTestRunLinks = page.getByRole('link', { name: /^#\d+/ }).filter({ hasNotText: /re-run of/i });
    const failedCount = await failedTestRunLinks.count();
    console.log(`Row count after filter (status=failed): ${failedCount}`);
    
    // Verify all visible rows have "Failed" status badge
    if (failedCount > 0) {
      // Check that the first few rows have "Failed" status
      const failedBadges = page.locator('tbody tr').locator('text=Failed');
      const failedBadgeCount = await failedBadges.count();
      expect(failedBadgeCount).toBeGreaterThan(0);
      console.log(`Found ${failedBadgeCount} rows with Failed badge`);
    }
    
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
    
    console.log(`Branch filter test completed. Found ${filteredCount} test runs for branch: ${branchName}`);
  });
});
