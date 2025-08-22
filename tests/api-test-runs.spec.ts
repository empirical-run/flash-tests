import { test, expect } from '@playwright/test';

test.describe('API Test Runs', () => {
  test('make GET API call to /api/test-runs and navigate to test-runs page', async ({ page }) => {
    // Navigate to the main page first
    await page.goto('/');
    
    // Make GET API call to /api/test-runs
    console.log('Making GET API call to /api/test-runs...');
    const apiResponse = await page.request.get('/api/test-runs');
    
    // Check if the API call was successful
    expect(apiResponse.ok()).toBe(true);
    
    // Parse the response
    const testRunsData = await apiResponse.json();
    console.log('API Response:', JSON.stringify(testRunsData, null, 2));
    
    // Verify we got some test runs data
    expect(testRunsData).toBeDefined();
    
    // Get the first test run ID from the response
    let testRunId;
    if (Array.isArray(testRunsData)) {
      expect(testRunsData.length).toBeGreaterThan(0);
      testRunId = testRunsData[0].id;
    } else if (testRunsData.id) {
      testRunId = testRunsData.id;
    } else if (testRunsData.data && Array.isArray(testRunsData.data)) {
      expect(testRunsData.data.length).toBeGreaterThan(0);
      testRunId = testRunsData.data[0].id;
    } else {
      throw new Error('Could not find test run ID in API response');
    }
    
    console.log('Test Run ID:', testRunId);
    expect(testRunId).toBeDefined();
    
    // Navigate to the test-runs page for this specific ID
    console.log(`Navigating to test run page: /test-runs/${testRunId}`);
    await page.goto(`/test-runs/${testRunId}`);
    
    // Verify we're on the correct test run page
    await expect(page).toHaveURL(new RegExp(`/test-runs/${testRunId}`));
    
    // Wait for the page to load and look for test run details
    await expect(page.locator('body')).toBeVisible();
    
    // TODO(agent on page): Look for diagnosis report or diagnosis-related elements on the page, and fetch/click on them to get the diagnosis information
  });
});