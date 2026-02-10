import { test, expect } from "../fixtures";
import { getRecentCompletedTestRun, getRecentFailedTestRun, getRecentFailedTestRunForEnvironment, goToTestRun, getFailedTestLink } from "../pages/test-runs";

test.describe('Tool Execution Tests', () => {
  test('create new session, send "list all files" message and verify tool execution', async ({ page, trackCurrentSession }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
    
    // Create a new session
    await page.locator('button:has(svg.lucide-plus)').click();
    await page.getByPlaceholder('Enter an initial prompt').fill('list all files in the root dir of the repo. no need to do anything else');
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    

    
    // Wait for the successful tool execution that views "/repo directory"
    await expect(page.getByText('Viewed /repo directory')).toBeVisible({ timeout: 60000 });
    
    // Click on "Viewed /repo directory" to open the function details
    await page.getByText('Viewed /repo directory').click();
    
    // Wait a moment for the panel to open and render
    await page.waitForTimeout(500);
    
    // Expand the "Tool Input" section
    await page.getByRole('button', { name: 'Tool Input' }).click();
    
    // Assert that the function details panel shows the tool call details for either legacy or new label
    await expect(page.getByText(/(Tool Call\s*:\s*fileViewTool|\"command\": \"view\")/)).toBeVisible({ timeout: 10000 });
    
    // Expand the "Tool Output" section
    await page.getByRole('button', { name: 'Tool Output' }).click();
    
    // Function details should auto-update to show the tool result when execution completes
    // Assert that the tool result is visible in the function details panel
    await expect(
      page
        .getByRole('tabpanel')
        .getByText('package.json', { exact: false })
        .first()
    ).toBeVisible({ timeout: 10000 });
    
    // Session will be automatically closed by afterEach hook
  });



  test('Verify browser agent works', async ({ page }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
    
    // Create a new session
    await page.locator('button:has(svg.lucide-plus)').click();
    await page.getByPlaceholder('Enter an initial prompt').fill('1. Create a new test in tests/temp.spec.ts with the test name "should click button on page" with a page.goto to https://v0-button-to-open-v0-home-page-h5dizpkwp.vercel.app/ 2. Ask the browser agent to "click on the button and do nothing else" (use project "chromium")');
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Wait for "Running generateTestWithBrowserAgent" text - this can take up to 2 mins
    await expect(page.getByText("Running generateTestWithBrowserAgent")).toBeVisible({ timeout: 120000 });
    
    // Wait for "Used generateTestWithBrowserAgent" - this can take up to 5 mins
    await expect(page.getByText("Used generateTestWithBrowserAgent")).toBeVisible({ timeout: 300000 });
    
    // Click on "Used generateTestWithBrowserAgent" text
    await page.getByText("Used generateTestWithBrowserAgent").click();
    
    // Function details should be visible, and we should be able to assert for "popup" text
    await expect(page.getByText("'popup'")).toBeVisible({ timeout: 10000 });
    
    // Close the session - "Close Session" is now in a dropdown menu next to "Review"
    // Click on the dropdown button to open it
    await page.getByRole('button').filter({ hasText: 'Review' }).locator('..').locator('.lucide-chevron-down').click();
    
    // Click on "Close Session" option in the dropdown
    await page.getByRole('menuitem', { name: 'Close Session' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
  });

  test('run example.spec.ts and verify Test Execution results with video and attachments', async ({ page, trackCurrentSession }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
    
    // Create a new session
    await page.locator('button:has(svg.lucide-plus)').click();
    await page.getByPlaceholder('Enter an initial prompt').fill('view the test in example.spec.ts and run it on chromium project');
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // The initial prompt "Please run the example.spec.ts test file" will trigger the tool execution
    
    // First, wait for the file examination tool to complete
    await expect(page.getByText(/Viewed .+/)).toBeVisible({ timeout: 60000 });
    
    // Then, wait for runTest tool execution to start
    await expect(page.getByText("Running runTest")).toBeVisible({ timeout: 60000 });
    
    // Click on "Running runTest" to open the function details
    await page.getByText("Running runTest").click();
    
    // Wait a moment for the panel to open and render
    await page.waitForTimeout(500);
    
    // Expand the "Tool Input" section
    await page.getByRole('button', { name: 'Tool Input' }).click();
    
    // Assert that the function details panel shows the runTest parameters
    await expect(page.getByText('"testName":')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('"filePath": "/repo/tests/example.spec.ts"')).toBeVisible({ timeout: 10000 });
    
    // Wait for runTest execution to complete - runTest can take several minutes
    await expect(page.getByText("Used runTest")).toBeVisible({ timeout: 300000 });
    
    // Navigate to Tools tab to verify Test Execution results are visible there
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    
    // Assert that Test Execution Results section is visible in Tools tab
    await expect(page.getByText("Test Execution Results")).toBeVisible({ timeout: 10000 });
    
    // Assert that test details are shown - use more specific locator for heading
    await expect(page.getByRole('heading', { name: 'has title' })).toBeVisible({ timeout: 10000 });
    
    // Assert that video section is available
    await expect(page.getByText("Videos")).toBeVisible({ timeout: 10000 });
    
    // Assert that video player with controls is present
    const videoElement = page.locator('video').first();
    await expect(videoElement).toBeVisible({ timeout: 10000 });
    
    // Assert that user can interact with the video player controls
    const playPauseButton = page.locator('media-play-button').first();
    await expect(playPauseButton).toBeVisible({ timeout: 10000 });
    await expect(playPauseButton).toHaveAttribute('aria-label', /play/i);
    await playPauseButton.click();
    await expect(playPauseButton).toHaveAttribute('aria-label', /pause/i);
    
    // Verify that the video has a valid source URL
    await expect(videoElement).toHaveAttribute('src', /https?:\/\/.*\.webm/);
    
    // Test completed successfully - user can play video and attachments are present
    // (Attachments are implicitly verified by the presence of the video element and Tools tab results)
    
    // Session will be automatically closed by afterEach hook
  });

  test('modify example.spec.ts file and verify tool execution and diff visibility', async ({ page, trackCurrentSession }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
    
    // Create a new session with initial prompt that will change the test name
    await page.locator('button:has(svg.lucide-plus)').click();
    const modifyMessage = 'Change the test name in example.spec.ts from "has title" to "playwright page has title"';
    await page.getByPlaceholder('Enter an initial prompt').fill(modifyMessage);
    
    // Set up listener for the first diff API call BEFORE clicking create
    const firstDiffCallPromise = page.waitForResponse(
      response => response.url().includes('/api/chat-sessions/') && 
                  response.url().includes('/diff') && 
                  response.request().method() === 'GET',
      { timeout: 15000 }
    );
    
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Extract session ID from the URL for network call assertions
    const sessionUrl = page.url();
    const sessionId = sessionUrl.split('/sessions/')[1]?.split('?')[0];
    expect(sessionId).toBeTruthy();
    console.log('Session ID:', sessionId);
    
    // Wait for and verify the first diff API call was made when the session page opened
    const firstDiffCall = await firstDiffCallPromise;
    expect(firstDiffCall.status()).toBe(200);
    expect(firstDiffCall.url()).toContain(`/api/chat-sessions/${sessionId}/diff`);
    console.log('✅ First diff API call made when session page opened:', firstDiffCall.url(), 'Status:', firstDiffCall.status());
    
    // First assertion: "Used" for view tool - should view example.spec.ts
    await expect(page.getByText(/Viewed.*example\.spec\.ts/)).toBeVisible({ timeout: 60000 });
    
    // Then assertion: "Running" for str_replace tool - should be editing example.spec.ts
    await expect(page.getByText(/Editing.*example\.spec\.ts/)).toBeVisible({ timeout: 60000 });
    
    // Finally assertion: "Used" for str_replace tool - should have edited example.spec.ts
    await expect(page.getByText(/Edited.*example\.spec\.ts/)).toBeVisible({ timeout: 60000 });
    
    // Set up listener for the second diff API call AFTER the str_replace tool finishes
    const secondDiffCallPromise = page.waitForResponse(
      response => response.url().includes(`/api/chat-sessions/${sessionId}/diff`) && 
                  response.request().method() === 'GET',
      { timeout: 15000 }
    );
    
    // Wait for and verify the second diff API call was made after the tool execution
    const secondDiffCall = await secondDiffCallPromise;
    expect(secondDiffCall.status()).toBe(200);
    expect(secondDiffCall.url()).toContain(`/api/chat-sessions/${sessionId}/diff`);
    console.log('✅ Second diff API call made after str_replace tool execution:', secondDiffCall.url(), 'Status:', secondDiffCall.status());
    
    // Click on the Tools tab to verify the code change diff is visible
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    
    // Click on the "Edited <filename>" to open the diff details (new UI)
    await page.getByText(/Edited .+/).click();
    
    // Assert that the code change diff is visible in tools tab
    // Look for the Code Changes section or diff file indicators
    await expect(page.getByText("Code Changes").first()).toBeVisible({ timeout: 10000 });
    
    // Assert that actual diff content is visible (not just loading state)
    // Wait for diff content to load and show the new test name from the modification
    // Look for the new test name within the Tools tab area (using first() to handle multiple matches)
    await expect(page.getByRole('tabpanel').filter({ has: page.getByText('Code Changes') }).getByText('playwright page has title').first()).toBeVisible({ timeout: 15000 });
    
    // Session will be automatically closed by afterEach hook
  });

  test('create session, search files with grep tool and verify tool response in Tools tab', async ({ page, trackCurrentSession }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
    
    // Create a new session with grep search prompt
    await page.locator('button:has(svg.lucide-plus)').click();
    const searchMessage = "find all files containing 'title' keyword";
    await page.getByPlaceholder('Enter an initial prompt').fill(searchMessage);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Wait for grep tool execution to complete - new UI shows result text instead of "Used grep"
    await expect(page.getByText(/Found \d+ results? for "title"/)).toBeVisible({ timeout: 60000 });
    
    // Navigate to Tools tab to verify tool response
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    
    // Click on the grep result bubble to open the tool call response
    await page.getByText(/Found \d+ results? for "title"/).click();
    
    // Wait a moment for the panel to open and render
    await page.waitForTimeout(500);
    
    // Expand the "Tool Output" section
    await page.getByRole('button', { name: 'Tool Output' }).click();
    
    // Assert that the tool call response is visible in the tools tab
    // Look for the specific grep response format: "Found X results for "title" in "directory""
    await expect(page.getByText(/Found .* results for "title"/)).toBeVisible({ timeout: 10000 });
    
    // Session will be automatically closed by afterEach hook
  });

  test('run example.spec.ts and verify fetchFile tool execution with screenshot visibility', async ({ page, trackCurrentSession }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
    
    // Create a new session with fetchFile prompt
    await page.locator('button:has(svg.lucide-plus)').click();
    const toolMessage = "Please run the example.spec.ts test file and give me the screenshot";
    await page.getByPlaceholder('Enter an initial prompt').fill(toolMessage);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // First, wait for the file examination tool (view) to complete
    await expect(page.getByText(/Viewed .+/).first()).toBeVisible({ timeout: 60000 });
    
    // Now wait for the runTest tool execution to complete
    await expect(page.getByText("Used runTest")).toBeVisible({ timeout: 300000 });
    


    
    // Assert that fetchFile tool execution completes successfully
    await expect(page.getByText("Used fetchFile")).toBeVisible({ timeout: 60000 });
    
    // Navigate to Tools tab to verify screenshot visibility
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    
    // Click on "Used fetchFile tool" text to open the tool details
    await page.getByText("Used fetchFile").click();
    
    // Assert that the screenshot image is visible in the tools tab
    // Look for an img element within the Response section that contains the screenshot
    const responseSection = page.locator('text=Response').locator('..');
    const screenshotImage = responseSection.locator('img').first();
    await expect(screenshotImage).toBeVisible({ timeout: 15000 });
    
    // Verify that the image has a valid src attribute (should be a base64 data URL or valid URL)
    await expect(screenshotImage).toHaveAttribute('src', /^(data:image\/|https?:\/\/)/);
    
    // Session will be automatically closed by afterEach hook
  });

  test('create test file and delete using deleteFile tool with verification in tools tab', async ({ page, trackCurrentSession }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
    
    // Create a new session with create/delete file prompt
    await page.locator('button:has(svg.lucide-plus)').click();
    const toolMessage = "Create a new test file in the tests/ directory (e.g., tests/demo.spec.ts) with just a single comment 'this is test file' Then delete it. Do these steps in 2 tool calls, not in parallel";
    await page.getByPlaceholder('Enter an initial prompt').fill(toolMessage);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // First, wait for the create tool to start running - should create a .spec.ts file in tests/
    await expect(page.getByText(/Creating.*tests\/.*\.spec\.ts/)).toBeVisible({ timeout: 60000 });
    
    // Then wait for the file creation tool to complete
    await expect(page.getByText(/Created.*tests\/.*\.spec\.ts/)).toBeVisible({ timeout: 60000 });
    
    // Navigate to Tools tab to verify file creation
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    
    // Click on "Created <filename>" to view creation details (new UI)
    await page.getByText(/Created .+/).click();
    
    // Assert that the file was created with the expected comment
    // Look for the comment within the tool response section (not in the original prompt)  
    await expect(page.getByText("// this is test file").first()).toBeVisible({ timeout: 10000 });
    
    // Wait for deleteFile tool execution to start (should happen automatically)
    await expect(page.getByText("Running deleteFile")).toBeVisible({ timeout: 60000 });
    
    // Assert that deleteFile tool execution completes successfully
    await expect(page.getByText("Used deleteFile")).toBeVisible({ timeout: 60000 });
    
    // Click on "Used deleteFile" text to open the tool details
    await page.getByText("Used deleteFile").click();
    
    // Assert that the code change diff is visible instead of relying on toast message
    const deleteToolDetails = page
      .getByRole('tabpanel')
      .filter({ has: page.getByText('Code Changes') });
    await expect(deleteToolDetails).toBeVisible({ timeout: 10000 });
    await expect(deleteToolDetails.getByText('tests/demo.spec.ts').first()).toBeVisible({ timeout: 15000 });
    await expect(deleteToolDetails.getByText('// this is test file').first()).toBeVisible({ timeout: 15000 });
    
    // Session will be automatically closed by afterEach hook
  });

  test('fetch test run report and verify fetchTestRunDetails tool execution with response in tools tab', async ({ page, trackCurrentSession }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Use helper to get a recent completed test run
    const { testRunId } = await getRecentCompletedTestRun(page);
    
    // Navigate to the test run
    await goToTestRun(page, testRunId);
    
    // Verify we're on the specific test run page
    await expect(page).toHaveURL(new RegExp(`test-runs/${testRunId}`));
    
    // Wait for the page to load
    await expect(page.getByText('Failed', { exact: false }).first()).toBeVisible({ timeout: 10000 });
    
    // Collect the current page URL - this is the test run details URL we'll use
    const testRunUrl = page.url();
    console.log('Test run details URL:', testRunUrl);
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
    
    // Create a new session with fetchTestRunDetails prompt
    await page.locator('button:has(svg.lucide-plus)').first().click();
    const toolMessage = `fetch the testRundetails for this ${testRunUrl}`;
    await page.getByPlaceholder('Enter an initial prompt').fill(toolMessage);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Assert that fetchTestRunDetails tool execution completes successfully
    await expect(page.getByText("Used fetchTestRunDetails")).toBeVisible({ timeout: 60000 });
    
    await page.waitForTimeout(1000);
    
    // Navigate to Tools tab to verify tool response is visible
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    
    // Click on "Used fetchTestRunDetails" text to open the tool call response
    await page.getByText("Used fetchTestRunDetails").click();
    
    // Wait a moment for the panel to open and render
    await page.waitForTimeout(500);
    
    // Expand the "Tool Output" section
    await page.getByRole('button', { name: 'Tool Output' }).click();
    
    // Assert that the tool call response is visible in the tools tab
    // Look for specific test run details that should be in the fetchTestRunDetails response
    await expect(page.getByRole('tabpanel').getByText(`Test run #${testRunId}`)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('tabpanel').getByText("## Info")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('tabpanel').getByText(`Run ID: ${testRunId}`)).toBeVisible({ timeout: 10000 });
    
    // Session will be automatically closed by afterEach hook
  });

  test('list environments and verify listEnvironments tool execution', async ({ page, trackCurrentSession }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
    
    // Create a new session with listEnvironments prompt
    await page.locator('button:has(svg.lucide-plus)').click();
    const toolMessage = "list the environments you have";
    await page.getByPlaceholder('Enter an initial prompt').fill(toolMessage);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    

    
    // Wait for tool execution to complete and assert "Used" text appears
    await expect(page.getByText("Used listEnvironments")).toBeVisible({ timeout: 60000 });
    
    // Navigate to Tools tab to verify tool response
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    
    // Click on "Used listEnvironments" to open the tool details
    await page.getByText("Used listEnvironments").click();
    
    // Wait a moment for the panel to open and render
    await page.waitForTimeout(500);
    
    // Wait before clicking Tool Output to ensure it's ready
    await page.waitForTimeout(500);
    
    // Expand the "Tool Output" section
    await page.getByRole('button', { name: 'Tool Output' }).click();
    
    // Assert that the environments data is visible in the tools tab
    // Look for the environments array in the JSON response
    await expect(page.getByText('"environments"')).toBeVisible({ timeout: 10000 });
    
    // Assert that environment details are present (like id, slug, name fields)
    await expect(page.getByText('"id":')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('"slug":')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('"name":')).toBeVisible({ timeout: 10000 });
    
    // Session will be automatically closed by afterEach hook
  });

  test('go to recently completed test run, click failed test, then fetch diagnosis report in new session', async ({ page, trackCurrentSession }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto("/");
    
    // Use helper to get a recent failed test run from staging for reliability
    const { testRunId } = await getRecentFailedTestRunForEnvironment(page, 'staging');
    
    // Navigate to the test run
    await goToTestRun(page, testRunId);
    
    // Verify we're on the specific test run page
    await expect(page).toHaveURL(new RegExp(`test-runs/${testRunId}`));
    
    // Get a failed test link
    const failedTestLink = await getFailedTestLink(page);
    await expect(failedTestLink).toBeVisible({ timeout: 10000 });
    
    // Get the test name before clicking (for verification)
    const testName = await failedTestLink.innerText();
    
    await failedTestLink.click();
    
    // Wait for the detail parameter to appear in the URL (new behavior)
    await expect(page).toHaveURL(/detail=/, { timeout: 10000 });
    
    // Get the current URL with the detail parameter
    const diagnosisUrl = page.url();
    
    // Click on retry tabs and videos before creating new session
    // Tab 1: First run (should be selected by default)
    await page.getByRole('tab', { name: 'First run' }).click();
    await expect(page.getByRole('tab', { name: 'First run' })).toBeVisible({ timeout: 10000 });
    
    // Click on the video in first run tab
    const firstRunVideo = page.locator('video').first();
    await expect(firstRunVideo).toBeVisible({ timeout: 10000 });
    await firstRunVideo.click();
    
    // Tab 2: Retry 1
    await page.getByRole('tab', { name: 'Retry 1' }).click();
    await expect(page.getByRole('tab', { name: 'Retry 1' })).toBeVisible({ timeout: 10000 });
    
    // Click on the video in retry 1 tab
    const retry1Video = page.locator('video').first();
    await expect(retry1Video).toBeVisible({ timeout: 10000 });
    await retry1Video.click();
    
    // Tab 3: Retry 2
    await page.getByRole('tab', { name: 'Retry 2' }).click();
    await expect(page.getByRole('tab', { name: 'Retry 2' })).toBeVisible({ timeout: 10000 });
    
    // Click on the video in retry 2 tab
    const retry2Video = page.locator('video').first();
    await expect(retry2Video).toBeVisible({ timeout: 10000 });
    await retry2Video.click();
    
    // Step 1: Get the detail parameter URL (already have it as diagnosisUrl)
    // Verify we're still on the report page with detail parameter
    await expect(page).toHaveURL(/detail=/, { timeout: 10000 });
    
    // Step 2: Click on the "New Session" button from the report page
    await page.getByRole('button', { name: 'New Session' }).click();
    
    // Fill in the prompt in the modal/dialog
    const toolMessage = `I need you to call the fetchDiagnosisDetails tool with this URL: ${diagnosisUrl}. Please use only the fetchDiagnosisDetails tool to get the diagnosis data.`;
    await page.getByPlaceholder('Enter an initial prompt').fill(toolMessage);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Step 3: Verify we're in a session with a specific session ID in the URL
    await expect(page).toHaveURL(/\/sessions\/[^/?]+/, { timeout: 10000 });
    
    // Extract session ID from URL for later verification
    const sessionUrl = page.url();
    const sessionIdMatch = sessionUrl.match(/\/sessions\/([^/?]+)/);
    const sessionId = sessionIdMatch?.[1];
    
    // Log for debugging
    console.log('Session URL:', sessionUrl);
    console.log('Extracted session ID:', sessionId);
    
    expect(sessionId).toBeTruthy();
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Wait specifically for fetchDiagnosisDetails tool to be used
    await expect(page.getByText("Used fetchDiagnosisDetails")).toBeVisible({ timeout: 60000 });
    
    // Switch to Tools tab to verify tool response is available
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    
    // Click specifically on the "Used fetchDiagnosisDetails" tool to expand the response
    await page.getByText("Used fetchDiagnosisDetails").click();
    
    // Wait a moment for the panel to open and render
    await page.waitForTimeout(500);
    
    // Expand the "Tool Output" section
    await page.getByRole('button', { name: 'Tool Output' }).click();
    
    // Assert the general diagnosis content that should be visible in the tool response
    await expect(page.getByText("Test Case Information")).toBeVisible({ timeout: 10000 });
    // Instead of checking for a specific hardcoded test name, check for the pattern that any test case name should follow
    // The format now uses markdown with "**Name**:" instead of "Test Case Name:"
    await expect(page.getByText(/\*\*Name\*\*: .+/)).toBeVisible({ timeout: 10000 });
    // Check that file path is present (could be any .spec.ts file)
    // The format now uses markdown with "**File path**:" instead of "File Path:"
    await expect(page.getByText(/\*\*File path\*\*: tests\/.+\.spec\.ts/)).toBeVisible({ timeout: 10000 });
    
    // Step 4: Go back to test runs page (without detail param) and verify session is listed
    // Navigate back to the test run page without detail parameter
    await page.goto(`/lorem-ipsum-tests/test-runs/${testRunId}`);
    
    // Wait for the test run page to load (URL should not have detail param, but can have other query params)
    await expect(page).toHaveURL(new RegExp(`test-runs/${testRunId}(?:\\?(?!.*detail=).*)?$`));
    await expect(page.getByText('Failed', { exact: false }).first()).toBeVisible({ timeout: 10000 });
    
    // Click on the "Sessions" button to view all sessions created from this report page
    await page.getByRole('button', { name: 'Sessions' }).click();
    
    // Wait for the sessions modal to load by checking for the modal dialog
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('All sessions for this test run')).toBeVisible({ timeout: 10000 });
    
    // Wait a bit for the session to be associated with the test run
    await page.waitForTimeout(2000);
    
    // Assert that the session ID we created is visible somewhere in the sessions dialog
    // It could be in User Sessions, Triage Sessions, or as part of a session title
    const sessionsDialog = page.getByRole('dialog');
    await expect(sessionsDialog.getByText(sessionId, { exact: false })).toBeVisible({ timeout: 15000 });
  });

  test('insert comment in example.spec.ts and verify insert tool execution and diff visibility', async ({ page, trackCurrentSession }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
    
    // Create a new session with insert comment prompt
    await page.locator('button:has(svg.lucide-plus)').click();
    const insertMessage = "insert a comment '4th line comment' in example.spec.ts file on line no. 3";
    await page.getByPlaceholder('Enter an initial prompt').fill(insertMessage);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Wait for the file examination tool (view) to complete - should view example.spec.ts
    await expect(page.getByText(/Viewed.*example\.spec\.ts/)).toBeVisible({ timeout: 60000 });
    
    // Then, wait for insert tool execution to start - should be inserting into example.spec.ts
    await expect(page.getByText(/Inserting into.*example\.spec\.ts/)).toBeVisible({ timeout: 60000 });
    
    // Assert that insert tool is successfully executed - should have inserted into example.spec.ts
    await expect(page.getByText(/Inserted into.*example\.spec\.ts/)).toBeVisible({ timeout: 60000 });
    
    // Navigate to Tools tab to verify the code change diff is visible
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    
    // Click on the "Inserted into <filename>" text to open the diff details (new UI)
    await page.getByText(/Inserted into .+/).click();
    
    // Assert that the code change diff is visible in tools tab
    // Look for the Code Changes section or diff file indicators
    await expect(page.getByText("Code Changes").first()).toBeVisible({ timeout: 10000 });
    
    // Assert that actual diff content is visible showing the inserted comment
    // Look for the inserted comment text within the Tools tab area
    await expect(page.getByRole('tabpanel').filter({ has: page.getByText('Code Changes') }).getByText('4th line comment').first()).toBeVisible({ timeout: 15000 });
    
    // Session will be automatically closed by afterEach hook
  });

  test('parallel file view tool calls', async ({ page, trackCurrentSession }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
    
    // Create a new session with parallel file view prompt
    await page.locator('button:has(svg.lucide-plus)').click();
    const parallelViewMessage = "whats inside example.spec.ts and search.spec.ts? view them in parallel";
    await page.getByPlaceholder('Enter an initial prompt').fill(parallelViewMessage);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Assert 1: "Viewed" - first occurrence
    await expect(page.getByText(/Viewed .+/).first()).toBeVisible({ timeout: 60000 });
    
    // Assert 2: "Viewed" - second occurrence (nth(1))
    await expect(page.getByText(/Viewed .+/).nth(1)).toBeVisible({ timeout: 60000 });
    
    // Navigate to Tools tab to verify both tool executions are visible
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    
    // Click on the first "Viewed" to open the tool details
    await page.getByText(/Viewed .+/).first().click();
    
    // Wait a moment for the panel to open and render
    await page.waitForTimeout(500);
    
    // Wait before clicking Tool Output to ensure it's ready
    await page.waitForTimeout(500);
    
    // Session will be automatically closed by afterEach hook
  });

  test('list projects and tests tools', async ({ page, trackCurrentSession }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
    
    // Create a new session with list projects and tests prompt
    await page.locator('button:has(svg.lucide-plus)').click();
    const listMessage = "use list projects tool and then list tests for all projects";
    await page.getByPlaceholder('Enter an initial prompt').fill(listMessage);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Wait for listProjects to start running
    await expect(page.getByText("Running listProjects")).toBeVisible({ timeout: 60000 });
    
    // Wait for listProjects to be used
    await expect(page.getByText("Used listProjects")).toBeVisible({ timeout: 60000 });
    
    // Wait for first listTestsForProject to start running
    await expect(page.getByText("Running listTestsForProject").first()).toBeVisible({ timeout: 60000 });
    
    // Wait for second listTestsForProject to start running
    await expect(page.getByText("Running listTestsForProject").nth(1)).toBeVisible({ timeout: 60000 });
    
    // Wait for first listTestsForProject to be used (increased timeout as these can take longer)
    await expect(page.getByText("Used listTestsForProject").first()).toBeVisible({ timeout: 120000 });
    
    // Wait for second listTestsForProject to be used
    await expect(page.getByText("Used listTestsForProject").nth(1)).toBeVisible({ timeout: 120000 });
    
    // Navigate to Tools tab to verify tool responses
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    
    // Click on "Used listProjects" to open the tool details
    await page.getByText("Used listProjects").click();
    
    // Wait a moment for the panel to open and render
    await page.waitForTimeout(500);
    
    // Wait before clicking Tool Output to ensure it's ready
    await page.waitForTimeout(500);
    
    // Expand the "Tool Output" section if it's collapsed
    await page.getByRole('button', { name: 'Tool Output' }).click();
    
    // Assert that the projects data is visible in the tools tab
    // Look for project names in the JSON response (use .first() as they appear multiple times)
    await expect(page.getByRole('tabpanel').getByText('"name":', { exact: false }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('tabpanel').getByText("chromium").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('tabpanel').getByText("setup").first()).toBeVisible({ timeout: 10000 });
    
    // Click on first "Used listTestsForProject" to open the tool details
    await page.getByText("Used listTestsForProject").first().click();
    
    // Wait a moment for the panel to open and render
    await page.waitForTimeout(500);
    
    // Wait before clicking Tool Output to ensure it's ready
    await page.waitForTimeout(500);
    
    // Verify the tools executed successfully and the assistant presented the results in conversation
    // Check that the test name summary is visible in the conversation area
    await expect(page.getByText("click login button and input dummy email")).toBeVisible();
    
    // Session will be automatically closed by afterEach hook
  });

  test('go to failed test run, extract trace.zip URL, and use trace utils to find failing step', async ({ page, trackCurrentSession }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto("/");
    
    // Use helper to get a recent failed test run from staging for reliability
    const { testRunId } = await getRecentFailedTestRunForEnvironment(page, 'staging');
    
    // Navigate to the test run
    await goToTestRun(page, testRunId);
    
    // Verify we're on the specific test run page
    await expect(page).toHaveURL(new RegExp(`test-runs/${testRunId}`));
    
    // Get a failed test link
    const failedTestLink = await getFailedTestLink(page);
    await expect(failedTestLink).toBeVisible({ timeout: 10000 });
    
    await failedTestLink.click();
    
    // Wait for the detail parameter to appear in the URL
    await expect(page).toHaveURL(/detail=/, { timeout: 10000 });
    
    // Wait for the page to load and show test details - use .first() to avoid strict mode violation
    await expect(page.getByText('First run').first()).toBeVisible({ timeout: 10000 });
    
    // Look for trace.zip link in attachments - it should be visible on the page
    // The trace.zip link typically appears as "View Trace" or in attachments section
    const traceLink = page.getByRole('link', { name: /View Trace/i }).first();
    await expect(traceLink).toBeVisible({ timeout: 10000 });
    
    // Get the trace.zip URL from the href attribute
    const traceUrl = await traceLink.getAttribute('href');
    console.log('Trace URL:', traceUrl);
    
    expect(traceUrl).toBeTruthy();
    expect(traceUrl).toContain('trace');
    
    // Create a new session from the report page
    await page.getByRole('button', { name: 'New Session' }).click();
    
    // Fill in the prompt asking to use trace utils to list steps and find the failing step
    const toolMessage = `I need you to analyze the trace file at this URL: ${traceUrl}. Please use trace utils (via safeBash) to list all the steps in the trace, identify the failing step, and tell me which step failed.`;
    await page.getByPlaceholder('Enter an initial prompt').fill(toolMessage);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session
    await expect(page).toHaveURL(/\/sessions\/[^/?]+/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Wait for safeBash tool to be used (trace utils runs via safeBash)
    await expect(page.getByText("Used safeBash")).toBeVisible({ timeout: 120000 });
    
    // Switch to Tools tab to verify tool response
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    
    // Click on "Used safeBash" to expand the tool response
    await page.getByText("Used safeBash").click();
    
    // Expand the "Tool Output" section
    await page.getByRole('button', { name: 'Tool Output' }).click();
    
    // The tool output should be visible and contain trace analysis data
    const toolResponse = page.getByRole('tabpanel');
    
    // The response should contain step information from trace-utils steps command
    // Look for patterns that indicate trace steps were listed (step IDs, timestamps, or step names)
    await expect(
      toolResponse.getByText(/step|FAILED|expect|locator|click/i).first()
    ).toBeVisible({ timeout: 10000 });
    
    // Session will be automatically closed by afterEach hook
  });

  test('safeBash tool execution to get commit SHA', async ({ page, trackCurrentSession }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions page
    await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();
    
    // Wait for sessions page to load
    await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Create a new session with advanced settings
    await page.locator('button:has(svg.lucide-plus)').click();
    
    // Open advanced settings
    await page.getByRole('button', { name: 'Advanced' }).click();
    
    // Set the base branch to 'example-base-branch'
    await page.getByLabel('Base Branch').fill('example-base-branch');
    
    // Enter the user message to get commit SHA
    const message = "what's the commit sha/ref for the last commit";
    await page.getByPlaceholder('Enter an initial prompt').fill(message);
    
    // Create the session
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Assert safeBash tool is running
    await expect(page.getByText(/Running safeBash/)).toBeVisible({ timeout: 60000 });
    
    // Assert safeBash tool was used
    await expect(page.getByText(/Used safeBash/)).toBeVisible({ timeout: 60000 });
    
    // Assert the specific commit SHA is visible in the data-message-id bubble
    await expect(page.locator('[data-message-id]').filter({ hasText: 'b028df844e4ffb38d1cfeba6cdb4432de556cffc' })).toBeVisible({ timeout: 60000 });
  });
});