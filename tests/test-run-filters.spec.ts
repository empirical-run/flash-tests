import { test, expect } from "./fixtures";
import { getBranchNameForDate } from "./pages/branch-name";

test.describe("Test Run List Filters", () => {
  test("filter test runs by environment - staging filter preserves all rows", async ({ page }) => {
    // Navigate to test runs page
    await page.goto("/");
    await page.getByRole('link', { name: 'Test Runs' }).click();
    
    // Wait for the page URL to change to test-runs
    await expect(page).toHaveURL(/test-runs/, { timeout: 10000 });
    
    // Wait for the test runs list to load (test run links have aria-label "View test run #<number>")
    const testRunLinks = page.getByRole('link', { name: /^View test run #\d+/ });
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
    const testRunLinks = page.getByRole('link', { name: /^View test run #\d+/ });
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
    const passedTestRunLinks = page.getByRole('link', { name: /^View test run #\d+/ });
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
    const failedTestRunLinks = page.getByRole('link', { name: /^View test run #\d+/ });
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
    // Navigate to test runs page
    await page.goto("/");
    await page.getByRole('link', { name: 'Test Runs' }).click();
    
    // Wait for the page URL to change to test-runs
    await expect(page).toHaveURL(/test-runs/, { timeout: 10000 });
    
    // Wait for the test runs list to load
    const testRunLinks = page.getByRole('link', { name: /^View test run #\d+/ });
    await testRunLinks.first().waitFor({ state: 'visible', timeout: 10000 });
    
    // Get the initial row count before applying filter
    const initialRowCount = await testRunLinks.count();
    console.log(`Initial row count (before filter): ${initialRowCount}`);
    
    // Click on the branch filter combobox to open the dropdown
    await page.getByRole('combobox').filter({ hasText: 'All branches' }).click();
    
    // Wait for the dialog/dropdown to open
    const dropdown = page.getByRole('dialog');
    await expect(dropdown).toBeVisible();
    
    // Find the search input inside the dropdown
    const searchInput = dropdown.getByRole('combobox');
    
    // Get branch options locator (excluding "All branches" which is the reset option)
    const branchOptions = dropdown.getByRole('option').filter({ hasNotText: 'All branches' });
    
    // Try today's date first, then go back up to 7 days to find a valid branch
    let branchName = '';
    const maxDaysToTry = 7;
    const searchingIndicator = dropdown.getByText('Searching...'); 
    
    for (let daysAgo = 0; daysAgo < maxDaysToTry; daysAgo++) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - daysAgo);
      const candidateBranch = getBranchNameForDate(targetDate);
      
      console.log(`Trying branch name: ${candidateBranch}`);
      await searchInput.fill(candidateBranch);
      
      // Wait for searching to complete (wait for "Searching..." to disappear)
      await expect(searchingIndicator).toBeHidden({ timeout: 5000 });
      
      const optionCount = await branchOptions.count();
      if (optionCount === 1) {
        branchName = candidateBranch;
        console.log(`Found branch: ${branchName}`);
        break;
      }
    }
    
    // Assert that we found a valid branch
    expect(branchName).not.toBe('');
    console.log(`Using branch name: ${branchName}`);
    
    // Assert that exactly 1 matching branch option is visible
    await expect(branchOptions).toHaveCount(1);
    console.log(`Search found exactly 1 branch option for: ${branchName}`);
    
    // Click on the single search result
    await branchOptions.click();
    
    // Wait for test run links to appear
    await testRunLinks.first().waitFor({ state: 'visible', timeout: 10000 });
    
    // Count filtered test runs
    const filteredTestRunLinks = page.getByRole('link', { name: /^View test run #\d+/ });
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
    
    // Test URL persistence - verify branch filter is persisted in URL (auto-waits for URL to update)
    await expect(page).toHaveURL(/branch=/);
    console.log(`Current URL after filter: ${page.url()}`);
    
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
