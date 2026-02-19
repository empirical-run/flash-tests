import { Page, Locator, expect } from '@playwright/test';

/**
 * Gets a recently completed test run with failed tests
 * @param page The Playwright page object
 * @returns Object with testRunId and the full test run data
 */
export async function getRecentFailedTestRun(page: Page, options?: { excludeExampleCom?: boolean }): Promise<{ testRunId: number; testRun: any }> {
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
    (testRun: any) => {
      const hasEnded = testRun.state === 'ended' && testRun.failed_count_after_snoozing > 0;
      
      // If we should exclude example.com, filter those out
      if (options?.excludeExampleCom) {
        const hasExampleCom = testRun.environment_variables_overrides?.some(
          (envVar: any) => envVar.value?.includes('example.com')
        );
        return hasEnded && !hasExampleCom;
      }
      
      return hasEnded;
    }
  );
  
  if (endedTestRuns.length === 0) {
    const errorMsg = options?.excludeExampleCom 
      ? 'No completed test runs with failures (excluding example.com) found'
      : 'No completed test runs with failures found';
    throw new Error(errorMsg);
  }
  
  const testRun = endedTestRuns[0];
  const testRunId = testRun.id;
  
  console.log('Found test run with failures:', testRunId);
  
  return { testRunId, testRun };
}

/**
 * Gets a recently completed test run with exactly 1 failure
 * @param page The Playwright page object
 * @returns Object with testRunId and the full test run data
 */
export async function getTestRunWithOneFailure(page: Page): Promise<{ testRunId: number; testRun: any }> {
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
  
  // Find a test run that has ended state and has exactly 1 failure
  const testRunsWithOneFailure = responseData.data.test_runs.items.filter(
    (testRun: any) => testRun.state === 'ended' && testRun.failed_count_after_snoozing === 1
  );
  
  if (testRunsWithOneFailure.length === 0) {
    throw new Error('No completed test runs with exactly 1 failure found');
  }
  
  const testRun = testRunsWithOneFailure[0];
  const testRunId = testRun.id;
  
  console.log('Found test run with exactly 1 failure:', testRunId);
  
  return { testRunId, testRun };
}

/**
 * Gets a recently completed test run with exactly 1 failure for a specific environment
 * This is used for snooze testing to ensure snoozes are scoped to a specific environment
 * @param page The Playwright page object
 * @param environmentSlug The environment slug to filter by (e.g. 'env-to-test-snoozes')
 * @returns Object with testRunId and the full test run data
 */
export async function getTestRunWithOneFailureForEnvironment(page: Page, environmentSlug: string): Promise<{ testRunId: number; testRun: any }> {
  // Navigate to the test runs page
  await page.getByRole('link', { name: 'Test Runs' }).click();
  
  // Wait for the table to load
  await page.locator('tbody tr').first().waitFor({ state: 'visible', timeout: 10000 });
  
  // Fetch the environment by slug
  const envResponse = await page.request.get(`/api/environments/list?project_repo_name=lorem-ipsum-tests&environment_slug=${environmentSlug}`);
  
  if (!envResponse.ok()) {
    throw new Error(`Environments API request failed with status ${envResponse.status()}`);
  }
  
  const envData = await envResponse.json();
  const environments = envData.data.environments;
  const environment = environments?.find((e: any) => e.slug === environmentSlug);
  
  if (!environment) {
    throw new Error(`Environment with slug "${environmentSlug}" not found`);
  }
  
  const environmentId = environment.id;
  console.log(`Found environment "${environmentSlug}" with ID: ${environmentId}`);
  
  // Build the API URL with environment filter
  const apiUrl = `/api/test-runs?project_id=3&limit=100&offset=0&interval_in_days=30&environment_ids=${environmentId}`;
  
  // Make an API request to get test runs data
  const apiResponse = await page.request.get(apiUrl);
  
  if (!apiResponse.ok()) {
    throw new Error(`Test runs API request failed with status ${apiResponse.status()}`);
  }
  
  // Parse the response data
  const responseData = await apiResponse.json();
  
  // Find a test run that has ended state and has exactly 1 failure (before snoozing)
  const testRunsWithOneFailure = responseData.data.test_runs.items.filter(
    (testRun: any) => testRun.state === 'ended' && testRun.failed_count === 1
  );
  
  if (testRunsWithOneFailure.length === 0) {
    throw new Error(`No completed test runs with exactly 1 failure found for environment "${environmentSlug}"`);
  }
  
  const testRun = testRunsWithOneFailure[0];
  const testRunId = testRun.id;
  
  console.log('Found test run with exactly 1 failure:', testRunId);
  
  return { testRunId, testRun };
}

