import { test, expect } from "./fixtures";
import { setVideoLabel } from "@empiricalrun/playwright-utils/test";
import { getRecentFailedTestRun, goToTestRun, getFailedTestLink } from "./pages/test-runs";

test.describe("Test Runs Page", () => {
  test.describe.configure({ mode: 'default' });

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
    await page.goto("/");
    await page.getByRole('link', { name: 'Test Runs' }).click();
    await page.getByRole('button', { name: 'New Test Run' }).click();

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
    
    // Click on the specific test run to open run details page
    const testRunLink = page.locator(`a[href*="/test-runs/${testRunId}"]`);
    await expect(testRunLink).toBeVisible();
    await testRunLink.click();
    

    
    // Wait for and assert it shows in progress status
    await expect(page.getByText('Test run in progress')).toBeVisible({ timeout: 90000 });
    
    // Wait for run to complete and show failed status - wait up to 5 mins
    await expect(page.getByText('Failed').first()).toBeVisible({ timeout: 300000 }); // 5 minutes timeout
    
    // Click the Failed count/link in the Result section (robust selector)
    await page.locator('a[href*="status=failed"]').first().click();
    
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
    
    // Click the first Video button for the failed test and verify video player appears and plays
    await page.getByRole('button', { name: 'Video 1' }).click();
    await expect(page.getByRole('heading', { name: 'Video' })).toBeVisible();

    const modalVideo = page.locator('video').first();
    await expect(modalVideo).toBeVisible();

    const modalPlayButton = page.locator('media-play-button').first();
    await expect(modalPlayButton).toBeVisible();
    await expect(modalPlayButton).toHaveAttribute('aria-label', /play/i);
    await modalPlayButton.click();
    await expect(modalPlayButton).toHaveAttribute('aria-label', /pause/i);
    
    // Close the video modal
    await page.keyboard.press('Escape');
    
    // Click on the "Trace" button and verify it opens a new tab with "trace" in the URL
    const tracePagePromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Trace' }).click();
    const tracePage = await tracePagePromise;
    setVideoLabel(tracePage, 'trace-viewer-1');
    await expect(tracePage.url()).toContain('trace');
    await tracePage.close();
    
    // Now also test the detailed test report page functionality
    // Click on the first failed test name to open the detailed report page
    // Look for a test row that contains "Failed" status and click its link (UI changed from button to link)
    await page.locator('tr:has-text("Failed") a').first().click();
    
    // Verify we are on a detailed test page (should have test report elements)
    await expect(page.getByText('Visual Comparison')).toBeVisible();
    
    // Test video functionality from detailed page - the video player should already be visible
    await expect(page.locator('video, .video-player, [data-testid*="video"]').first()).toBeVisible();
    
    // Test trace functionality from detailed page
    const detailedTracePagePromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'View trace' }).click();
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
    const apiResponse = await page.request.get('/api/test-runs?project_id=3&limit=20&offset=0&interval_in_days=30');
    
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
    
    // Wait for page to load and verify first row is visible (indicating page loaded correctly)
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 10000 });
    
    // Verify that we've been redirected to the correct path
    await expect(page).toHaveURL(/\/lorem-ipsum\/test-runs/);
  });

  test("set human triage for failed test", async ({ page }) => {
    // Navigate to the app first to establish session/authentication
    await page.goto("/");
    
    // Use helper to get a recent failed test run
    const { testRunId } = await getRecentFailedTestRun(page);
    
    // Navigate to the test run
    await goToTestRun(page, testRunId);
    
    // Get and click on a failed test
    const failedTestLink = await getFailedTestLink(page);
    await failedTestLink.click();
    
    // Wait for the detail parameter to appear in the URL
    await expect(page).toHaveURL(/detail=/, { timeout: 10000 });
    
    // Verify we are on a detailed test page
    await expect(page.getByText('Visual Comparison')).toBeVisible();
    
    // Wait for failure type section to load
    await page.waitForTimeout(1000);
    
    // Ensure failure type is set first (so Edit button becomes available)
    const setButton = page.getByRole('button', { name: 'Set failure type' });
    if (await setButton.isVisible()) {
      // Initial setup - just set a basic failure type
      await setButton.click();
      await page.getByRole('button', { name: 'App issue' }).click();
      await page.getByRole('button', { name: 'Save for test' }).click();
    }
    
    // Now Edit button should be available - use it for the actual test
    const editButton = page.getByRole('button', { name: 'Edit' });
    await expect(editButton).toBeVisible();
    await editButton.click();
    
    // Generate a unique timestamp for notes
    const timestamp = Date.now().toString();
    const notesText = `Test notes: ${timestamp}`;
    
    // Select "App issue" as the failure type
    await page.getByRole('button', { name: 'App issue' }).click();
    
    // Fill in the Notes field
    await page.getByPlaceholder('Add any additional context...').fill(notesText);
    
    // Save the failure type
    await page.getByRole('button', { name: 'Save for test' }).click();
    
    // Assert that the failure type was saved successfully
    await expect(page.getByText('App issue').first()).toBeVisible();
    await expect(editButton).toBeVisible();
    
    // Verify that the failure type is correctly displayed in the Human triage section
    await expect(page.locator('div').filter({ hasText: /^Human triage/ }).getByText('App issue')).toBeVisible();
    
    // Verify the description text (test notes) is also displayed
    await expect(page.getByText(notesText)).toBeVisible();
    
    // Click Edit again to verify the notes were saved
    await editButton.click();
    
    // Assert that the notes field contains our timestamp
    await expect(page.getByPlaceholder('Add any additional context...')).toHaveValue(notesText);
    
    console.log('Successfully verified notes were saved:', notesText);
  });

  test("set human triage from list view", async ({ page }) => {
    // Navigate to the app first to establish session/authentication
    await page.goto("/");
    
    // Use helper to get a recent failed test run
    const { testRunId } = await getRecentFailedTestRun(page);
    
    // Navigate to the test run
    await goToTestRun(page, testRunId);
    
    // Wait for the test run page to load
    await expect(page.getByText('Failed', { exact: false }).first()).toBeVisible({ timeout: 10000 });
    
    // Click on "View" button in the triage column for the search test
    await page.getByRole('button', { name: 'View' }).click();
    
    // Verify the triage modal opened by checking for the modal heading
    await expect(page.getByRole('heading', { name: /Human triage/ })).toBeVisible();
    
    // Click on "Edit" to modify the triage
    await page.getByRole('button', { name: 'Edit' }).click();
    
    // Generate a unique timestamp for notes
    const timestamp = Date.now().toString();
    const notesText = `List view test notes: ${timestamp}`;
    
    // Select "Test issue" as the failure type
    await page.getByRole('button', { name: 'Test issue' }).click();
    
    // Clear existing notes and fill in our new notes
    const notesField = page.getByRole('textbox', { name: 'Add any additional context...' });
    await notesField.click();
    await notesField.clear();
    await notesField.fill(notesText);
    
    // Save the failure type
    await page.getByRole('button', { name: 'Save failure type' }).click();
    
    // Wait for the save to complete - the button changes from "Save failure type" to "Edit"
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible({ timeout: 5000 });
    
    // Verify the failure type was saved and is visible in the modal
    await expect(page.getByText('Test issue').first()).toBeVisible();
    
    // Verify the notes were saved by checking the notes text is visible in the modal
    await expect(page.getByText(notesText).first()).toBeVisible();
    
    console.log('Successfully verified list view triage was saved:', notesText);
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
    // Verify that we're on the test run page and it's queued
    await page.waitForURL(`**/test-runs/${testRunId}`, { timeout: 10000 });
    await expect(page.getByText('Test run queued')).toBeVisible({ timeout: 10000 });
    
    // Wait up to 90 seconds for error to be visible
    await expect(page.getByText('Error', { exact: false }).first()).toBeVisible({ timeout: 90000 });
    
    // Click on "Run logs" to view the logs
    await page.getByRole('button', { name: 'Run logs' }).click();
    
    // Assert that the error message about no matching projects is visible in the logs
    await expect(page.getByText(/No projects found in playwright config that matches the filtering criteria/i)).toBeVisible();
  });

});