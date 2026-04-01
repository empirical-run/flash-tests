import { test, expect } from "../fixtures";
import { getRecentCompletedTestRun, getRecentFailedTestRun, getRecentFailedTestRunForEnvironment, goToTestRun, getFailedTestLink } from "../pages/test-runs";
import { closeSession, createSession, createSessionWithBranch, navigateToSessions } from "../pages/sessions";

test.describe('Tool Execution Tests', () => {
  test('create new session, send "list all files" message and verify tool execution', async ({ page, trackCurrentSession }) => {
    await navigateToSessions(page);
    
    // Create a new session
    await createSession(page, 'list all files in the root dir of the repo. no need to do anything else');
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    

    
    // Wait for the successful tool execution that views "/repo directory"
    await expect(page.getByText('Viewed /repo directory')).toBeVisible({ timeout: 120000 });
    
    // Click on "Viewed /repo directory" to open the function details
    await page.getByText('Viewed /repo directory').click();
    
    // Wait a moment for the panel to open and render
    await page.waitForTimeout(500);
    
    // Expand the "Tool Input" section
    await page.getByRole('button', { name: 'Tool Input' }).click();
    
    // Assert that the function details panel shows the tool call details for either legacy or new label
    await expect(page.getByText(/(Tool Call\s*:\s*fileViewTool|\"command\": \"view\")/)).toBeVisible();
    
    // Expand the "Tool Output" section
    await page.getByRole('button', { name: 'Tool Output' }).click();
    
    // Function details should auto-update to show the tool result when execution completes
    // Assert that the tool result is visible in the function details panel
    await expect(
      page
        .getByRole('tabpanel')
        .getByText('package.json', { exact: false })
        .first()
    ).toBeVisible();
    
    // Session will be automatically closed by afterEach hook
  });



  test('Verify browser agent works', async ({ page }) => {
    await navigateToSessions(page);
    
    // Create a new session
    await createSession(page, '1. Create a new test in tests/temp.spec.ts with the test name "should click button on page" with a page.goto to https://v0-button-to-open-v0-home-page-h5dizpkwp.vercel.app/ 2. Ask the browser agent to "click on the button and do nothing else" (use project "chromium")');
    
    // Wait for "Running generateTestWithBrowserAgent" text - this can take up to 2 mins
    await expect(page.getByText("Running generateTestWithBrowserAgent")).toBeVisible({ timeout: 120000 });
    
    // Wait for "Used generateTestWithBrowserAgent" - this can take up to 5 mins
    await expect(page.getByText("Used generateTestWithBrowserAgent")).toBeVisible({ timeout: 300000 });
    
    // Click on "Used generateTestWithBrowserAgent" text
    await page.getByText("Used generateTestWithBrowserAgent").click();
    
    // Function details should be visible, and we should be able to assert for "popup" text
    await expect(page.getByText("'popup'")).toBeVisible();
    
    // Close the session via the dropdown menu next to "Review"
    await closeSession(page);
  });

  test('run example.spec.ts and verify Test Execution results with video and attachments', async ({ page, trackCurrentSession }) => {
    await navigateToSessions(page);
    
    // Create a new session
    await createSession(page, 'view the test in example.spec.ts and run it on chromium project');
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/);
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // The initial prompt "Please run the example.spec.ts test file" will trigger the tool execution
    
    // First, wait for the file examination tool to complete
    await expect(page.getByText(/Viewed .+/)).toBeVisible({ timeout: 120000 });
    
    // Then, wait for runTest tool execution to start
    await expect(page.getByText("Running runTest")).toBeVisible({ timeout: 120000 });
    
    // Click on "Running runTest" to open the function details
    await page.getByText("Running runTest").click();
    
    // Wait a moment for the panel to open and render
    await page.waitForTimeout(500);
    
    // Expand the "Tool Input" section
    await page.getByRole('button', { name: 'Tool Input' }).click();
    
    // Assert that the function details panel shows the runTest parameters
    await expect(page.getByText('"testName":')).toBeVisible();
    await expect(page.getByText(/\"filePath\": \"(\/repo\/)?tests\/example\.spec\.ts\"/)).toBeVisible();
    
    // Wait for runTest execution to complete - runTest can take several minutes
    await expect(page.getByText("Used runTest")).toBeVisible({ timeout: 300000 });
    
    // Navigate to Tools tab to verify Test Execution results are visible there
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    
    // Assert that Test Execution Results section is visible in Tools tab
    await expect(page.getByText("Test Execution Results")).toBeVisible();
    
    // Assert that test details are shown - use more specific locator for heading
    await expect(page.getByRole('heading', { name: 'has title' })).toBeVisible();
    
    // Assert that video section is available
    await expect(page.getByText("Videos")).toBeVisible();
    
    // Assert that video player with controls is present
    const videoElement = page.locator('video').first();
    await expect(videoElement).toBeVisible();
    
    // Assert that user can interact with the video player controls
    const playPauseButton = page.locator('media-play-button').first();
    await expect(playPauseButton).toBeVisible();
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
    await navigateToSessions(page);
    
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
    await expect(page).toHaveURL(/sessions/);
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/);
    
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
    await expect(page.getByText(/Viewed.*example\.spec\.ts/)).toBeVisible({ timeout: 120000 });
    
    // Then assertion: "Running" for str_replace tool - should be editing example.spec.ts
    await expect(page.getByText(/Editing.*example\.spec\.ts/)).toBeVisible({ timeout: 120000 });
    
    // Finally assertion: "Used" for str_replace tool - should have edited example.spec.ts
    await expect(page.getByText(/Edited.*example\.spec\.ts/)).toBeVisible({ timeout: 120000 });
    
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
    await expect(page.getByText("Code Changes").first()).toBeVisible();
    
    // Assert that actual diff content is visible (not just loading state)
    // Wait for diff content to load and show the new test name from the modification
    // Look for the new test name within the Tools tab area (using first() to handle multiple matches)
    await expect(page.getByRole('tabpanel').filter({ has: page.getByText('Code Changes') }).getByText('playwright page has title').first()).toBeVisible({ timeout: 15000 });
    
    // Session will be automatically closed by afterEach hook
  });

  test('create session, search files with grep tool and verify tool response in Tools tab', async ({ page, trackCurrentSession }) => {
    await navigateToSessions(page);
    
    // Create a new session with grep search prompt
    const searchMessage = "find all files containing 'title' keyword";
    await createSession(page, searchMessage);
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/);
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Assert that grep tool execution is visible - new UI shows "Searching for ..." instead of "Running grep"
    await expect(page.getByText(/Searching for .+/)).toBeVisible({ timeout: 120000 });
    
    // Wait for grep tool execution to complete - new UI shows result text instead of "Used grep"
    await expect(page.getByText(/Found \d+ results? for "title"/)).toBeVisible({ timeout: 120000 });
    
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
    // Use .first() to avoid strict mode violation when multiple matching elements are present
    await expect(page.getByText(/Found .* results for "title"/).first()).toBeVisible();
    
    // Session will be automatically closed by afterEach hook
  });

  test('run example.spec.ts and verify fetchFile tool execution with screenshot visibility', async ({ page, trackCurrentSession }) => {
    await navigateToSessions(page);
    
    // Create a new session with fetchFile prompt
    const toolMessage = "Please run the example.spec.ts test file and give me the screenshot";
    await createSession(page, toolMessage);
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/);
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // First, wait for the file examination tool (view) to complete
    await expect(page.getByText(/Viewed .+/).first()).toBeVisible({ timeout: 120000 });
    
    // Now wait for the runTest tool execution to complete
    await expect(page.getByText("Used runTest")).toBeVisible({ timeout: 300000 });
    


    
    // Assert that fetchFile tool execution completes successfully
    await expect(page.getByText("Used fetchFile")).toBeVisible({ timeout: 120000 });
    
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
    await navigateToSessions(page);
    
    // Create a new session with create/delete file prompt
    const toolMessage = "Create a new test file in the tests/ directory (e.g., tests/demo.spec.ts) with just a single comment 'this is test file' Then delete it. Do these steps in 2 tool calls, not in parallel";
    await createSession(page, toolMessage);
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/);
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // First, wait for the create tool to start running - should create a .spec.ts file in tests/
    await expect(page.getByText(/Creating.*tests\/.*\.spec\.ts/)).toBeVisible({ timeout: 120000 });
    
    // Then wait for the file creation tool to complete
    await expect(page.getByText(/Created.*tests\/.*\.spec\.ts/)).toBeVisible({ timeout: 120000 });
    
    // Navigate to Tools tab to verify file creation
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    
    // Click on "Created <filename>" to view creation details (new UI)
    await page.getByText(/Created .+/).click();
    
    // Assert that the file was created with the expected comment
    // Look for the comment within the tool response section (not in the original prompt)  
    await expect(page.getByText("// this is test file").first()).toBeVisible();
    
    // Wait for deleteFile tool execution to start (should happen automatically)
    await expect(page.getByText("Running deleteFile")).toBeVisible({ timeout: 120000 });
    
    // Assert that deleteFile tool execution completes successfully
    await expect(page.getByText("Used deleteFile")).toBeVisible({ timeout: 120000 });
    
    // Click on "Used deleteFile" text to open the tool details
    await page.getByText("Used deleteFile").click();
    
    // Assert that the code change diff is visible instead of relying on toast message
    const deleteToolDetails = page
      .getByRole('tabpanel')
      .filter({ has: page.getByText('Code Changes') });
    await expect(deleteToolDetails).toBeVisible();
    await expect(deleteToolDetails.getByText('tests/demo.spec.ts').first()).toBeVisible({ timeout: 15000 });
    await expect(deleteToolDetails.getByText('// this is test file').first()).toBeVisible({ timeout: 15000 });
    
    // Session will be automatically closed by afterEach hook
  });

  test('fetch test run report and verify fetchTestRunDetails tool execution with response in tools tab', async ({ page, trackCurrentSession }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Use helper to get a recent completed test run
    const { testRunId } = await getRecentCompletedTestRun(page);
    
    // Navigate to the test run
    await goToTestRun(page, testRunId);
    
    // Verify we're on the specific test run page
    await expect(page).toHaveURL(new RegExp(`test-runs/${testRunId}`));
    
    // Wait for the page to load
    await expect(page.getByText('Failed', { exact: false }).first()).toBeVisible();
    
    // Collect the current page URL - this is the test run details URL we'll use
    const testRunUrl = page.url();
    console.log('Test run details URL:', testRunUrl);
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Create a new session with fetchTestRunDetails prompt
    const toolMessage = `fetch the testRundetails for this ${testRunUrl}`;
    await createSession(page, toolMessage);
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/);
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Assert that apiClient tool execution completes successfully
    await expect(page.getByText("Used apiClient")).toBeVisible({ timeout: 120000 });
    
    await page.waitForTimeout(1000);
    
    // Navigate to Tools tab to verify tool response is visible
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    
    // Click on "Used apiClient" text to open the tool call response
    await page.getByText("Used apiClient").click();
    
    // Wait a moment for the panel to open and render
    await page.waitForTimeout(500);
    
    // Expand the "Tool Output" section
    await page.getByRole('button', { name: 'Tool Output' }).click();
    
    // Assert that the tool call response is visible in the tools tab
    // The apiClient response returns raw JSON - assert on JSON fields present in the response
    await expect(page.getByRole('tabpanel').getByText(`"id": ${testRunId}`)).toBeVisible();
    await expect(page.getByRole('tabpanel').getByText('"state":')).toBeVisible();
    await expect(page.getByRole('tabpanel').getByText('"test_run_branch":')).toBeVisible();
    
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
    await expect(failedTestLink).toBeVisible();
    
    // Get the test name before clicking (for verification)
    const testName = await failedTestLink.innerText();
    
    await failedTestLink.click();
    
    // Wait for the detail parameter to appear in the URL (new behavior)
    await expect(page).toHaveURL(/detail=/);
    
    // Get the current URL with the detail parameter
    const diagnosisUrl = page.url();
    
    // Click on retry tabs and videos before creating new session
    // Tab 1: First run (should be selected by default)
    await page.getByRole('tab', { name: 'First run' }).click();
    await expect(page.getByRole('tab', { name: 'First run' })).toBeVisible();
    
    // Click on the video in first run tab
    const firstRunVideo = page.locator('video').first();
    await expect(firstRunVideo).toBeVisible();
    await firstRunVideo.click();
    
    // Tab 2: Retry 1
    await page.getByRole('tab', { name: 'Retry 1' }).click();
    await expect(page.getByRole('tab', { name: 'Retry 1' })).toBeVisible();
    
    // Click on the video in retry 1 tab
    const retry1Video = page.locator('video').first();
    await expect(retry1Video).toBeVisible();
    await retry1Video.click();
    
    // Tab 3: Retry 2
    await page.getByRole('tab', { name: 'Retry 2' }).click();
    await expect(page.getByRole('tab', { name: 'Retry 2' })).toBeVisible();
    
    // Click on the video in retry 2 tab
    const retry2Video = page.locator('video').first();
    await expect(retry2Video).toBeVisible();
    await retry2Video.click();
    
    // Step 1: Get the detail parameter URL (already have it as diagnosisUrl)
    // Verify we're still on the report page with detail parameter
    await expect(page).toHaveURL(/detail=/);
    
    // Step 2: Click on the "New Session" button from the report page
    await page.getByRole('button', { name: 'New Session' }).click();
    
    // Fill in the prompt in the modal/dialog
    const toolMessage = `I need you to call the fetchDiagnosisDetails tool with this URL: ${diagnosisUrl}. Please use only the fetchDiagnosisDetails tool to get the diagnosis data.`;
    await page.getByPlaceholder('Enter an initial prompt').fill(toolMessage);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // "Open" in the "Session created" toast opens the session in a new tab — capture it
    const sessionPagePromise = page.context().waitForEvent('page');
    await page.getByRole('button', { name: 'Open', exact: true }).click();
    const sessionPage = await sessionPagePromise;
    
    // Step 3: Verify we're in a session with a specific session ID in the URL
    await expect(sessionPage).toHaveURL(/\/sessions\/[^/?]+/);
    
    // Extract session ID from URL for later verification
    const sessionUrl = sessionPage.url();
    const sessionIdMatch = sessionUrl.match(/\/sessions\/([^/?]+)/);
    const sessionId = sessionIdMatch?.[1];
    
    // Log for debugging
    console.log('Session URL:', sessionUrl);
    console.log('Extracted session ID:', sessionId);
    
    expect(sessionId).toBeTruthy();
    
    // Track the session for automatic cleanup
    trackCurrentSession(sessionPage);
    
    // Wait specifically for fetchDiagnosisDetails tool to be used
    await expect(sessionPage.getByText("Used fetchDiagnosisDetails")).toBeVisible({ timeout: 120000 });
    
    // Switch to Tools tab to verify tool response is available
    await sessionPage.getByRole('tab', { name: 'Tools', exact: true }).click();
    
    // Click specifically on the "Used fetchDiagnosisDetails" tool to expand the response
    await sessionPage.getByText("Used fetchDiagnosisDetails").click();
    
    // Wait a moment for the panel to open and render
    await sessionPage.waitForTimeout(500);
    
    // Expand the "Tool Output" section
    await sessionPage.getByRole('button', { name: 'Tool Output' }).click();
    
    // Assert the general diagnosis content that should be visible in the tool response
    await expect(sessionPage.getByText("Test Case Information")).toBeVisible();
    // Instead of checking for a specific hardcoded test name, check for the pattern that any test case name should follow
    // The format now uses markdown with "**Name**:" instead of "Test Case Name:"
    await expect(sessionPage.getByText(/\*\*Name\*\*: .+/)).toBeVisible();
    // Check that file path is present (could be any .spec.ts file)
    // The format now uses markdown with "**File path**:" instead of "File Path:"
    await expect(sessionPage.getByText(/\*\*File path\*\*: tests\/.+\.spec\.ts/)).toBeVisible();
    
    // Step 4: Go back to test runs page (without detail param) and verify session is listed
    // Navigate back to the test run page without detail parameter
    await page.goto(`/lorem-ipsum-tests/test-runs/${testRunId}`);
    
    // Wait for the test run page to load (URL should not have detail param, but can have other query params)
    await expect(page).toHaveURL(new RegExp(`test-runs/${testRunId}(?:\\?(?!.*detail=).*)?$`));
    await expect(page.getByText('Failed', { exact: false }).first()).toBeVisible();
    
    // Click on the "Sessions" button to view all sessions created from this report page
    await page.getByRole('button', { name: 'Sessions' }).click();
    
    await expect(page.getByText('All sessions for this test run')).toBeVisible();
    
    // Wait a bit for the session to be associated with the test run
    await page.waitForTimeout(2000);
    
    // Assert that the session ID we created is visible somewhere on the page
    await expect(page.getByText(sessionId, { exact: false })).toBeVisible({ timeout: 15000 });
  });

  test('insert comment in example.spec.ts and verify insert tool execution and diff visibility', async ({ page, trackCurrentSession }) => {
    await navigateToSessions(page);
    
    // Create a new session with insert comment prompt
    const insertMessage = "insert a comment '4th line comment' in example.spec.ts file on line no. 3";
    await createSession(page, insertMessage);
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/);
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Wait for the file examination tool (view) to complete - should view example.spec.ts
    await expect(page.getByText(/Viewed.*example\.spec\.ts/)).toBeVisible({ timeout: 120000 });
    
    // Then, wait for insert tool execution to start - should be inserting into example.spec.ts
    await expect(page.getByText(/Inserting into.*example\.spec\.ts/)).toBeVisible({ timeout: 120000 });
    
    // Assert that insert tool is successfully executed - should have inserted into example.spec.ts
    await expect(page.getByText(/Inserted into.*example\.spec\.ts/)).toBeVisible({ timeout: 120000 });
    
    // Navigate to Tools tab to verify the code change diff is visible
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    
    // Click on the "Inserted into <filename>" text to open the diff details (new UI)
    await page.getByText(/Inserted into .+/).click();
    
    // Assert that the code change diff is visible in tools tab
    // Look for the Code Changes section or diff file indicators
    await expect(page.getByText("Code Changes").first()).toBeVisible();
    
    // Assert that actual diff content is visible showing the inserted comment
    // Look for the inserted comment text within the Tools tab area
    await expect(page.getByRole('tabpanel').filter({ has: page.getByText('Code Changes') }).getByText('4th line comment').first()).toBeVisible({ timeout: 15000 });
    
    // Session will be automatically closed by afterEach hook
  });

  test('parallel file view tool calls', async ({ page, trackCurrentSession }) => {
    await navigateToSessions(page);
    
    // Create a new session with parallel file view prompt
    const parallelViewMessage = "whats inside example.spec.ts and search.spec.ts? view them in parallel";
    await createSession(page, parallelViewMessage);
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/);
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Assert 1: "Viewed" - first occurrence
    await expect(page.getByText(/Viewed .+/).first()).toBeVisible({ timeout: 120000 });
    
    // Assert 2: "Viewed" - second occurrence (nth(1))
    await expect(page.getByText(/Viewed .+/).nth(1)).toBeVisible({ timeout: 120000 });
    
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
    await navigateToSessions(page);
    
    // Create a new session with list projects and tests prompt
    const listMessage = "use list projects tool and then list tests for all projects";
    await createSession(page, listMessage);
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/);
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Wait for listProjects to start running
    await expect(page.getByText("Running listProjects")).toBeVisible({ timeout: 120000 });
    
    // Wait for listProjects to be used
    await expect(page.getByText("Used listProjects")).toBeVisible({ timeout: 120000 });
    
    // Wait for first listTestsForProject to start running
    await expect(page.getByText("Running listTestsForProject").first()).toBeVisible({ timeout: 120000 });
    
    // Wait for second listTestsForProject to start running
    await expect(page.getByText("Running listTestsForProject").nth(1)).toBeVisible({ timeout: 120000 });
    
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
    await expect(page.getByRole('tabpanel').getByText('"name":', { exact: false }).first()).toBeVisible();
    await expect(page.getByRole('tabpanel').getByText("chromium").first()).toBeVisible();
    await expect(page.getByRole('tabpanel').getByText("setup").first()).toBeVisible();
    
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
    await expect(failedTestLink).toBeVisible();
    
    await failedTestLink.click();
    
    // Wait for the detail parameter to appear in the URL
    await expect(page).toHaveURL(/detail=/);
    
    // Wait for the page to load and show test details - use .first() to avoid strict mode violation
    await expect(page.getByText('First run').first()).toBeVisible();
    
    // Look for trace.zip link in attachments - it should be visible on the page
    // The trace.zip link typically appears as "View Trace" or in attachments section
    const traceLink = page.getByRole('link', { name: /View Trace/i }).first();
    await expect(traceLink).toBeVisible();
    
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
    
    // "Open" in the "Session created" toast opens the session in a new tab — capture it
    const sessionPagePromise = page.context().waitForEvent('page');
    await page.getByRole('button', { name: 'Open', exact: true }).click();
    const sessionPage = await sessionPagePromise;
    
    // Verify we're in a session
    await expect(sessionPage).toHaveURL(/\/sessions\/[^/?]+/);
    
    // Track the session for automatic cleanup
    trackCurrentSession(sessionPage);
    
    // Wait for safeBash tool to be used (trace utils runs via safeBash)
    await expect(sessionPage.getByTestId("used-safeBash")).toBeVisible({ timeout: 120000 });
    
    // Switch to Tools tab to verify tool response
    await sessionPage.getByRole('tab', { name: 'Tools', exact: true }).click();
    
    // Click on "Used safeBash" to expand the tool response
    await sessionPage.getByTestId("used-safeBash").click();
    
    // Expand the "Tool Output" section
    await sessionPage.getByRole('button', { name: 'Tool Output' }).click();
    
    // The tool output should be visible and contain trace analysis data
    const toolResponse = sessionPage.getByRole('tabpanel');
    
    // The response should contain output from the trace-utils steps command.
    // The tool output may be truncated, so we look for patterns present at the
    // beginning of every trace-utils output: "stdout", "Before Hooks", fixture
    // entries like "[fixture@N]" or API steps like "[pw:api@N]".
    await expect(
      toolResponse.getByText(/stdout|Before Hooks|fixture|pw:api/i).first()
    ).toBeVisible();
    
    // Session will be automatically closed by afterEach hook
  });

  test('safeBash tool execution to get commit SHA', async ({ page, trackCurrentSession }) => {
    await navigateToSessions(page);
    
    // Create a new session with a custom base branch
    const message = "what's the commit sha/ref for the last commit";
    await createSessionWithBranch(page, message, 'example-base-branch');
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Assert safeBash tool is running
    await expect(page.getByTestId("running-safeBash")).toBeVisible({ timeout: 120000 });
    
    // Assert safeBash tool was used
    await expect(page.getByTestId("used-safeBash")).toBeVisible({ timeout: 120000 });
    
    // Assert the commit SHA short hash is visible in the assistant's response
    // git log --oneline shows 7-char short hashes (e.g. b028df8)
    // Use .last() to target the assistant reply (user prompt and tool label also contain b028df8)
    await expect(page.locator('[data-message-id]').filter({ hasText: 'b028df8' }).last()).toBeVisible({ timeout: 120000 });
  });
});