/**
 * Gets a recently completed test run with multiple failures
 * @param page The Playwright page object
 * @param minFailures Minimum number of failures required (default: 2)
 * @returns Object with testRunId, the full test run data, and failure count
 */
export async function getTestRunWithMultipleFailures(page: Page, minFailures: number = 2): Promise<{ testRunId: number; testRun: any; failureCount: number }> {
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
  
  // Find a test run that has ended state and has multiple failures
  const testRunsWithMultipleFailures = responseData.data.test_runs.items.filter(
    (testRun: any) => testRun.state === 'ended' && testRun.failed_count_after_snoozing >= minFailures
  );
  
  if (testRunsWithMultipleFailures.length === 0) {
    throw new Error(`No completed test runs with ${minFailures} or more failures found`);
  }
  
  const testRun = testRunsWithMultipleFailures[0];
  const testRunId = testRun.id;
  const failureCount = testRun.failed_count_after_snoozing;
  
  return { testRunId, testRun, failureCount };
}

/**
 * Gets a recently completed test run with multiple failures for a specific environment
 * @param page The Playwright page object
 * @param environmentSlug The environment slug to filter by (e.g. 'staging')
 * @param minFailures Minimum number of failures required (default: 2)
 * @returns Object with testRunId, the full test run data, and failure count
 */
export async function getTestRunWithMultipleFailuresForEnvironment(page: Page, environmentSlug: string, minFailures: number = 2): Promise<{ testRunId: number; testRun: any; failureCount: number }> {
  // Navigate to the test runs page
  await page.getByRole('link', { name: 'Test Runs' }).click();
  
  // Wait for the table to load
  await page.locator('tbody tr').first().waitFor({ state: 'visible', timeout: 10000 });
  
  // Fetch the environment by slug
  const envResponse = await page.request.get(`/api/environments/list?project_repo_name=lorem-ipsum-tests&environment_slug=${environmentSlug}`);
  
  if (!envResponse.ok()) {
    throw new Error(`Environments API request failed with status ${envResponse.status()}`);
  }
  
  const envData = await envResponse.json();
  const environment = envData.data.environment;
  
  if (!environment) {
    throw new Error(`Environment with slug "${environmentSlug}" not found`);
  }
  
  const environmentId = environment.id;
  console.log(`Found environment "${environmentSlug}" with ID: ${environmentId}`);
  
  // Build the API URL with environment filter
  const apiUrl = `/api/test-runs?project_id=3&limit=100&offset=0&interval_in_days=30&environment_ids=${environmentId}`;
  
  // Make an API request to get test runs data
  const apiResponse = await page.request.get(apiUrl);
  
  if (!apiResponse.ok()) {
    throw new Error(`Test runs API request failed with status ${apiResponse.status()}`);
  }
  
  // Parse the response data
  const responseData = await apiResponse.json();
  
  // Find a test run that has ended state and has multiple failures
  const testRunsWithMultipleFailures = responseData.data.test_runs.items.filter(
    (testRun: any) => testRun.state === 'ended' && testRun.failed_count_after_snoozing >= minFailures
  );
  
  if (testRunsWithMultipleFailures.length === 0) {
    throw new Error(`No completed test runs with ${minFailures} or more failures found for environment "${environmentSlug}"`);
  }
  
  const testRun = testRunsWithMultipleFailures[0];
  const testRunId = testRun.id;
  const failureCount = testRun.failed_count_after_snoozing;
  
  console.log(`Found test run with ${failureCount} failures:`, testRunId);
  
  return { testRunId, testRun, failureCount };
}

