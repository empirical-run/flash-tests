import { Page } from '@playwright/test';

export class TestRunsPage {
  constructor(private page: Page) {}

  /**
   * Gets a recently completed test run with failed tests
   * @returns Object with testRunId and the full test run data
   */
  async getRecentFailedTestRun(): Promise<{ testRunId: number; testRun: any }> {
    // Set up network interception
    const testRunsApiPromise = this.page.waitForResponse(response => 
      response.url().includes('/api/test-runs') && response.request().method() === 'GET'
    );
    
    // Navigate to the test runs page to trigger the API call
    await this.page.getByRole('link', { name: 'Test Runs' }).click();
    
    // Capture the API response
    const apiResponse = await testRunsApiPromise;
    
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
   * Navigates to a specific test run page
   * @param testRunId The ID of the test run to navigate to
   */
  async goToTestRun(testRunId: number): Promise<void> {
    const testRunLink = this.page.locator(`a[href*="/test-runs/${testRunId}"]`).first();
    await testRunLink.waitFor({ state: 'visible', timeout: 5000 });
    await testRunLink.click();
  }

  /**
   * Gets a failed test from the current test run page
   * @returns The test link element
   */
  async getFailedTestLink() {
    // Wait for the test run page to load - check for the Failed status
    await this.page.getByText('Failed', { exact: false }).first().waitFor({ state: 'visible', timeout: 10000 });
    
    // Find a failed test link directly without using the filter
    // Look for a link in the test cases table with a test name
    const failedTestLink = this.page.getByRole('link').filter({ hasText: 'search' }).first();
    await failedTestLink.waitFor({ state: 'visible', timeout: 10000 });
    
    return failedTestLink;
  }
}
