import { Page, Locator } from '@playwright/test';

/**
 * Gets a recently completed test run with failed tests
 * @param page The Playwright page object
 * @returns Object with testRunId and the full test run data
 */
export async function getRecentFailedTestRun(page: Page): Promise<{ testRunId: number; testRun: any }> {
  // Navigate to the test runs page
  await page.getByRole('link', { name: 'Test Runs' }).click();
  
  // Wait for the table to load
  await page.locator('tbody tr').first().waitFor({ state: 'visible', timeout: 10000 });
  
  // Make an API request to get test runs data
  const apiResponse = await page.request.get('/api/test-runs?project_id=3&limit=100&offset=0&interval_in_days=30');
  
  if (!apiResponse.ok()) {
    throw new Error(`Test runs API request failed with status ${apiResponse.status()}`);
  }
  
  // Parse the response data
  const responseData = await apiResponse.json();
  
  // Find a test run that has ended state and has failed tests
  const endedTestRuns = responseData.data.test_runs.items.filter(
    (testRun: any) => testRun.state === 'ended' && testRun.failed_count > 0
  );
  
  if (endedTestRuns.length === 0) {
    throw new Error('No completed test runs with failures found');
  }
  
  const testRun = endedTestRuns[0];
  const testRunId = testRun.id;
  
  console.log('Found test run with failures:', testRunId);
  
  return { testRunId, testRun };
}

/**
 * Gets a recently completed test run (with or without failures)
 * @param page The Playwright page object
 * @returns Object with testRunId and the full test run data
 */
export async function getRecentCompletedTestRun(page: Page): Promise<{ testRunId: number; testRun: any }> {
  // Navigate to the test runs page
  await page.getByRole('link', { name: 'Test Runs' }).click();
  
  // Wait for the table to load
  await page.locator('tbody tr').first().waitFor({ state: 'visible', timeout: 10000 });
  
  // Make an API request to get test runs data
  const apiResponse = await page.request.get('/api/test-runs?project_id=3&limit=20&offset=0&interval_in_days=30');
  
  if (!apiResponse.ok()) {
    throw new Error(`Test runs API request failed with status ${apiResponse.status()}`);
  }
  
  // Parse the response data
  const responseData = await apiResponse.json();
  
  // Find a test run that has ended state and has data (completed test runs)
  const endedTestRuns = responseData.data.test_runs.items.filter(
    (testRun: any) => testRun.state === 'ended' && testRun.total_count > 0
  );
  
  if (endedTestRuns.length === 0) {
    throw new Error('No completed test runs found');
  }
  
  const testRun = endedTestRuns[0];
  const testRunId = testRun.id;
  
  console.log('Found completed test run:', testRunId);
  
  return { testRunId, testRun };
}

/**
 * Navigates to a specific test run page
 * @param page The Playwright page object
 * @param testRunId The ID of the test run to navigate to
 */
export async function goToTestRun(page: Page, testRunId: number): Promise<void> {
  const testRunLink = page.locator(`a[href*="/test-runs/${testRunId}"]`).first();
  await testRunLink.waitFor({ state: 'visible', timeout: 5000 });
  await testRunLink.click();
}

/**
 * Gets a failed test from the current test run page
 * @param page The Playwright page object
 * @returns The test link element
 */
export async function getFailedTestLink(page: Page): Promise<Locator> {
  // Wait for the test run page to load - check for the Failed status
  await page.getByText('Failed', { exact: false }).first().waitFor({ state: 'visible', timeout: 10000 });
  
  // Find a failed test link directly without using the filter
  // Look for a link in the test cases table with a test name
  const failedTestLink = page.getByRole('link').filter({ hasText: 'search' }).first();
  await failedTestLink.waitFor({ state: 'visible', timeout: 10000 });
  
  return failedTestLink;
}