/**
 * Gets a recently completed test run with failed tests for a specific environment
 * @param page The Playwright page object
 * @param environmentSlug The environment slug to filter by (e.g. 'staging')
 * @param options Optional configuration
 * @returns Object with testRunId and the full test run data
 */
export async function getRecentFailedTestRunForEnvironment(page: Page, environmentSlug: string, options?: { excludeExampleCom?: boolean }): Promise<{ testRunId: number; testRun: any }> {
  // Navigate to the test runs page
  await page.getByRole('link', { name: 'Test Runs' }).click();
  
  // Wait for the table to load
  await page.locator('tbody tr').first().waitFor({ state: 'visible', timeout: 10000 });
  
  // Fetch the environment by slug
  const envResponse = await page.request.get(`/api/environments/list?project_repo_name=lorem-ipsum-tests&environment_slug=${environmentSlug}`);
  
  if (!envResponse.ok()) {
    throw new Error(`Environments API request failed with status ${envResponse.status()}`);
  }
  
  const envData = await envResponse.json();
  const environment = envData.data.environment;
  
  if (!environment) {
    throw new Error(`Environment with slug "${environmentSlug}" not found`);
  }
  
  const environmentId = environment.id;
  console.log(`Found environment "${environmentSlug}" with ID: ${environmentId}`);
  
  // Build the API URL with environment filter
  const apiUrl = `/api/test-runs?project_id=3&limit=100&offset=0&interval_in_days=30&environment_ids=${environmentId}`;
  
  // Make an API request to get test runs data
  const apiResponse = await page.request.get(apiUrl);
  
  if (!apiResponse.ok()) {
    throw new Error(`Test runs API request failed with status ${apiResponse.status()}`);
  }
  
  // Parse the response data
  const responseData = await apiResponse.json();
  
  // Find a test run that has ended state and has failed tests
  const endedTestRuns = responseData.data.test_runs.items.filter(
    (testRun: any) => {
      const hasEnded = testRun.state === 'ended' && testRun.failed_count_after_snoozing > 0;
      
      // If we should exclude example.com, filter those out
      if (options?.excludeExampleCom) {
        const hasExampleCom = testRun.environment_variables_overrides?.some(
          (envVar: any) => envVar.value?.includes('example.com')
        );
        return hasEnded && !hasExampleCom;
      }
      
      return hasEnded;
    }
  );
  
  if (endedTestRuns.length === 0) {
    const errorMsg = options?.excludeExampleCom 
      ? `No completed test runs with failures (excluding example.com) found for environment "${environmentSlug}"`
      : `No completed test runs with failures found for environment "${environmentSlug}"`;
    throw new Error(errorMsg);
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
  const apiResponse = await page.request.get('/api/test-runs?project_id=3&limit=100&offset=0&interval_in_days=30');
  
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
  // Extract the current URL to get the project slug
  const currentUrl = page.url();
  const urlMatch = currentUrl.match(/https?:\/\/[^/]+\/([^/]+)/);
  const projectSlug = urlMatch ? urlMatch[1] : 'lorem-ipsum';
  
  // Navigate directly to the test run page
  await page.goto(`/${projectSlug}/test-runs/${testRunId}`);
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

/**
 * Verifies that logs content is available in the dialog
 * @param dialogContent The dialog locator containing the logs
 * @param logType Description of the log type being verified (for logging purposes)
 */
export async function verifyLogsContent(dialogContent: Locator, logType: string): Promise<void> {
  // The logs might be in pre/code tags or plain text
  const hasLogContent = await dialogContent.locator('pre, code, textarea').count() > 0 ||
                        await dialogContent.getByText(/.+/).count() > 2; // More than just headers
  expect(hasLogContent).toBeTruthy();
  console.log(`${logType} view has content`);
}
