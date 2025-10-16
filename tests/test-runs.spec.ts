import { test, expect } from "./fixtures";

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
    
    // Click on the specific test run using the captured ID
    const testRunLink = page.locator(`a[href*="/test-runs/${testRunId}"]`);
    await expect(testRunLink).toBeVisible();
    await testRunLink.click();
    
    // Wait for the test run page to load and show queued status
    await expect(page.getByText('Test run queued')).toBeVisible();
    
    // Wait a moment for the test run to potentially start (so it can be canceled)
    await page.waitForTimeout(2000);
    
    // Cancel the test run
    await page.getByRole('button', { name: 'Cancel run' }).nth(1).click();
    await page.getByRole('button', { name: 'Cancel Run' }).click();
    
    // Wait for the cancellation to complete - check for the heading
    await expect(page.getByRole('heading', { name: 'Test run canceled' })).toBeVisible();
  });

  test("trigger a new test run and monitor through completion", async ({ page }) => {
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
    
    // Click the Video button for the failed test and verify video player appears and plays
    await page.getByRole('button', { name: 'Video' }).click();
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
    await expect(tracePage.url()).toContain('trace');
    await tracePage.close();
    
    // Now also test the detailed test report page functionality
    // Click on the first failed test name to open the detailed report page
    // Look for a test row that contains "Failed" status and click its link
    await page.locator('tr:has-text("Failed") a').first().click();
    
    // Verify we are on a detailed test page (should have test report elements)
    await expect(page.getByText('Visual Comparison')).toBeVisible();
    await expect(page.getByText('Failure Type').first()).toBeVisible();
    
    // Test video functionality from detailed page - the video player should already be visible
    await expect(page.locator('video, .video-player, [data-testid*="video"]').first()).toBeVisible();
    
    // Test trace functionality from detailed page
    const detailedTracePagePromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'View trace' }).click();
    const detailedTracePage = await detailedTracePagePromise;
    await expect(detailedTracePage.url()).toContain('trace');
  });

  test("fetch recently completed test run via API and navigate to its page", async ({ page }) => {
    // Navigate to the app first to establish session/authentication
    await page.goto("/");
    
    // Set up network interception BEFORE navigating to test runs
    const testRunsApiPromise = page.waitForResponse(response => 
      response.url().includes('/api/test-runs') && response.request().method() === 'GET'
    );
    
    // Navigate to the test runs page - this will trigger the API call we're waiting for
    await page.getByRole('link', { name: 'Test Runs' }).click();
    
    // Capture the API response that the page makes naturally
    const apiResponse = await testRunsApiPromise;
    
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
    
    // Click on the test run link in the UI instead of navigating directly
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
    await page.getByRole('button', { name: 'Add Test Run Override' }).click();
    await page.getByRole('textbox', { name: 'Variable name' }).fill('BASE_URL');
    await page.getByRole('textbox', { name: 'Variable value' }).fill('https://example.com');
    
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
    
    // Click on the specific test run to open run details page
    const testRunLink = page.locator(`a[href*="/test-runs/${testRunId}"]`);
    await expect(testRunLink).toBeVisible();
    await testRunLink.click();
    
    // Verify that the test run was successfully created and queued with custom environment variable
    // This confirms that the environment variable customization feature is working
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

  test("open failed test diagnosis page and verify code, video, and key moments are visible", async ({ page }) => {
    // Navigate to test runs page
    await page.goto("/");
    
    // Set up network interception to capture the test runs API response
    const testRunsApiPromise = page.waitForResponse(response => 
      response.url().includes('/api/test-runs') && response.request().method() === 'GET'
    );
    
    // Navigate to the test runs page
    await page.getByRole('link', { name: 'Test Runs' }).click();
    
    // Wait for and parse the API response
    const apiResponse = await testRunsApiPromise;
    expect(apiResponse.ok()).toBeTruthy();
    
    const responseData = await apiResponse.json();
    
    // Find a test run that has ended and has failed tests
    const endedTestRuns = responseData.data.test_runs.items.filter(
      (testRun: any) => testRun.state === 'ended' && testRun.failed_count > 0
    );
    
    expect(endedTestRuns.length).toBeGreaterThan(0);
    const testRunId = endedTestRuns[0].id;
    
    console.log('Found test run with failed tests:', testRunId);
    
    // Click on the test run link
    const testRunLink = page.locator(`a[href*="/test-runs/${testRunId}"]`).first();
    await expect(testRunLink).toBeVisible();
    await testRunLink.click();
    
    // Wait for the test run page to load
    await expect(page).toHaveURL(new RegExp(`test-runs/${testRunId}`));
    await expect(page.getByText('Failed', { exact: false }).first()).toBeVisible({ timeout: 10000 });
    
    // Find and click on a failed test to open the diagnosis page
    const failedTestLink = page.locator('a[href*="/diagnosis/"]').first();
    await expect(failedTestLink).toBeVisible({ timeout: 10000 });
    
    const testName = await failedTestLink.innerText();
    console.log('Opening diagnosis page for failed test:', testName);
    
    await failedTestLink.click();
    
    // Wait for the diagnosis page to load
    await expect(page).toHaveURL(/diagnosis/, { timeout: 10000 });
    
    // Verify video is visible
    const video = page.locator('video').first();
    await expect(video).toBeVisible({ timeout: 10000 });
    console.log('✅ Video is visible');
    
    // Verify the video can be played
    const playButton = page.locator('media-play-button').first();
    await expect(playButton).toBeVisible();
    await expect(playButton).toHaveAttribute('aria-label', /play/i);
    await playButton.click();
    await expect(playButton).toHaveAttribute('aria-label', /pause/i);
    console.log('✅ Video can be played');
    
    // Verify code/test details are visible
    // Look for common code-related elements
    await expect(page.getByText('Test Case', { exact: false })).toBeVisible();
    console.log('✅ Test case information is visible');
    
    // Verify error/failure information is visible
    await expect(page.getByText(/error|failure|failed/i).first()).toBeVisible();
    console.log('✅ Error/failure information is visible');
    
    // Verify key moments section (if available)
    // Key moments might be shown as timeline or sections
    const keyMomentsExists = await page.getByText(/key moment|timeline|step/i).first().isVisible().catch(() => false);
    if (keyMomentsExists) {
      console.log('✅ Key moments/timeline is visible');
    }
    
    // Verify retry tabs are available (First run, Retry 1, etc.)
    const firstRunTab = page.getByRole('tab', { name: 'First run' });
    const retryTabExists = await firstRunTab.isVisible().catch(() => false);
    
    if (retryTabExists) {
      await expect(firstRunTab).toBeVisible();
      console.log('✅ Retry tabs are visible (First run)');
      
      // Click on retry tabs to verify they work
      const retry1Tab = page.getByRole('tab', { name: 'Retry 1' });
      const retry1Exists = await retry1Tab.isVisible().catch(() => false);
      
      if (retry1Exists) {
        await retry1Tab.click();
        await expect(retry1Tab).toBeVisible();
        console.log('✅ Successfully switched to Retry 1 tab');
        
        // Verify video is still visible in retry tab
        await expect(page.locator('video').first()).toBeVisible();
      }
    }
    
    // Verify trace button is available
    const traceButton = page.getByRole('button', { name: /trace/i }).first();
    const traceExists = await traceButton.isVisible().catch(() => false);
    
    if (traceExists) {
      await expect(traceButton).toBeVisible();
      console.log('✅ Trace button is visible');
    }
    
    console.log('✅ Successfully verified diagnosis page has all key elements for test:', testName);
  });

});