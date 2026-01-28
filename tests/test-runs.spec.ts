import { test, expect } from "./fixtures";
import { setVideoLabel } from "@empiricalrun/playwright-utils/test";
import { getRecentFailedTestRun, getRecentFailedTestRunForEnvironment, goToTestRun, getFailedTestLink, getTestRunWithOneFailure, getTestRunWithOneFailureForEnvironment, getTestRunWithMultipleFailures, getTestRunWithMultipleFailuresForEnvironment, verifyLogsContent } from "./pages/test-runs";

test.describe("Test Runs Page", () => {
  test("submit button is not disabled when triggering test run", async ({ page }) => {
    // Navigate to test runs page
    await page.goto("/");
    
    // Navigate to Test Runs section
    await page.getByRole('link', { name: 'Test Runs' }).click();
    
    // Click "New Test Run" button to open the trigger dialog
    await page.getByRole('button', { name: 'New Test Run' }).click();
    
    // Verify that the "Trigger Test Run" button is not disabled
    const triggerButton = page.getByRole('button', { name: 'Trigger Test Run' });
    await expect(triggerButton).toBeVisible();
    await expect(triggerButton).not.toBeDisabled();
  });

  test("create and cancel a test run", async ({ page }) => {
    // Navigate to the app first to establish session/authentication
    await page.goto("/");

    // Trigger test run via API with build info (uses authenticated session cookies)
    const response = await page.request.put('/api/test-runs', {
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        project_id: 3, // lorem-ipsum project
        environment: 'staging',
        build: {
          url: 'https://lorem-ipsum-app-env-staging-empirical.vercel.app/',
          commit: 'a1b2c3d4e5f6',
          branch: 'feat/jan-28-2026'
        }
      }
    });

    // Verify the API response is successful
    expect(response.ok()).toBeTruthy();
    const responseBody = await response.json();
    const testRunId = responseBody.data.test_run.id;
    expect(testRunId).toBeTruthy();
    
    // Navigate to the test run details page
    await page.goto(`/lorem-ipsum/test-runs/${testRunId}`);
    
    // Verify that we're on the test run page and it's queued
    await expect(page.getByText('Test run queued')).toBeVisible({ timeout: 10000 });
    
    // Cancel the test run
    await page.getByRole('button', { name: 'Cancel run' }).nth(1).click();
    await page.getByRole('button', { name: 'Cancel Run' }).click();
    
    // Wait for the cancellation to complete - check for the heading
    await expect(page.getByRole('heading', { name: 'Test run canceled' })).toBeVisible();
  });

  test("trigger a new test run and monitor through completion", async ({ page }) => {
    // Set video label for main page
    setVideoLabel(page, 'test-run-detail');
    
    // Navigate to test runs page
    await page.goto("/");
    await page.getByRole('link', { name: 'Test Runs' }).click();
    
    // Click "New Test Run" button to open the trigger dialog
    await page.getByRole('button', { name: 'New Test Run' }).click();
    
    // Set up network interception to capture the test run creation response
    const testRunCreationPromise = page.waitForResponse(response => 
      response.url().includes('/api/test-runs') && response.request().method() === 'PUT'
    );

    // Trigger the test run on default preselected environment
    await page.getByRole('button', { name: 'Trigger Test Run' }).click();

    // Wait for the test run creation response and extract the ID
    const response = await testRunCreationPromise;
    const responseBody = await response.json();
    const testRunId = responseBody.data.test_run.id;
    
    // After triggering, the app automatically navigates to the test run details page
    await page.waitForURL(`**/test-runs/${testRunId}`, { timeout: 10000 });
    
    // Wait for and assert it shows queued or in progress status
    await expect(page.getByText(/Test run (queued|in progress)/)).toBeVisible({ timeout: 120000 });
    
    // Wait for run to complete and show failed status - wait up to 5 mins
    // The "Failed" badge appears in the header when tests complete
    await expect(page.locator('text=Test run on staging').locator('..').getByText('Failed')).toBeVisible({ timeout: 300000 }); // 5 minutes timeout
    
    // Wait for the page to load and show the Group by dropdown
    await expect(page.getByText('Group by')).toBeVisible();
    
    // Click on "Group by" dropdown - find the combobox next to the "Group by" text
    const groupByDropdown = page.locator('text=Group by').locator('..').getByRole('combobox');
    await groupByDropdown.click();
    
    // Select "Failing line" from the dropdown options
    await page.getByRole('option', { name: 'Failing line' }).click();
    
    // Assert that the failing line grouping is visible
    await expect(page.getByText('Failing line').first()).toBeVisible();
    
    // Assert that the actual failing line code is visible in the error details
    await expect(page.getByText('searchPage', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('.not.toBeVisible()', { exact: false }).first()).toBeVisible();
    
    // Test the detailed test report page functionality
    // Click on the first failed test name to open the detailed report page
    // In the new UI, the failed test name appears as a link in the table
    await page.getByRole('link', { name: 'search for database shows only 1 card' }).click();
    
    // Verify we are on a detailed test page (should have test report elements)
    await expect(page.getByText('Visual Comparison')).toBeVisible();
    
    // Test video functionality from detailed page - the video player should already be visible
    await expect(page.locator('video, .video-player, [data-testid*="video"]').first()).toBeVisible();
    
    // Test trace functionality from detailed page
    const detailedTracePagePromise = page.waitForEvent('popup');
    await page.getByRole('link', { name: 'View trace' }).click();
    const detailedTracePage = await detailedTracePagePromise;
    setVideoLabel(detailedTracePage, 'trace-viewer-2');
    await expect(detailedTracePage.url()).toContain('trace');
  });

  test("fetch recently completed test run via API and navigate to its page", async ({ page }) => {
    // Navigate to the app first to establish session/authentication
    await page.goto("/");
    
    // Navigate to the test runs page
    await page.getByRole('link', { name: 'Test Runs' }).click();
    
    // Wait for the table to load with SSR data
    await page.locator('tbody tr').first().waitFor({ state: 'visible', timeout: 10000 });
    
    // Make an API request to get test runs data
    const apiResponse = await page.request.get('/api/test-runs?project_id=3&limit=100&offset=0&interval_in_days=30');
    
    // Verify the API response is successful
    console.log('API response status:', apiResponse.status());
    console.log('API response URL:', apiResponse.url());
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
    
    // Click on the test run link in the UI (it should be visible from SSR)
    const testRunLink = page.locator(`a[href*="/test-runs/${testRunId}"]`).first();
    await expect(testRunLink).toBeVisible({ timeout: 5000 });
    await testRunLink.click();
    
    // Verify we're on the specific test run page
    await expect(page).toHaveURL(new RegExp(`test-runs/${testRunId}`));
    
    // Verify the page loads with test run data - look for more specific elements
    // that would be on a completed test run page
    await expect(page.getByText('Failed', { exact: false }).first()).toBeVisible({ timeout: 10000 });
  });

  test("customize env vars for a test run", async ({ page }) => {
    // Navigate to test runs page
    await page.goto("/");
    await page.getByRole('link', { name: 'Test Runs' }).click();
    
    // Click "New Test Run" button to open the trigger dialog
    await page.getByRole('button', { name: 'New Test Run' }).click();
    
    // Add a test run override for BASE_URL using the new UI
    await page.getByRole('button', { name: 'Edit' }).click();
    
    // Clear the textarea and set the BASE_URL override
    const envVarsTextarea = page.getByRole('textbox', { name: /KEY=value/ });
    await envVarsTextarea.clear();
    await envVarsTextarea.fill('BASE_URL=https://example.com');
    
    // Save the override
    await page.getByRole('button', { name: 'Save' }).click();
    
    // Set up network interception to capture the test run creation response
    const testRunCreationPromise = page.waitForResponse(response => 
      response.url().includes('/api/test-runs') && response.request().method() === 'PUT'
    );
    
    // Trigger the test run
    await page.getByRole('button', { name: 'Trigger Test Run' }).click();

    // Wait for the test run creation response and extract the ID
    const response = await testRunCreationPromise;
    const responseBody = await response.json();
    const testRunId = responseBody.data.test_run.id;
    
    // After triggering, the app automatically navigates to the test run details page
    // Verify that we're on the test run page and it's queued
    await page.waitForURL(`**/test-runs/${testRunId}`, { timeout: 10000 });
    await expect(page.getByText('Test run queued')).toBeVisible({ timeout: 10000 });
    
    // Wait a moment for the test run to potentially start (so it can be canceled)
    await page.waitForTimeout(2000);
    
    // Cancel the test run to clean up
    await page.getByRole('button', { name: 'Cancel run' }).nth(1).click();
    await page.getByRole('button', { name: 'Cancel Run' }).click();
    
    // Wait for the cancellation to complete
    await expect(page.getByRole('heading', { name: 'Test run canceled' })).toBeVisible();
  });

  test("redirect from lorem-ipsum-tests to lorem-ipsum test-runs", async ({ page }) => {
    // Navigate to the old path that should redirect
    await page.goto("/lorem-ipsum-tests/test-runs");
    
    // Wait for page to load and verify first test run link is visible (indicating page loaded correctly)
    // Test run links start with "#" followed by numbers (e.g., "#6666")
    await expect(page.getByRole('link', { name: /^#\d+/ }).first()).toBeVisible({ timeout: 10000 });
    
    // Verify that we've been redirected to the correct path
    await expect(page).toHaveURL(/\/lorem-ipsum\/test-runs/);
  });

  test("show unauthorized when accessing another project's test run", async ({ page }) => {
    test.skip(process.env.TEST_RUN_ENVIRONMENT === "preview", "Skipping in preview environment");
    
    // Navigate to a test run from a different project (quizizz instead of lorem-ipsum)
    await page.goto("/quizizz/test-runs/37041?status=failed&group_by=none");
    
    // Verify that the page shows an unauthorized error
    await expect(page.getByText('Unauthorized', { exact: false })).toBeVisible({ timeout: 10000 });
  });

  test("show test run not found for non-existent project", async ({ page }) => {
    // Navigate to a test run with a non-existent project slug
    await page.goto("/lorem-ipsum/test-runs/37041?status=failed&group_by=none");
    
    // Verify that the page shows a not found error
    await expect(page.getByText('Test run not found', { exact: false })).toBeVisible({ timeout: 10000 });
    
    // Verify that the API endpoint also returns 403 (forbidden for non-existent project)
    // Backend bug: API returns 200 with project data instead of 404 for non-existent test run
    const response = await page.request.get("/api/test-runs/37041?project_id=1");
    expect(response.status()).toBe(403);
  });

  test("Trigger test run for invalid env shows error", async ({ page }) => {
    // Navigate to test runs page
    await page.goto("/");
    await page.getByRole('link', { name: 'Test Runs' }).click();
    
    // Click "New Test Run" button to open the trigger dialog
    await page.getByRole('button', { name: 'New Test Run' }).click();
    
    // Select the "env-no-match-projects" environment from the dropdown
    await page.getByRole('combobox', { name: 'Environment' }).click();
    await page.getByRole('option', { name: 'env-no-match-projects' }).click();
    
    // Set up network interception to capture the test run creation response
    const testRunCreationPromise = page.waitForResponse(response => 
      response.url().includes('/api/test-runs') && response.request().method() === 'PUT'
    );
    
    // Trigger the test run
    await page.getByRole('button', { name: 'Trigger Test Run' }).click();
    
    // Wait for the test run creation response and extract the ID
    const response = await testRunCreationPromise;
    const responseBody = await response.json();
    const testRunId = responseBody.data.test_run.id;
    
    // After triggering, the app automatically navigates to the test run details page
    await page.waitForURL(`**/test-runs/${testRunId}`, { timeout: 10000 });
    
    // Wait up to 3.5 minutes for test run to complete and show "Test report was not generated" error
    await expect(page.getByText('Test report was not generated')).toBeVisible({ timeout: 210000 });
    
    // Click on "Run logs" to view the logs
    await page.getByRole('button', { name: 'Run logs' }).click();
    
    // Assert that the error message is visible in the logs
    // Use .first() to handle multiple instances of the same error in logs
    await expect(page.getByText('No projects found').first()).toBeVisible();
  });

  test("test run with merge conflict", async ({ page }) => {
    test.skip(process.env.TEST_RUN_ENVIRONMENT === "preview", "Skipping in preview environment");
    
    // This test verifies that triggering a test run with a branch that has merge conflicts
    // results in an appropriate error message being displayed to the user
    
    // Navigate to test runs page
    await page.goto("/");
    await page.getByRole('link', { name: 'Test Runs' }).click();
    
    // Set up route interception to modify the test run trigger request
    // We intercept the UI's request and change the branch to 'feat/merge-conflict'
    await page.route('**/api/test-runs', async (route) => {
      if (route.request().method() === 'PUT') {
        // Get the original request body
        const originalBody = route.request().postDataJSON();
        
        // Modify the build to use the merge conflict branch
        const modifiedBody = {
          ...originalBody,
          build: {
            ...originalBody.build,
            branch: 'feat/merge-conflict'
          }
        };
        
        console.log('Modified test run request with branch:', modifiedBody.build.branch);
        
        // Continue with the modified request
        await route.continue({
          postData: JSON.stringify(modifiedBody),
          headers: {
            ...route.request().headers(),
            'Content-Type': 'application/json'
          }
        });
      } else {
        await route.continue();
      }
    });
    
    // Click "New Test Run" button to open the trigger dialog
    await page.getByRole('button', { name: 'New Test Run' }).click();
    
    // Set up network interception to capture the test run creation response
    const testRunCreationPromise = page.waitForResponse(response => 
      response.url().includes('/api/test-runs') && response.request().method() === 'PUT',
      { timeout: 30000 }
    );
    
    // Trigger the test run via UI (which will be intercepted and modified)
    await page.getByRole('button', { name: 'Trigger Test Run' }).click();
    
    // Verify that an error message is visible - the error appears as a toast/banner
    await expect(page.getByText('Failed to trigger test run').first()).toBeVisible({ timeout: 30000 });
    
    // Check if a test run was created despite the error
    const response = await testRunCreationPromise.catch(() => null);
    
    if (response) {
      const responseBody = await response.json().catch(() => null);
      
      console.log('Test run creation response:', responseBody);
      
      // If a test run was created, navigate to its details page
      if (responseBody?.data?.test_run?.id) {
        const testRunId = responseBody.data.test_run.id;
        console.log('Test run created with ID:', testRunId);
        
        // Navigate to the test run details page
        await page.goto(`/lorem-ipsum/test-runs/${testRunId}`);
        
        // Assert that the page shows "Merge conflict detected" message
        await expect(
          page.getByText('Merge conflict detected')
        ).toBeVisible({ timeout: 60000 });
        
        console.log('Successfully verified "Merge conflict detected" message on test run details page');
      }
    }
  });

  test("playwright html report works", async ({ page }) => {
    // Set video label for main page
    setVideoLabel(page, 'test-run-page');
    
    // Navigate to the app first to establish session/authentication
    await page.goto("/");
    
    // Use helper to get a recent failed test run from staging for reliability (excluding example.com env vars)
    const { testRunId } = await getRecentFailedTestRunForEnvironment(page, 'staging', { excludeExampleCom: true });
    
    // Navigate to the test run page
    await goToTestRun(page, testRunId);
    
    // Wait for the test run page to load
    await expect(page.getByText('Failed', { exact: false }).first()).toBeVisible({ timeout: 10000 });
    
    // Click on "All tests" link and wait for the new tab to open
    const reportPagePromise = page.waitForEvent('popup');
    await page.getByRole('link', { name: /All tests/ }).click();
    const reportPage = await reportPagePromise;
    setVideoLabel(reportPage, 'playwright-html-report');
    
    // Verify playwright html report opens (URL should contain index.html)
    await expect(reportPage).toHaveURL(/index\.html/);
    
    // Wait for the report page to load
    await reportPage.waitForLoadState('networkidle');
    
    // Click on a failed test that has "search" in the name
    await reportPage.getByRole('link', { name: 'search.spec.ts:18' }).click();
    
    // Wait for the test details page to load
    await expect(reportPage.getByText('search for database shows only 1 card')).toBeVisible();
    
    // Verify "Errors" section is visible (error context)
    await expect(reportPage.getByText('Errors')).toBeVisible();
    
    // Verify error message is displayed
    await expect(reportPage.getByText('expect(locator).not.toBeVisible() failed')).toBeVisible();
    
    // Verify "View Trace" link/button is present
    const viewTraceButton = reportPage.getByRole('link', { name: 'View Trace' });
    await expect(viewTraceButton).toBeVisible();
    
    // Verify trace link has correct href attribute (contains 'trace')
    await expect(viewTraceButton).toHaveAttribute('href', /trace/);
    
    // Verify "Screenshots" section is visible
    await expect(reportPage.getByRole('button', { name: 'Screenshots' })).toBeVisible();
    
    // Verify screenshot images are present and accessible
    const screenshotCount = await reportPage.locator('img').count();
    expect(screenshotCount).toBeGreaterThan(0);
    
    // Test screenshot link - should trigger download
    const screenshotLink = reportPage.getByRole('link', { name: 'screenshot' }).first();
    await expect(screenshotLink).toBeVisible();
    const screenshotUrl = await screenshotLink.getAttribute('href');
    expect(screenshotUrl).toBeTruthy();
    
    // Verify screenshot URL returns 200 status (file exists and is accessible)
    const screenshotResponse = await reportPage.request.get(screenshotUrl!);
    expect(screenshotResponse.status()).toBe(200);
    
    // Click screenshot link and verify it triggers a download
    const screenshotDownloadPromise = reportPage.waitForEvent('download');
    await screenshotLink.click();
    const screenshotDownload = await screenshotDownloadPromise;
    expect(screenshotDownload.suggestedFilename()).toContain('screenshot');
    
    // Test error-context link - should trigger download
    const errorContextLink = reportPage.getByRole('link', { name: 'error-context' });
    await expect(errorContextLink).toBeVisible();
    const errorContextUrl = await errorContextLink.getAttribute('href');
    expect(errorContextUrl).toBeTruthy();
    
    // Verify error-context URL returns 200 status
    const errorContextResponse = await reportPage.request.get(errorContextUrl!);
    expect(errorContextResponse.status()).toBe(200);
    
    // Click error-context link and verify it triggers a download
    const errorContextDownloadPromise = reportPage.waitForEvent('download');
    await errorContextLink.click();
    const errorContextDownload = await errorContextDownloadPromise;
    expect(errorContextDownload.suggestedFilename()).toContain('error-context');
    
    // Test video link - should trigger download
    const videoLink = reportPage.getByRole('link', { name: /^video: / }).first();
    await expect(videoLink).toBeVisible();
    const videoUrl = await videoLink.getAttribute('href');
    expect(videoUrl).toBeTruthy();
    
    // Verify video URL returns 200 status
    const videoResponse = await reportPage.request.get(videoUrl!);
    expect(videoResponse.status()).toBe(200);
    
    // Click video link and verify it triggers a download
    const videoDownloadPromise = reportPage.waitForEvent('download');
    await videoLink.click();
    const videoDownload = await videoDownloadPromise;
    expect(videoDownload.suggestedFilename()).toMatch(/\.webm$/);
    
    // Verify "Test Steps" section is visible (this shows the execution flow)
    await expect(reportPage.getByRole('button', { name: 'Test Steps' })).toBeVisible();
    
    // Click on View Trace to verify it works (it navigates in the same tab)
    await viewTraceButton.click();
    
    // Verify trace viewer loads with correct URL
    await expect(reportPage).toHaveURL(/trace/);
    
    // Verify trace actually loaded successfully (not showing an error)
    // If trace fails to load, it shows "Could not load trace" error
    await expect(reportPage.getByText('Could not load trace')).not.toBeVisible({ timeout: 10000 });
    
    // Verify trace viewer interface is loaded properly with action list visible
    await expect(reportPage.getByText('Before Hooks').or(reportPage.getByText('Navigate to')).first()).toBeVisible({ timeout: 10000 });
  });
  test("trigger new test run with sharding and monitor completion", async ({ page }) => {
    // Set video label for main page
    setVideoLabel(page, 'test-run-sharding');
    
    // Navigate to test runs page
    await page.goto("/");
    await page.getByRole('link', { name: 'Test Runs' }).click();
    
    // Click "New Test Run" button to open the trigger dialog
    await page.getByRole('button', { name: 'New Test Run' }).click();
    
    // Click on "Advanced" tab to access advanced settings
    await page.getByRole('tab', { name: 'Advanced' }).click();
    
    // Set shards to 2
    const shardsInput = page.getByLabel('Shards');
    await shardsInput.clear();
    await shardsInput.fill('2');
    
    // Set up network interception to capture the test run creation response
    const testRunCreationPromise = page.waitForResponse(response => 
      response.url().includes('/api/test-runs') && response.request().method() === 'PUT'
    );

    // Trigger the test run on default preselected environment
    await page.getByRole('button', { name: 'Trigger Test Run' }).click();

    // Wait for the test run creation response and extract the ID
    const response = await testRunCreationPromise;
    const responseBody = await response.json();
    const testRunId = responseBody.data.test_run.id;
    
    // After triggering, the app automatically navigates to the test run details page
    await page.waitForURL(`**/test-runs/${testRunId}`, { timeout: 10000 });
    
    // Wait for and assert it shows queued or in progress status
    await expect(page.getByText(/Test run (queued|in progress)/)).toBeVisible({ timeout: 120000 });
    
    // Wait for run to complete - wait up to 7.5 mins (based on successful run timing)
    // The status badge (Failed/Passed/Partial) appears in the header when tests complete
    await expect(page.locator('text=Test run on staging').locator('..').getByText(/Failed|Passed|Partial/)).toBeVisible({ timeout: 450000 }); // 7.5 minutes timeout
    
    // Reload the page to get the latest shard status
    await page.reload();
    
    // Wait for the page to load after reload
    await expect(page.getByText('Test run on staging')).toBeVisible();
    
    // Click on "Run logs" button to open the logs dialog
    await page.getByRole('button', { name: 'Run logs' }).click();
    
    // Wait for the logs dialog to be visible
    await expect(page.getByRole('dialog')).toBeVisible();
    
    // Find the dropdown for selecting log type
    const logsDropdown = page.getByRole('dialog').getByRole('combobox').first();
    await expect(logsDropdown).toBeVisible();
    
    // Verify "Overall" is the default selection
    await expect(logsDropdown).toHaveText(/overall/i);
    
    // Click the dropdown to see all options
    await logsDropdown.click();
    
    // Verify all 4 options are present: shard 1, shard 2, merge reports, overall
    await expect(page.getByRole('option', { name: /shard.*1/i })).toBeVisible();
    await expect(page.getByRole('option', { name: /shard.*2/i })).toBeVisible();
    await expect(page.getByRole('option', { name: /merge/i })).toBeVisible();
    await expect(page.getByRole('option', { name: /overall/i })).toBeVisible();
    
    // Close the dropdown by clicking overall again
    await page.getByRole('option', { name: /overall/i }).click();
    
    // For "Overall", verify the summary table is visible
    const summaryTable = page.getByRole('dialog').getByRole('table');
    await expect(summaryTable).toBeVisible();
    
    // Verify the table has shard information
    await expect(page.getByRole('dialog').getByText('1/2')).toBeVisible();
    await expect(page.getByRole('dialog').getByText('2/2')).toBeVisible();
    
    // Verify stats show all shards completed (0 Queued, 0 Running, 2 Completed, 0 Errors)
    await expect(page.getByRole('dialog').getByText('Total')).toBeVisible();
    await expect(page.getByRole('dialog').getByText('2').first()).toBeVisible(); // 2 Total
    
    // Verify all shards are completed (not queued or running)
    const completedCount = page.getByRole('dialog').locator('text=/^Completed$/').locator('..').getByText('2');
    await expect(completedCount).toBeVisible();
    
    // Verify 0 errors
    const errorsCount = page.getByRole('dialog').locator('text=/^Errors$/').locator('..').getByText('0');
    await expect(errorsCount).toBeVisible();
    
    // Verify both shard rows show completed/ended state (not queued)
    const tableRows = summaryTable.locator('tbody tr');
    const rowCount = await tableRows.count();
    expect(rowCount).toBeGreaterThanOrEqual(2);
    
    // Check that both shards show completed/ended state
    for (let i = 0; i < Math.min(rowCount, 2); i++) {
      const row = tableRows.nth(i);
      const stateCell = row.locator('td').nth(1); // State column is typically 2nd
      const stateText = await stateCell.textContent();
      expect(stateText?.toLowerCase()).toMatch(/completed|ended|success/);
      console.log(`Shard ${i + 1} state: ${stateText}`);
    }
    
    // Get dialog content reference
    const dialogContent = page.getByRole('dialog');
    
    // Try selecting Shard 1 to see individual logs
    await logsDropdown.click();
    await page.getByRole('option', { name: /shard.*1/i }).click();
    
    // Wait for logs to load
    await expect(dialogContent.getByText('Loading logs...')).not.toBeVisible({ timeout: 30000 });
    
    // Verify Shard 1 view has content
    await verifyLogsContent(dialogContent, 'Shard 1');
    
    // Switch to Shard 2
    await logsDropdown.click();
    await page.getByRole('option', { name: /shard.*2/i }).click();
    
    // Wait for logs to load
    await expect(dialogContent.getByText('Loading logs...')).not.toBeVisible({ timeout: 30000 });
    
    // Verify Shard 2 view has content
    await verifyLogsContent(dialogContent, 'Shard 2');
    
    // Switch to Merge reports
    await logsDropdown.click();
    await page.getByRole('option', { name: /merge/i }).click();
    
    // Wait for logs to load
    await expect(dialogContent.getByText('Loading logs...')).not.toBeVisible({ timeout: 30000 });
    
    // Verify Merge reports view has content
    await verifyLogsContent(dialogContent, 'Merge reports');
    
    // Switch back to Overall
    await logsDropdown.click();
    await page.getByRole('option', { name: /overall/i }).click();
    
    // Verify we're back to the summary table view
    await expect(summaryTable).toBeVisible();
    console.log('Successfully verified all dropdown options and content');
  });

  test("re-run only failed tests works correctly", async ({ page }) => {
    // Set video label for main page
    setVideoLabel(page, 'rerun-failed-tests');
    
    // Navigate to the app first to establish session/authentication
    await page.goto("/");
    
    // Find a test run with exactly 1 failure from staging environment for reliability
    const { testRunId } = await getTestRunWithOneFailureForEnvironment(page, 'staging');
    
    // Navigate to the test run
    await goToTestRun(page, testRunId);
    
    // Wait for the test run page to load
    await expect(page.getByText('Failed', { exact: false }).first()).toBeVisible({ timeout: 10000 });
    
    // Set up network interception to capture the test run creation response
    const testRunCreationPromise = page.waitForResponse(response => 
      response.url().includes('/api/test-runs') && response.request().method() === 'PUT'
    );
    
    // Click on "Re-run" dropdown button to open the menu
    await page.getByRole('button', { name: 'Re-run' }).click();
    
    // Click on "Re-run failed tests" option from the dropdown
    await page.getByRole('menuitem', { name: 'Re-run failed tests' }).click();
    
    // Wait for the test run creation response and extract the ID
    const response = await testRunCreationPromise;
    const responseBody = await response.json();
    const newTestRunId = responseBody.data.test_run.id;
    
    console.log('New test run created:', newTestRunId);
    
    // After triggering, the app automatically navigates to the new test run details page
    await page.waitForURL(`**/test-runs/${newTestRunId}`, { timeout: 10000 });
    
    // Verify the page shows this is a re-run of the original test run with failed tests only
    await expect(page.getByText(`Re-run of #${testRunId} (failed tests only)`)).toBeVisible({ timeout: 10000 });
    
    // Wait for and assert it shows queued or in progress status
    await expect(page.getByText(/Test run (queued|in progress)/)).toBeVisible({ timeout: 120000 });
    
    // Wait for run to complete and show failed status - wait up to 5 mins
    // The "Failed" badge appears in the header when tests complete
    await expect(page.locator('text=Test run on staging').locator('..').getByText('Failed')).toBeVisible({ timeout: 300000 }); // 5 minutes timeout
    
    // Reload the page to ensure UI is fully updated
    await page.reload();
    
    // Wait for the page to load after reload
    await expect(page.getByText('Test run on staging')).toBeVisible();
    
    // Assert that only 1 test was run (the failed one)
    await expect(page.getByText('All tests (1)')).toBeVisible();
    
    // Assert the test run failed (since the test that failed originally should fail again)
    await expect(page.getByText('Failed').first()).toBeVisible();
    
    console.log('Successfully verified re-run only failed tests functionality');
  });

  test("bulk action - create session with all failed tests", async ({ page, trackCurrentSession }) => {
    // Navigate to the app first to establish session/authentication
    await page.goto("/");
    
    // Use helper to get a test run with multiple failures
    // Note: Not using staging-specific version as staging doesn't always have multiple failures
    const { testRunId, failureCount } = await getTestRunWithMultipleFailures(page, 2);
    
    // Navigate to the test run
    await goToTestRun(page, testRunId);
    
    // Wait for the test run page to load
    await expect(page.getByText('Failed', { exact: false }).first()).toBeVisible({ timeout: 10000 });
    
    // Click on the "Select all" checkbox to select all tests
    await page.getByRole('checkbox', { name: 'Select all' }).click();
    
    // Verify checkboxes are selected
    await expect(page.getByRole('checkbox', { name: 'Select all' })).toBeChecked();
    
    // Wait for the action bar to appear (shows "N tests selected")
    await expect(page.getByText(/\d+ test(s)? selected/)).toBeVisible();
    
    // Click on "New Session" button in the action bar (the one that appears after selecting tests)
    const actionBar = page.locator('text=/\\d+ test(s)? selected/').locator('..');
    await actionBar.getByRole('button', { name: 'New Session' }).click();
    
    // Wait for the "Create new session" dialog to open
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Create new session')).toBeVisible();
    
    // Get the prompt textarea field in the dialog
    const promptTextarea = page.getByRole('dialog').locator('textarea').first();
    await expect(promptTextarea).toBeVisible();
    
    // Get the textarea value
    const textareaValue = await promptTextarea.inputValue();
    
    // Assert that the textarea contains the report URL with diagnosis links
    expect(textareaValue).toContain('https://');
    expect(textareaValue).toContain('test-runs');
    expect(textareaValue).toContain('detail=');
    expect(textareaValue.length).toBeGreaterThan(50);
    
    // Count the number of links in the textarea
    const linkCount = (textareaValue.match(/https:\/\//g) || []).length;
    expect(linkCount).toBeGreaterThanOrEqual(failureCount);
    
    // Verify each link has a unique detail parameter (different diagnosis IDs)
    const detailMatches = textareaValue.match(/detail=([a-zA-Z0-9]+)/g);
    const uniqueDetails = new Set(detailMatches);
    expect(uniqueDetails.size).toBeGreaterThan(1);
    
    // BUG: Try to edit the textarea - it should be editable but it's not
    // Click on the textarea to focus it
    await promptTextarea.click();
    
    // Try to clear the existing content and type new text
    await promptTextarea.fill('');
    await promptTextarea.fill('This is a test edit to verify textarea is editable');
    
    // Verify the textarea now contains the edited text (this should FAIL if textarea is not editable)
    const editedValue = await promptTextarea.inputValue();
    expect(editedValue).toBe('This is a test edit to verify textarea is editable');
  });

  test("leave human triage on failed test", async ({ page }) => {
    // Navigate to the app first to establish session/authentication
    await page.goto("/");
    
    // Use helper to get a recent failed test run from staging for reliability
    const { testRunId } = await getRecentFailedTestRunForEnvironment(page, 'staging');
    
    // Navigate to the test run
    await goToTestRun(page, testRunId);
    
    // Wait for the test run page to load
    await expect(page.getByText('Failed', { exact: false }).first()).toBeVisible({ timeout: 10000 });
    
    // Click on the "View" button in the Activity column (use first() since there may be multiple)
    await page.getByRole('button', { name: 'View' }).first().click();
    
    // Wait for the Activity modal to open
    const activityDialog = page.getByRole('dialog');
    await expect(activityDialog).toBeVisible();
    await expect(activityDialog.getByText('Activity')).toBeVisible();
    
    // Click on "Add triage" button
    await activityDialog.getByRole('button', { name: 'Add triage' }).click();
    
    // Wait for the triage form to be visible
    await expect(activityDialog.getByText('Failure type')).toBeVisible();
    
    // Select "App issue" as the failure type
    await activityDialog.getByRole('button', { name: 'App issue' }).click();
    
    // Click "Save" to submit the triage
    await activityDialog.getByRole('button', { name: 'Save' }).click();
    
    // Wait for the triage to be submitted (should update the activity list)
    await page.waitForTimeout(2000);
    
    // Verify that "automation-test@example.com labeled this as" appears in the activity modal
    await expect(activityDialog.getByText(/automation-test@example\.com.*labeled this as/)).toBeVisible();
    
    // Find and click the delete icon to remove the triage
    // The delete button is an empty button (icon only) next to the triage entry
    const triageRow = activityDialog.locator('text=labeled this as').locator('..');
    await triageRow.getByRole('button').filter({ hasText: /^$/ }).click();
    
    // Wait for the deletion to complete
    await page.waitForTimeout(1000);
    
    // Verify that the triage entry is no longer visible
    await expect(activityDialog.getByText('labeled this as')).not.toBeVisible();
  });

});