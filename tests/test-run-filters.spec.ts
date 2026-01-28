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
    
    // Wait for filtered results to load
    await testRunLinks.first().waitFor({ state: 'visible', timeout: 10000 });
    
    // Verify URL contains the status filter
    await expect(page).toHaveURL(/status=passed/);
    
    // Count passed test runs
    const passedTestRunLinks = page.getByRole('link', { name: /^#\d+/ }).filter({ hasNotText: /re-run of/i });
    const passedCount = await passedTestRunLinks.count();
    console.log(`Row count after filter (status=passed): ${passedCount}`);
    
    // Verify we have some passed test runs
    expect(passedCount).toBeGreaterThan(0);
    
    // Each visible test run row should have "Passed" status
    const passedBadges = page.getByText('Passed', { exact: true });
    const passedBadgeCount = await passedBadges.count();
    // Badge count should be at least equal to row count (each row has one badge)
    expect(passedBadgeCount).toBeGreaterThanOrEqual(passedCount);
    console.log(`Found ${passedBadgeCount} Passed badges for ${passedCount} rows`);
    
    // Verify no "Failed" badges are visible in the filtered results
    const failedBadgesInPassedFilter = page.locator('main').getByText('Failed', { exact: true });
    const failedInPassedCount = await failedBadgesInPassedFilter.count();
    expect(failedInPassedCount).toBe(0);
    console.log(`Verified no Failed badges in Passed filter results`);
    
    // Now filter by "Failed" status
    await page.getByRole('combobox').filter({ hasText: 'Passed' }).click();
    await page.getByRole('option', { name: 'Failed' }).click();
    
    // Wait for filtered results to load
    await testRunLinks.first().waitFor({ state: 'visible', timeout: 10000 });
    
    // Verify URL contains the status filter
    await expect(page).toHaveURL(/status=failed/);
    
    // Count failed test runs
    const failedTestRunLinks = page.getByRole('link', { name: /^#\d+/ }).filter({ hasNotText: /re-run of/i });
    const failedCount = await failedTestRunLinks.count();
    console.log(`Row count after filter (status=failed): ${failedCount}`);
    
    // Verify we have some failed test runs
    expect(failedCount).toBeGreaterThan(0);
    
    // Each visible test run row should have "Failed" status
    const failedBadges = page.getByText('Failed', { exact: true });
    const failedBadgeCount = await failedBadges.count();
    // Badge count should be at least equal to row count
    expect(failedBadgeCount).toBeGreaterThanOrEqual(failedCount);
    console.log(`Found ${failedBadgeCount} Failed badges for ${failedCount} rows`);
    
    // Verify no "Passed" badges are visible in the filtered results
    const passedBadgesInFailedFilter = page.locator('main').getByText('Passed', { exact: true });
    const passedInFailedCount = await passedBadgesInFailedFilter.count();
    expect(passedInFailedCount).toBe(0);
    console.log(`Verified no Passed badges in Failed filter results`);
    
    console.log(`Status filter test completed. Passed: ${passedCount}, Failed: ${failedCount}`);
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
    
    // Click on the branch filter combobox to open the dropdown
    await page.getByRole('combobox').filter({ hasText: 'All branches' }).click();
    
    // Wait for the dialog/dropdown to open
    const dropdown = page.getByRole('dialog');
    await expect(dropdown).toBeVisible();
    
    // Find the search input inside the dropdown and type the branch name
    const searchInput = dropdown.getByRole('combobox');
    await searchInput.fill(branchName);
    
    // Get branch options (excluding "All branches" which is the reset option)
    const branchOptions = dropdown.getByRole('option').filter({ hasNotText: 'All branches' });
    
    // Assert that only 1 matching branch option is visible
    await expect(branchOptions).toHaveCount(1);
    console.log(`Search found exactly 1 branch option for: ${branchName}`);
    
    // Click on the single search result
    await branchOptions.click();
    
    // Wait for the filtered results to load
    await page.waitForLoadState('networkidle');
    
    // Wait for test run links to appear
    await testRunLinks.first().waitFor({ state: 'visible', timeout: 10000 });
    
    // Count filtered test runs
    const filteredTestRunLinks = page.getByRole('link', { name: /^#\d+/ }).filter({ hasNotText: /re-run of/i });
    const filteredCount = await filteredTestRunLinks.count();
    console.log(`Row count after filter (branch=${branchName}): ${filteredCount}`);
    
    // Verify filter reduced the count (should be less than or equal to initial)
    expect(filteredCount).toBeLessThanOrEqual(initialRowCount);
    
    // Verify there are results with the branch filter
    expect(filteredCount).toBeGreaterThan(0);
    
    // The branch name should appear somewhere in the visible rows
    const branchText = page.getByText(branchName);
    const branchTextCount = await branchText.count();
    console.log(`Found ${branchTextCount} occurrences of branch name in results`);
    // Each filtered row should have the branch name visible (plus one in the filter)
    expect(branchTextCount).toBeGreaterThanOrEqual(1);
    
    // Test URL persistence - verify branch filter is persisted in URL
    const currentUrl = page.url();
    console.log(`Current URL after filter: ${currentUrl}`);
    expect(currentUrl).toContain('branch');
    
    // Reload the page to verify filter persistence
    await page.reload();
    
    // Wait for the page to load after reload
    await testRunLinks.first().waitFor({ state: 'visible', timeout: 10000 });
    
    // Verify the branch combobox still shows the selected branch
    const branchComboboxAfterReload = page.getByRole('combobox').filter({ hasText: branchName });
    await expect(branchComboboxAfterReload).toBeVisible();
    
    // Verify the filtered results are still showing
    const filteredCountAfterReload = await filteredTestRunLinks.count();
    console.log(`Row count after reload: ${filteredCountAfterReload}`);
    expect(filteredCountAfterReload).toBe(filteredCount);
    
    console.log(`Branch filter test completed. Found ${filteredCount} test runs for branch: ${branchName}`);
  });
});
