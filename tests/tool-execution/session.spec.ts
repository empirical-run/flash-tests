import { test, expect } from "../fixtures";
import { getRecentCompletedTestRun, getRecentFailedTestRun, getRecentFailedTestRunForEnvironment, goToTestRun, getFailedTestLink } from "../pages/test-runs";
import { closeSession, createSession, createSessionWithBranch, expandToolOutput, navigateToSessions, openNewSessionDialog } from "../pages/sessions";

test.describe('Tool Execution Tests', () => {
  test('create new session, send "list all files" message and verify tool execution', async ({ page, trackCurrentSession, withSandboxSession }) => {
    await navigateToSessions(page);
    
    // Create a new session
    await createSession(page, 'list all files in the root dir of the repo. no need to do anything else');
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // In sandbox mode the agent uses the ls tool
    await expect(page.getByText('Used ls tool')).toBeVisible({ timeout: 120000 });
    
    // The ls output is rendered as a table in the chat — verify key repo files are listed
    const chatMessages = page.locator('[data-message-id]');
    await expect(chatMessages.getByText('package.json', { exact: false }).first()).toBeVisible({ timeout: 30000 });
    await expect(chatMessages.getByText('playwright.config.ts', { exact: false }).first()).toBeVisible();
    
    // Session will be automatically closed by afterEach hook
  });



  test('Verify browser agent works', async ({ page }) => {
    await navigateToSessions(page);
    
    // Create a session that explicitly uses the playwright-cli skill
    await createSession(page, 'Use the playwright-cli skill to open the browser and navigate to https://v0-button-to-open-v0-home-page-h5dizpkwp.vercel.app/, then click the button on the page. Report what you observe.');
    
    // playwright-cli skill runs browser actions via bash tool calls in sandbox mode.
    // Wait for the first bash call to complete (skill documentation load or first browser action)
    await expect(page.getByText(/Used bash.*playwright-cli/i).first()).toBeVisible({ timeout: 120000 });
    
    // Wait for the full session to complete (browser navigation + click can take up to 5 mins)
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible({ timeout: 300000 });
    
    // Verify at least 2 bash/playwright-cli calls were made:
    // one for skill documentation load, one or more for actual browser interaction
    await expect(page.getByText(/Used bash.*playwright-cli/i).nth(1)).toBeVisible();
    
    // Verify the agent's report shows the new tab was opened by clicking the button
    // The V0 page button opens a new browser tab to https://v0.app/ (popup behavior)
    // Use .first() to avoid strict mode violation — the URL may render as both a code span and a link
    await expect(page.getByText("https://v0.app/").first()).toBeVisible();
    
    // Close the session via the dropdown menu next to "Review"
    await closeSession(page);
  });

  test('run example.spec.ts and verify Test Execution results with video and attachments', async ({ page, trackCurrentSession, withSandboxSession }) => {
    await navigateToSessions(page);
    
    // Create a new session (withSandboxSession fixture adds agentInSandbox flag)
    await createSession(page, 'view the test in example.spec.ts and run it on chromium project');
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/);
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // In sandbox mode, the agent uses the read tool to view the file contents
    await expect(page.getByText(/Used read tool/).first()).toBeVisible({ timeout: 120000 });
    
    // Then, the agent runs the test via bash using npx playwright (not runTest tool in sandbox mode)
    await expect(page.getByText(/Running bash.*npx playwright/)).toBeVisible({ timeout: 120000 });
    
    // Click on the running bash bubble to open the function details
    await page.getByText(/Running bash.*npx playwright/).click();
    
    // Expand the "Tool Input" section
    await page.getByRole('button', { name: 'Tool Input' }).click();
    
    // Assert that the bash command in the tool input panel runs playwright test on example.spec.ts
    // Scope to the <pre> element in the panel to avoid matching the chat bubble text
    await expect(page.locator('pre').getByText(/example\.spec\.ts/).first()).toBeVisible();
    
    // Start listening for summary.json before the bash wait — it arrives before bash completion
    const summaryResponsePromise = page.waitForResponse(
      response => response.url().endsWith('summary.json'),
      { timeout: 330000 }
    );

    // Wait for the playwright bash to complete — this is the main completion signal
    await expect(page.getByText(/Used bash.*npx playwright/)).toBeVisible({ timeout: 300000 });
    
    // Await the summary.json response (registered early so we don't miss it)
    await summaryResponsePromise;
    
    // Click on the completed playwright bash bubble to open its details in the side panel
    await page.getByText(/Used bash.*npx playwright/).click();
    
    // Assert that Test Execution Results section is visible (same UI as non-sandbox runTest)
    await expect(page.getByText("Test Execution Results")).toBeVisible();
    
    // Assert that test details show the test name
    await expect(page.getByRole('heading', { name: 'has title' })).toBeVisible();
    
    // Assert that the Videos section is visible
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
    
    // Session will be automatically closed by afterEach hook
  });

  test('modify example.spec.ts file and verify tool execution and diff visibility', async ({ page, trackCurrentSession }) => {
    await navigateToSessions(page);
    
    // Create a new session with initial prompt that will change the test name
    await openNewSessionDialog(page);
    const modifyMessage = 'Change the test name in example.spec.ts from "has title" to "playwright page has title"';
    await page.getByPlaceholder('Enter an initial prompt or drag and drop a file here').fill(modifyMessage);
    
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
    
    // First assertion: wait for read tool to complete (sandbox uses "read" instead of "Viewed FILE")
    await expect(page.getByText('Used read tool').first()).toBeVisible({ timeout: 120000 });
    
    // Finally assertion: wait for edit tool to complete (sandbox uses "edit" instead of "Edited FILE")
    await expect(page.getByText('Used edit tool').first()).toBeVisible({ timeout: 120000 });
    
    // Set up listener for the second diff API call AFTER the edit tool finishes
    const secondDiffCallPromise = page.waitForResponse(
      response => response.url().includes(`/api/chat-sessions/${sessionId}/diff`) && 
                  response.request().method() === 'GET',
      { timeout: 15000 }
    );
    
    // Wait for and verify the second diff API call was made after the tool execution
    const secondDiffCall = await secondDiffCallPromise;
    expect(secondDiffCall.status()).toBe(200);
    expect(secondDiffCall.url()).toContain(`/api/chat-sessions/${sessionId}/diff`);
    console.log('✅ Second diff API call made after edit tool execution:', secondDiffCall.url(), 'Status:', secondDiffCall.status());
    
    // Click on the "Used edit tool" bubble to open the diff details in the side panel
    await page.getByText('Used edit tool').first().click();
    
    // Assert that the code change diff is visible in tools tab
    // Look for the Code Changes section or diff file indicators
    await expect(page.getByText("Code Changes").first()).toBeVisible();
    
    // Assert that actual diff content is visible (not just loading state)
    // Wait for diff content to load and show the new test name from the modification
    // Look for the new test name within the Tools tab area (using first() to handle multiple matches)
    await expect(page.getByText('playwright page has title').first()).toBeVisible({ timeout: 15000 });
    
    // Session will be automatically closed by afterEach hook
  });


  test('run example.spec.ts and verify screenshot is returned', async ({ page, trackCurrentSession, withSandboxSession }) => {
    await navigateToSessions(page);
    
    // Create a new session asking to run the test and return a screenshot
    const toolMessage = "Please run the example.spec.ts test file and give me the screenshot";
    await createSession(page, toolMessage);
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/);
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // In sandbox mode the agent runs the test via bash
    await expect(page.getByText(/Running bash:.*npx playwright.*example\.spec\.ts/).first()).toBeVisible({ timeout: 120000 });
    await expect(page.getByText(/Used bash:.*npx playwright.*example\.spec\.ts/).first()).toBeVisible({ timeout: 300000 });
    
    // Agent then uploads the screenshot via the upload_media tool
    await expect(page.getByText('Used upload_media tool')).toBeVisible({ timeout: 120000 });
    
    // Verify the screenshot appears as an inline image in the chat response
    const chatMessages = page.locator('[data-message-id]');
    await expect(chatMessages.locator('img').first()).toBeVisible({ timeout: 30000 });
    await expect(chatMessages.locator('img').first()).toHaveAttribute('src', /https?:\/\//);
    
    // Session will be automatically closed by afterEach hook
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
    
    // Wait for the read tool to complete (sandbox uses "read" instead of "Viewed FILE")
    await expect(page.getByText('Used read tool').first()).toBeVisible({ timeout: 120000 });
    
    // Assert that edit tool is successfully executed (sandbox uses "edit" for insert operations too)
    await expect(page.getByText('Used edit tool').first()).toBeVisible({ timeout: 120000 });
    
    // Click on the "Used edit tool" bubble to open the diff details in the side panel
    await page.getByText('Used edit tool').first().click();
    
    // Assert that the code change diff is visible in tools tab
    // Look for the Code Changes section or diff file indicators
    await expect(page.getByText("Code Changes").first()).toBeVisible();
    
    // Assert that actual diff content is visible showing the inserted comment
    // Look for the inserted comment text within the Tools tab area
    await expect(page.getByText('4th line comment').first()).toBeVisible({ timeout: 15000 });
    
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
    await page.getByPlaceholder('Enter an initial prompt or drag and drop a file here').fill(toolMessage);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // "Open" in the "Session created" toast opens the session in a new tab — capture it
    const sessionPagePromise = page.context().waitForEvent('page');
    await page.getByRole('button', { name: 'Open', exact: true }).click();
    const sessionPage = await sessionPagePromise;
    
    // Verify we're in a session
    await expect(sessionPage).toHaveURL(/\/sessions\/[^/?]+/);
    
    // Track the session for automatic cleanup
    trackCurrentSession(sessionPage);
    
    // Wait for bash tool to be used (trace utils runs via bash in sandbox mode)
    await expect(sessionPage.getByText(/Used bash/).first()).toBeVisible({ timeout: 120000 });
    
    // Click on "Used bash" to open the tool response in the side panel
    await sessionPage.getByText(/Used bash/).first().click();
    
    // Expand the "Tool Output" section and scope assertions to it
    const toolResponse = await expandToolOutput(sessionPage);
    
    // The response should contain output from the trace-utils steps command.
    // The tool output may be truncated, so we look for patterns present at the
    // beginning of every trace-utils output: "stdout", "Before Hooks", fixture
    // entries like "[fixture@N]" or API steps like "[pw:api@N]".
    await expect(
      toolResponse.getByText(/stdout|Before Hooks|fixture|pw:api/i).first()
    ).toBeVisible();
    
    // Session will be automatically closed by afterEach hook
  });

  test('safeBash tool execution to get commit SHA', async ({ page, trackCurrentSession, withSandboxSession }) => {
    await navigateToSessions(page);
    
    // Create a new session with a custom base branch
    const message = "what's the commit sha/ref for the last commit";
    await createSessionWithBranch(page, message, 'example-base-branch');
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // In sandbox mode, the bash tool shows as "Used bash: <command>" in the UI.
    // Bash commands complete near-instantly in sandbox, so we assert on the completion state.
    await expect(page.getByText(/Used bash/)).toBeVisible({ timeout: 120000 });
    
    // Assert the commit SHA short hash is visible in the assistant's response.
    // git log --oneline shows 7-char short hashes (e.g. b028df8).
    // Use .last() to target the assistant reply (user prompt and tool label also contain b028df8).
    await expect(page.locator('[data-message-id]').filter({ hasText: 'b028df8' }).last()).toBeVisible({ timeout: 120000 });
  });
});