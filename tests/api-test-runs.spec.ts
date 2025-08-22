import { test, expect } from './fixtures';

test.describe('API Test Runs', () => {
  test('make GET API call to /api/test-runs and navigate to diagnosis report', async ({ page }) => {
    // Navigate to the app first to establish session/authentication
    await page.goto('/');
    
    // Navigate to the test runs page first to understand the API calls the page makes
    await page.getByRole('link', { name: 'Test Runs' }).click();
    
    // Wait for the page to load and capture network requests
    await expect(page).toHaveURL(/test-runs/);
    
    // Wait for test runs list to load
    await page.waitForTimeout(2000);
    
    // Set up network interception to capture API calls made by the page
    const testRunsApiPromise = page.waitForResponse(response => 
      response.url().includes('/api/test-runs') && response.request().method() === 'GET'
    );
    
    // Refresh the page to trigger API calls
    await page.reload();
    
    // Capture the API response that the page makes
    const apiResponse = await testRunsApiPromise;
    
    // Verify the API response is successful
    expect(apiResponse.ok()).toBeTruthy();
    expect(apiResponse.status()).toBe(200);
    
    // Parse the response data
    const responseData = await apiResponse.json();
    console.log('Test runs API response:', responseData);
    
    // Extract a test run ID from the response
    // Based on the response structure: data.test_runs.items[]
    expect(responseData.data).toBeTruthy();
    expect(responseData.data.test_runs).toBeTruthy();
    expect(responseData.data.test_runs.items).toBeTruthy();
    expect(responseData.data.test_runs.items.length).toBeGreaterThan(0);
    
    // Find a test run that has ended state and has data (completed test runs)
    const endedTestRuns = responseData.data.test_runs.items.filter(
      (testRun: any) => testRun.state === 'ended' && testRun.total_count > 0
    );
    
    expect(endedTestRuns.length).toBeGreaterThan(0);
    const testRunId = endedTestRuns[0].id;
    
    expect(testRunId).toBeTruthy();
    console.log('Found completed test run ID:', testRunId);
    console.log('Test run details:', endedTestRuns[0]);
    
    // Click on the test run link in the UI instead of navigating directly
    const testRunLink = page.locator(`a[href*="/test-runs/${testRunId}"]`).first();
    await expect(testRunLink).toBeVisible({ timeout: 5000 });
    await testRunLink.click();
    
    // Verify we're on the specific test run page
    await expect(page).toHaveURL(new RegExp(`test-runs/${testRunId}`));
    
    // Verify the page loads with test run data - look for more specific elements
    await expect(page.getByText('Failed', { exact: false }).first()).toBeVisible({ timeout: 10000 });
    
    // TODO(agent on page): Look for failed tests in the list, click on one to get to its detailed diagnosis report page
  });
});