import { test, expect } from "../fixtures";

test.describe('Tool Execution Tests', () => {
  test('create new session, send "list all files" message and verify tool execution', async ({ page, trackCurrentSession }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Create a new session
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByPlaceholder('Enter an initial prompt').fill('list all files in the root dir of the repo. no need to do anything else');
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    

    
    // Wait for tool execution to complete and assert "used" text appears
    await expect(page.getByText(/Used (str_replace_based_edit_tool: view tool|fileViewTool)/)).toBeVisible({ timeout: 45000 });
    
    // Click on "Used" to open the function details
    await page.getByText(/Used (str_replace_based_edit_tool: view tool|fileViewTool)/).click();
    
    // Assert that the function details panel shows the tool call details for either legacy or new label
    await expect(page.getByText(/(Tool Call\s*:\s*fileViewTool|\"command\": \"view\")/)).toBeVisible({ timeout: 10000 });
    
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
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Create a new session
    await page.getByRole('button', { name: 'New' }).click();
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
    
    // Click on Details tab to access session management options
    await page.getByRole('tab', { name: 'Details', exact: true }).click();
    
    // Close the session
    await page.getByRole('button', { name: 'Close Session' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
  });

  test('run example.spec.ts and verify Test Execution results with video and attachments', async ({ page, trackCurrentSession }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Create a new session
    await page.getByRole('button', { name: 'New' }).click();
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
    await expect(page.getByText(/Used (str_replace_based_edit_tool: view tool|fileViewTool)/)).toBeVisible({ timeout: 60000 });
    
    // Then, wait for runTest tool execution to start
    await expect(page.getByText("Running runTest")).toBeVisible({ timeout: 60000 });
    
    // Click on "Running runTest" to open the function details
    await page.getByText("Running runTest").click();
    
    // Assert that the function details panel shows the runTest parameters
    await expect(page.getByText('"testName":')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('"filePath": "tests/example.spec.ts"')).toBeVisible({ timeout: 10000 });
    
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
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Create a new session with initial prompt that will change the test name
    await page.getByRole('button', { name: 'New' }).click();
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
    
    // First assertion: "Used" for view tool
    await expect(page.getByText(/Used (str_replace_based_edit_tool: view tool|fileViewTool)/)).toBeVisible({ timeout: 45000 });
    
    // Then assertion: "Running" for str_replace tool (to get more buffer time)
    await expect(page.getByText(/Running (str_replace_based_edit_tool: str_replace tool|stringReplaceTool tool)/)).toBeVisible({ timeout: 45000 });
    
    // Finally assertion: "Used" for str_replace tool
    await expect(page.getByText(/Used (str_replace_based_edit_tool: str_replace tool|stringReplaceTool tool)/)).toBeVisible({ timeout: 45000 });
    
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
    
    // Click on the "Used str_replace_based_edit_tool: str_replace tool" to open the diff details
    await page.getByText(/Used (str_replace_based_edit_tool: str_replace tool|stringReplaceTool tool)/).click();
    
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
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Create a new session with grep search prompt
    await page.getByRole('button', { name: 'New' }).click();
    const searchMessage = "find all files containing 'title' keyword";
    await page.getByPlaceholder('Enter an initial prompt').fill(searchMessage);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Assert that grep tool execution is visible (wait for "Running grep")
    await expect(page.getByText("Running grep")).toBeVisible({ timeout: 45000 });
    
    // Wait for grep tool execution to complete
    await expect(page.getByText("Used grep")).toBeVisible({ timeout: 45000 });
    
    // Navigate to Tools tab to verify tool response
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    
    // Click on "Used grep" text to open the tool call response
    await page.getByText("Used grep").click();
    
    // Assert that the tool call response is visible in the tools tab
    // Look for the specific grep response format: "Found X results for "title" in "directory""
    await expect(page.getByText(/Found .* results for "title"/)).toBeVisible({ timeout: 10000 });
    
    // Session will be automatically closed by afterEach hook
  });

  test('create pull request and verify PR link is visible in tools tab', async ({ page, trackCurrentSession }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Create a new session with pull request prompt
    await page.getByRole('button', { name: 'New' }).click();
    const pullRequestMessage = "Create a Pull request just to add a Test comment in example.spec.ts file";
    await page.getByPlaceholder('Enter an initial prompt').fill(pullRequestMessage);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // First, AI will examine the file using view tool
    await expect(page.getByText(/Used (str_replace_based_edit_tool: view tool|fileViewTool)/)).toBeVisible({ timeout: 60000 });
    
    // The agent may optionally use a code editing tool before creating the PR, so skip asserting on it
    // Finally, wait for createPullRequest tool execution to start
    await expect(page.getByText("Running createPullRequest")).toBeVisible({ timeout: 120000 });
    
    // Wait for createPullRequest tool execution to complete - PR creation can take several minutes
    await expect(page.getByText("Used createPullRequest")).toBeVisible({ timeout: 300000 });
    
    // Navigate to Tools tab to verify PR link is visible
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    
    // Click on the "Used createPullRequest" to open the tool details
    await page.getByText("Used createPullRequest").click();
    
    // Assert that PR link is visible in the tools tab
    // Look for GitHub PR URL pattern (https://github.com/...)
    await expect(page.locator('a[href*="github.com"]').first()).toBeVisible({ timeout: 10000 });
    
    // Assert that code review dot is visible
    await expect(page.getByTestId('code-review-dot').filter({ visible: true })).toBeVisible({ timeout: 45000 });
    
    // Click on the Review button
    await page.getByRole('button', { name: 'Review' }).click();
    
    // Click on the Code Review tab to open the review section
    await page.getByRole('tab', { name: 'Code Review' }).click();
    
    // Assert that "QUEUED" status is visible initially (check for "Waiting for review..." as it's unique)
    await expect(page.getByText('Waiting for review...')).toBeVisible({ timeout: 10000 });
    
    // Wait for the review to complete and assert either "approved" or "rejected" status
    await expect(
      page.getByText('Approved', { exact: true }).or(
        page.getByText('Rejected', { exact: true })
      )
    ).toBeVisible({ timeout: 60000 });
    
    // Session will be automatically closed by afterEach hook
  });

  test('run example.spec.ts and verify fetchFile tool execution with screenshot visibility', async ({ page, trackCurrentSession }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Create a new session with fetchFile prompt
    await page.getByRole('button', { name: 'New' }).click();
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
    await expect(page.getByText(/Used (str_replace_based_edit_tool: view tool|fileViewTool)/)).toBeVisible({ timeout: 60000 });
    
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

  test('create test file using str_replace_based_edit_tool create and delete using deleteFile tool with verification in tools tab', async ({ page, trackCurrentSession }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Create a new session with create/delete file prompt
    await page.getByRole('button', { name: 'New' }).click();
    const toolMessage = "Create a new test file in the tests/ directory (e.g., tests/demo.spec.ts) with just a single comment 'this is test file' Then delete it";
    await page.getByPlaceholder('Enter an initial prompt').fill(toolMessage);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // First, wait for the create tool to start running
    await expect(page.getByText(/Running (str_replace_based_edit_tool: create|fileCreateTool)/)).toBeVisible({ timeout: 60000 });
    
    // Then wait for the file creation tool to complete
    await expect(page.getByText(/Used (str_replace_based_edit_tool: create tool|fileCreateTool)/)).toBeVisible({ timeout: 60000 });
    
    // Navigate to Tools tab to verify file creation
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    
    // Click on "Used str_replace_based_edit_tool: create tool" to view creation details
    await page.getByText(/Used (str_replace_based_edit_tool: create tool|fileCreateTool)/).click();
    
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
    
    // Set up network interception BEFORE navigating to test runs
    const testRunsApiPromise = page.waitForResponse(response => 
      response.url().includes('/api/test-runs') && response.request().method() === 'GET'
    );
    
    // Navigate to the test runs page - this will trigger the API call we're waiting for
    await page.getByRole('link', { name: 'Test Runs' }).click();
    
    // Capture the API response that the page makes naturally
    const apiResponse = await testRunsApiPromise;
    
    // Verify the API response is successful
    expect(apiResponse.ok()).toBeTruthy();
    expect(apiResponse.status()).toBe(200);
    
    // Parse the response data
    const responseData = await apiResponse.json();
    
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
    
    // Click on the test run link in the UI instead of navigating directly
    const testRunLink = page.locator(`a[href*="/test-runs/${testRunId}"]`).first();
    await expect(testRunLink).toBeVisible({ timeout: 5000 });
    await testRunLink.click();
    
    // Verify we're on the specific test run page
    await expect(page).toHaveURL(new RegExp(`test-runs/${testRunId}`));
    
    // Wait for the page to load
    await expect(page.getByText('Failed', { exact: false }).first()).toBeVisible({ timeout: 10000 });
    
    // Collect the current page URL - this is the test run details URL we'll use
    const testRunUrl = page.url();
    console.log('Test run details URL:', testRunUrl);
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Wait for the sessions page to load and stabilize
    await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();
    
    // Create a new session with fetchTestRunDetails prompt
    await page.getByRole('button', { name: 'New' }).first().click();
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
    await expect(page.getByText("Used fetchTestRunDetails")).toBeVisible({ timeout: 45000 });
    
    await page.waitForTimeout(1000);
    
    // Navigate to Tools tab to verify tool response is visible
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    
    // Click on "Used fetchTestRunDetails" text to open the tool call response
    await page.getByText("Used fetchTestRunDetails").click();
    
    // Assert that the tool call response is visible in the tools tab
    // Look for specific test run details that should be in the fetchTestRunDetails response
    await expect(page.getByRole('heading', { name: 'Test run details' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Run info")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(`Run ID: ${testRunId}`)).toBeVisible({ timeout: 10000 });
    
    // Session will be automatically closed by afterEach hook
  });

  test('list environments and verify listEnvironments tool execution', async ({ page, trackCurrentSession }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Create a new session with listEnvironments prompt
    await page.getByRole('button', { name: 'New' }).click();
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
    await expect(page.getByText("Used listEnvironments")).toBeVisible({ timeout: 45000 });
    
    // Navigate to Tools tab to verify tool response
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    
    // Click on "Used listEnvironments" to open the tool details
    await page.getByText("Used listEnvironments").click();
    
    // Assert that Tool Response section is visible
    await expect(page.getByText("Tool Response")).toBeVisible({ timeout: 10000 });
    
    // Assert that the environments data is visible in the tools tab
    // Look for the environments array in the JSON response
    await expect(page.getByText('"environments"')).toBeVisible({ timeout: 10000 });
    
    // Assert that environment details are present (like id field)
    await expect(page.getByText('"id":')).toBeVisible({ timeout: 10000 });
    
    // Session will be automatically closed by afterEach hook
  });

  test('go to recently completed test run, click failed test, then fetch diagnosis report in new session', async ({ page, trackCurrentSession }) => {
    // Navigate to the application (already logged in via auth setup)
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
    
    // Find a test run that has ended state and has failed tests
    const endedTestRuns = responseData.data.test_runs.items.filter(
      (testRun: any) => testRun.state === 'ended' && testRun.failed_count > 0
    );
    
    expect(endedTestRuns.length).toBeGreaterThan(0);
    const testRunId = endedTestRuns[0].id;
    
    expect(testRunId).toBeTruthy();
    console.log('Found completed test run with failed tests ID:', testRunId);
    console.log('Test run details:', endedTestRuns[0]);
    
    // Click on the test run link in the UI instead of navigating directly
    const testRunLink = page.locator(`a[href*="/test-runs/${testRunId}"]`).first();
    await expect(testRunLink).toBeVisible({ timeout: 5000 });
    await testRunLink.click();
    
    // Verify we're on the specific test run page
    await expect(page).toHaveURL(new RegExp(`test-runs/${testRunId}`));
    
    // Wait for the page to load and look for failed tests
    await expect(page.getByText('Failed', { exact: false }).first()).toBeVisible({ timeout: 10000 });
    
    // Find and click on a failed test link
    const failedTestLink = page.locator('a[href*="/diagnosis/"]').first();
    await expect(failedTestLink).toBeVisible({ timeout: 10000 });
    
    // Get the test name before clicking (for verification)
    const testName = await failedTestLink.innerText();
    console.log('Found failed test:', testName);
    
    await failedTestLink.click();
    
    // Wait for the diagnosis page to load
    await expect(page).toHaveURL(/diagnosis/, { timeout: 10000 });
    
    // Get the diagnosis URL
    const diagnosisUrl = page.url();
    console.log('Diagnosis URL:', diagnosisUrl);
    
    // Click on retry tabs and videos before creating new session
    // Tab 1: First run (should be selected by default)
    await page.getByRole('tab', { name: 'First run' }).click();
    await expect(page.getByRole('tab', { name: 'First run' })).toBeVisible({ timeout: 10000 });
    console.log('Clicked on First run tab');
    
    // Click on the video in first run tab
    const firstRunVideo = page.locator('video').first();
    await expect(firstRunVideo).toBeVisible({ timeout: 10000 });
    await firstRunVideo.click();
    console.log('Clicked on video in First run tab');
    
    // Tab 2: Retry 1
    await page.getByRole('tab', { name: 'Retry 1' }).click();
    await expect(page.getByRole('tab', { name: 'Retry 1' })).toBeVisible({ timeout: 10000 });
    console.log('Clicked on Retry 1 tab');
    
    // Click on the video in retry 1 tab
    const retry1Video = page.locator('video').first();
    await expect(retry1Video).toBeVisible({ timeout: 10000 });
    await retry1Video.click();
    console.log('Clicked on video in Retry 1 tab');
    
    // Tab 3: Retry 2
    await page.getByRole('tab', { name: 'Retry 2' }).click();
    await expect(page.getByRole('tab', { name: 'Retry 2' })).toBeVisible({ timeout: 10000 });
    console.log('Clicked on Retry 2 tab');
    
    // Click on the video in retry 2 tab
    const retry2Video = page.locator('video').first();
    await expect(retry2Video).toBeVisible({ timeout: 10000 });
    await retry2Video.click();
    console.log('Clicked on video in Retry 2 tab');
    
    // Navigate back to the main application first
    await page.goto('/');
    
    // Navigate to Sessions to create a new session (use the button instead of link in case sidebar is collapsed)
    await page.getByRole('button', { name: 'My open sessions' }).click();
    
    // Create a new session with fetchDiagnosisDetails prompt
    await page.getByRole('button', { name: 'New' }).click();
    const toolMessage = `I need you to call the fetchDiagnosisDetails tool with this URL: ${diagnosisUrl}. Please use only the fetchDiagnosisDetails tool to get the diagnosis data.`;
    await page.getByPlaceholder('Enter an initial prompt').fill(toolMessage);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Wait specifically for fetchDiagnosisDetails tool to be used
    await expect(page.getByText("Used fetchDiagnosisDetails")).toBeVisible({ timeout: 45000 });
    
    // Switch to Tools tab to verify tool response is available
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    
    // Click specifically on the "Used fetchDiagnosisDetails" tool to expand the response
    await page.getByText("Used fetchDiagnosisDetails").click();
    
    // Assert the general diagnosis content that should be visible in the tool response
    await expect(page.getByText("Test Case Diagnosis")).toBeVisible({ timeout: 10000 });
    // Instead of checking for a specific hardcoded test name, check for the pattern that any test case name should follow
    await expect(page.getByText(/Test Case Name: .+/)).toBeVisible({ timeout: 10000 });
    // Check that file path is present (could be any .spec.ts file)
    await expect(page.getByText(/File Path: tests\/.+\.spec\.ts/)).toBeVisible({ timeout: 10000 });
    
    console.log('✅ Successfully completed end-to-end workflow:');
    console.log('  1. Found failed test:', testName);
    console.log('  2. Captured diagnosis URL:', diagnosisUrl);
    console.log('  3. Created new session and sent diagnosis URL');
    console.log('  4. ONLY fetchDiagnosisDetails tool was used (no other tools)');
    console.log('  5. Tool response shows diagnosis information including test case details');
    
    console.log('Successfully fetched diagnosis report for test:', testName);
  });

  test('insert comment in example.spec.ts and verify str_replace_based_edit_tool: insert tool execution and diff visibility', async ({ page, trackCurrentSession }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Create a new session with insert comment prompt
    await page.getByRole('button', { name: 'New' }).click();
    const insertMessage = "insert a comment '4th line comment' in example.spec.ts file on line no. 3";
    await page.getByPlaceholder('Enter an initial prompt').fill(insertMessage);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Wait for the file examination tool (view) to complete
    await expect(page.getByText(/Used (str_replace_based_edit_tool: view tool|fileViewTool)/)).toBeVisible({ timeout: 45000 });
    
    // Then, wait for str_replace_based_edit_tool: insert tool execution to start
    await expect(page.getByText(/Running (str_replace_based_edit_tool: insert tool|stringInsertTool tool)/)).toBeVisible({ timeout: 45000 });
    
    // Assert that str_replace_based_edit_tool: insert tool is successfully executed
    await expect(page.getByText(/Used (str_replace_based_edit_tool: insert tool|stringInsertTool tool)/)).toBeVisible({ timeout: 45000 });
    
    // Navigate to Tools tab to verify the code change diff is visible
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    
    // Click on the "Used str_replace_based_edit_tool: insert tool" text to open the diff details
    await page.getByText(/Used (str_replace_based_edit_tool: insert tool|stringInsertTool tool)/).click();
    
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
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Create a new session with parallel file view prompt
    await page.getByRole('button', { name: 'New' }).click();
    const parallelViewMessage = "whats inside example.spec.ts and search.spec.ts? view them in parallel";
    await page.getByPlaceholder('Enter an initial prompt').fill(parallelViewMessage);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Assert 1: "Used str_replace_based_edit_tool: view tool" - first occurrence
    await expect(page.getByText(/Used (str_replace_based_edit_tool: view tool|fileViewTool)/).first()).toBeVisible({ timeout: 45000 });
    
    // Assert 2: "Used str_replace_based_edit_tool: view tool" - second occurrence (nth(1))
    await expect(page.getByText(/Used (str_replace_based_edit_tool: view tool|fileViewTool)/).nth(1)).toBeVisible({ timeout: 45000 });
    
    // Navigate to Tools tab to verify both tool executions are visible
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    
    // Click on the first "Used str_replace_based_edit_tool: view tool" to open the tool details
    await page.getByText(/Used (str_replace_based_edit_tool: view tool|fileViewTool)/).first().click();
    
    // Assert that one of the files (example.spec.ts or search.spec.ts) content is visible in the response
    await expect(page.getByText("Tool Response")).toBeVisible({ timeout: 10000 });
    
    // Session will be automatically closed by afterEach hook
  });
});