import { test, expect } from "../fixtures";
import { getRecentCompletedTestRun, getRecentFailedTestRun, getRecentFailedTestRunForEnvironment, goToTestRun, getFailedTestLink } from "../pages/test-runs";
import { createSession, createSessionWithBranch, getChatMessageByText, getNewSessionPromptInput, getToolInput, getToolOutput, navigateToSessions, openNewSessionDialog, waitForAgentIdle } from "../pages/sessions";

test.describe('Tool Execution Tests', () => {
  test('create new session, send "list all files" message and verify tool execution', async ({ page, trackCurrentSession }) => {
    await navigateToSessions(page);
    
    // Create a new session
    await createSession(page, 'list all files in the root dir of the repo. no need to do anything else');
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // The agent can list files with ls or find, either directly or via bash.
    // Wait for the completed turn so an individual tool bubble cannot disappear
    // into a "Used N tools" group between locating and clicking it. Check the
    // actual output instead of relying on filenames repeated in the agent reply.
    const listingTool = page.getByText(/^Used (?:ls|find|bash:.*\b(?:ls|find)\b)\b/i).first();
    const toolGroup = page.getByRole('button', { name: /^Used \d+ tools$/ }).first();
    await expect(listingTool.or(toolGroup).first()).toBeVisible({ timeout: 120000 });
    await waitForAgentIdle(page, 120000);
    if (await toolGroup.isVisible()) {
      await toolGroup.click();
    }
    await listingTool.click();
    const toolOutput = await getToolOutput(page);
    await expect(toolOutput.getByText('package.json', { exact: false }).first()).toBeVisible({ timeout: 120000 });
    await expect(toolOutput.getByText('playwright.config.ts', { exact: false }).first()).toBeVisible();
    
    // Session will be automatically closed by afterEach hook
  });



  test('Verify playwright-cli works', async ({ page, trackCurrentSession }) => {
    test.setTimeout(420000);

    await navigateToSessions(page);
    
    // Create a session that explicitly uses the playwright-cli skill
    await createSession(page, 'Use the playwright-cli skill to open the browser and navigate to https://v0-button-to-open-v0-home-page-h5dizpkwp.vercel.app/, then click the button on the page. Include the final opened URL in your response and report what you observe.');
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // playwright-cli skill runs browser actions via bash tool calls in sandbox mode.
    // Wait for the first bash call to complete
    await expect(page.getByText(/Used bash/).first()).toBeVisible({ timeout: 120000 });
    
    // playwright-cli should surface its live browser view while/after the
    // playwright-cli bash calls run, with controls to expand/collapse it.
    const liveBrowserFrame = page.getByRole('img', { name: 'Live browser frame' });
    await expect(liveBrowserFrame).toBeVisible({ timeout: 120000 });
    await expect(liveBrowserFrame).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
    await expect(liveBrowserFrame).toHaveJSProperty('naturalWidth', 1280);
    await expect(liveBrowserFrame).toHaveJSProperty('naturalHeight', 720);
    await expect(page.locator('button[title="Fullscreen"]')).toBeVisible();
    await expect(page.locator('button[title="Collapse live view"]')).toBeVisible();
    
    // Verify at least 2 bash calls were made:
    // one for skill/tool setup, one or more for actual browser interaction
    await expect(page.getByText(/Used bash/).nth(1)).toBeVisible({ timeout: 300000 });
    
    // Verify the agent's report shows the new tab was opened by clicking the button.
    // The V0 page button may open either v0.app or v0.dev, depending on current Vercel behavior.
    // Use .first() to avoid strict mode violation — the URL may render as both a code span and a link.
    await expect(page.getByText(/https:\/\/v0\.(?:app|dev)(?:\/|\b)/).first()).toBeVisible({ timeout: 300000 });
    
    // Session will be automatically closed by afterEach hook
  });

  test('run login.spec.ts and verify Test Execution results with video and attachments', async ({ page, trackCurrentSession }) => {
    await navigateToSessions(page);
    
    await createSession(page, 'view the test in login.spec.ts and run it on chromium project');
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/);
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // In sandbox mode, the agent uses the read tool to view the file contents
    await expect(page.getByText(/^Used read\b/i).first()).toBeVisible({ timeout: 120000 });
    
    // Then, the agent runs the test via bash using npx playwright (not runTest tool in sandbox mode)
    await expect(page.getByText(/Running bash.*npx playwright/)).toBeVisible({ timeout: 120000 });
    
    // Click on the running bash bubble to open its inline details.
    await page.getByText(/Running bash.*npx playwright/).click();

    // Assert that the bash command in the Input section runs playwright test on login.spec.ts.
    // Scoping to the section avoids matching the chat bubble text.
    const toolInput = await getToolInput(page);
    await expect(toolInput.getByText(/login\.spec\.ts/).first()).toBeVisible();
    
    // Wait for the playwright bash to complete. The completed run now renders a
    // dedicated "test run report card" (data-testid="test-run-report-card") in the
    // chat that summarizes the result (e.g. "Tests passed") instead of the previous
    // "Used bash: ..." / "Playwright test passed" bubble. Once this card shows
    // "Tests passed" (with the pass count and per-test row), its summary.json data
    // has already been fetched and rendered — so we don't need a separate
    // waitForResponse('summary.json') here. That listener was racy: the sandbox
    // login run now finishes fast enough that summary.json arrives before the
    // listener is registered (after the tool Input assertions), causing a
    // spurious 330s timeout even though the run passed.
    const completedPlaywrightTool = page.getByTestId('test-run-report-card').filter({
      hasText: /Tests passed/,
    }).first();
    await expect(completedPlaywrightTool).toBeVisible({ timeout: 300000 });
    
    // Expand the report card's accordion row for the test to reveal its result
    // details and media grid (screenshot, video, trace attachments).
    await completedPlaywrightTool
      .getByRole('button', { name: /click login button and input dummy email/ })
      .click();
    
    // The expanded row exposes a region (labelled by the test name) with the test
    // file location and the attachments/media grid.
    const testResultRegion = completedPlaywrightTool.getByRole('region', {
      name: /click login button and input dummy email/,
    });
    await expect(testResultRegion).toBeVisible();
    
    // Assert that test details show the test file location
    await expect(testResultRegion.getByText('login.spec.ts')).toBeVisible();
    
    // Assert the attachments are available in the media grid: screenshot, video, and trace
    await expect(testResultRegion.getByRole('button', { name: 'Screenshot' })).toBeVisible();
    await expect(testResultRegion.getByRole('link', { name: 'Trace' })).toBeVisible();
    
    // Open the video player by clicking the video thumbnail in the media grid
    await testResultRegion.getByRole('button', { name: /^Video/ }).click();
    
    // A dialog opens with the video player for this test
    const videoDialog = page.getByRole('dialog', { name: 'click login button and input dummy email' });
    await expect(videoDialog).toBeVisible();
    
    // Assert that video player with controls is present
    const videoElement = videoDialog.locator('video').first();
    await expect(videoElement).toBeVisible();
    
    // Assert that user can interact with the video player controls
    const playPauseButton = videoDialog.locator('media-play-button').first();
    await expect(playPauseButton).toBeVisible();
    await expect(playPauseButton).toHaveAttribute('aria-label', /play/i);
    await playPauseButton.click();
    await expect(playPauseButton).toHaveAttribute('aria-label', /pause/i);
    
    // Verify that the video has a valid source URL
    await expect(videoElement).toHaveAttribute('src', /https?:\/\/.*\.webm/);
    
    // Session will be automatically closed by afterEach hook
  });

  test('modify login.spec.ts file and verify tool execution and diff visibility', async ({ page, trackCurrentSession, trackRemoteBranch }) => {
    await navigateToSessions(page);

    // The commit review dialog loads its diff from GitHub, so the commit must be pushed.
    const branchName = `flash-test-modify-login-${Date.now()}-${process.pid}`;
    trackRemoteBranch('empirical-run/lorem-ipsum-tests', branchName);
    await openNewSessionDialog(page);
    const modifyMessage = `Create branch ${branchName}, read login.spec.ts to check its contents, change the test name from "click login button and input dummy email" to "playwright page accepts dummy email", then commit and push the change to origin on that branch.`;
    await getNewSessionPromptInput(page).fill(modifyMessage);
    
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/);
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/);
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    test.info().annotations.push({ type: 'Session URL', description: page.url() });
    
    // Consecutive read/edit calls can collapse into a "Used N tools" group.
    // Wait for the turn to finish before inspecting the completed tool bubbles.
    const readTool = page.getByTestId('used-read').first();
    const editTool = page.getByTestId('used-edit').first();
    const toolGroup = page.getByRole('button', { name: /^Used \d+ tools$/ }).first();
    await expect(readTool.or(toolGroup).first()).toBeVisible({ timeout: 120000 });
    await waitForAgentIdle(page, 120000);
    if (await toolGroup.isVisible()) {
      await toolGroup.click();
    }
    await expect(readTool).toBeVisible();
    await expect(editTool).toBeVisible();
    const commitCard = page.getByRole('button', { name: /\bCommit created\b.*\bView changes\b/i }).last();
    await expect(commitCard).toBeVisible({ timeout: 120000 });
    await waitForAgentIdle(page, 120000);
    await expect(commitCard).toContainText(branchName);

    // View changes now opens a commit review dialog, not the session Code Changes
    // side panel. Its diff is fetched from the GitHub commit endpoint.
    const diffCallPromise = page.waitForResponse(response =>
      response.url().includes('/api/github/commit/diff?') &&
      response.request().method() === 'GET' && response.status() === 200,
      { timeout: 30000 }
    );
    await commitCard.getByRole('button', { name: 'View changes', exact: true }).click();
    const commitReview = page.getByRole('dialog', { name: /^Commit [a-f0-9]{7}$/i });
    await expect(commitReview).toBeVisible();
    const diffCall = await diffCallPromise;
    expect(diffCall.url()).toContain('repo=lorem-ipsum-tests');
    await expect(commitReview.getByText('playwright page accepts dummy email').first()).toBeVisible({ timeout: 15000 });
    
    // Session will be automatically closed by afterEach hook
  });


  test('run login.spec.ts and verify screenshot is returned', async ({ page, trackCurrentSession }) => {
    await navigateToSessions(page);
    
    // Create a new session asking to run the test and return a screenshot.
    // IMPORTANT: Do NOT include a bare markdown image literal (e.g. ![alt](url)) in this prompt
    // string, because the chat UI renders it as an <img src="url"> in the user message bubble,
    // causing chatMessages.locator('img').first() to match the broken placeholder instead of the
    // agent's real screenshot. Wrapping the syntax in backticks renders it as <code> instead,
    // which is safe and also gives the agent precise, unambiguous formatting instructions.
    const toolMessage = "Please run the login.spec.ts test file. After the run completes, upload the screenshot using the upload_media tool, then embed it as an inline markdown image in your response using the syntax `![alt text](actual-url-from-upload-media)`. Do not share the URL as plain text.";
    await createSession(page, toolMessage);
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/);
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // In sandbox mode the agent runs the test via bash and then uploads the screenshot.
    // When the agent calls multiple tools in quick succession, the UI may batch them into
    // a single "Used N tools" entry rather than showing each tool call individually.
    // Wait for either the individual upload_media completion or the batched tools entry.
    await expect(
      page.getByText(/^(?:Used upload_media\b|Used \d+ tools\b)/i).first()
    ).toBeVisible({ timeout: 300000 });
    
    // Verify the screenshot appears as an inline image in the chat response.
    // The prompt no longer contains markdown image syntax, so the only <img> in [data-message-id]
    // elements will be the one embedded by the agent with the real upload_media URL.
    const chatMessages = page.locator('[data-message-id]');
    await expect(chatMessages.locator('img').first()).toBeVisible({ timeout: 120000 });
    await expect(chatMessages.locator('img').first()).toHaveAttribute('src', /https?:\/\//);
    
    // Session will be automatically closed by afterEach hook
  });


  test('insert comment in login.spec.ts and verify insert tool execution and diff visibility', async ({ page, trackCurrentSession, trackRemoteBranch }) => {
    await navigateToSessions(page);

    const branchName = `flash-test-insert-login-${Date.now()}-${process.pid}`;
    trackRemoteBranch('empirical-run/lorem-ipsum-tests', branchName);
    const insertMessage = `Create branch ${branchName}, read login.spec.ts to check its contents, insert a comment '4th line comment' in login.spec.ts file on line no. 3, then commit and push the change to origin on that branch.`;
    await createSession(page, insertMessage);
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/);
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Read/edit may be hidden inside the completed "Used N tools" group.
    const readTool = page.getByTestId('used-read').first();
    const editTool = page.getByTestId('used-edit').first();
    const toolGroup = page.getByRole('button', { name: /^Used \d+ tools$/ }).first();
    await expect(readTool.or(toolGroup).first()).toBeVisible({ timeout: 120000 });
    await waitForAgentIdle(page, 120000);
    if (await toolGroup.isVisible()) {
      await toolGroup.click();
    }
    await expect(readTool).toBeVisible();
    await expect(editTool).toBeVisible();
    const commitCard = page.getByRole('button', { name: /\bCommit created\b.*\bView changes\b/i }).last();
    await expect(commitCard).toBeVisible({ timeout: 120000 });
    await waitForAgentIdle(page, 120000);
    await expect(commitCard).toContainText(branchName);
    await commitCard.getByRole('button', { name: 'View changes', exact: true }).click();

    const commitReview = page.getByRole('dialog', { name: /^Commit [a-f0-9]{7}$/i });
    await expect(commitReview).toBeVisible();
    await expect(commitReview.getByText('4th line comment').first()).toBeVisible({ timeout: 15000 });
    
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
    
    // Wait for the test detail parameter to appear in the URL. The report UI identifies
    // selected detail rows with the Playwright `test_id` query param.
    await expect(page).toHaveURL(/test_id=/);
    
    // Wait for the page to load and show test details - use .first() to avoid strict mode violation
    await expect(page.getByText('First run').first()).toBeVisible();
    
    // Look for trace.zip link in attachments - it should be visible on the page
    // The trace.zip link typically appears as "View Trace" or in attachments section
    const traceLink = page.getByRole('link', { name: /View Trace/i }).first();
    await expect(traceLink).toBeVisible();
    
    // Get the trace.zip URL from the href attribute
    const traceUrl = await traceLink.getAttribute('href');
    
    expect(traceUrl).toBeTruthy();
    expect(traceUrl).toContain('trace');
    
    // Create a new session from the report page
    await page.getByRole('button', { name: 'New Session' }).click();
    
    // Fill in the prompt asking to use trace utils to list steps and find the failing step
    const toolMessage = `I need you to analyze the trace file at this URL: ${traceUrl}. Please use trace utils (via safeBash) to list all the steps in the trace, identify the failing step, and tell me which step failed.`;
    await getNewSessionPromptInput(page).fill(toolMessage);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Session creation either exposes an "Open" toast action or opens the session
    // in the test-run side panel. Continue in the full session page in both UIs.
    const openSession = page
      .getByRole('button', { name: 'Open', exact: true })
      .or(page.getByRole('link', { name: 'Open full session' }))
      .first();
    await openSession.click();
    const sessionPage = page;
    
    // Verify we're in a session
    await expect(sessionPage).toHaveURL(/\/sessions\/[^/?]+/);
    
    // Track the session for automatic cleanup
    trackCurrentSession(sessionPage);
    test.info().annotations.push({ type: 'Session URL', description: sessionPage.url() });
    
    // The chat may collapse consecutive tool calls (e.g. read skill + bash) into
    // "Used N tools". A bash bubble can appear briefly and then be unmounted
    // when the group replaces it, so wait until the agent finishes before
    // locating the completed tool call. Expand the group if it was rendered.
    const bashTool = sessionPage.getByTestId('used-bash').first();
    const toolGroup = sessionPage.getByRole('button', { name: /^Used \d+ tools$/ }).first();
    await expect(bashTool.or(toolGroup).first()).toBeVisible({ timeout: 180000 });
    await waitForAgentIdle(sessionPage, 300000);
    if (await toolGroup.isVisible()) {
      await toolGroup.click();
    }

    // Open the completed bash call's inline output (not the user's prompt).
    await expect(bashTool).toBeVisible();
    await bashTool.click();
    
    // Scope assertions to the inline Output section.
    const toolResponse = await getToolOutput(sessionPage);
    
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
    
    // In sandbox mode, the bash tool shows as "Used bash: <command>" in the UI.
    // Bash commands complete near-instantly in sandbox, so we assert on the completion state.
    await expect(page.getByText(/Used bash/).first()).toBeVisible({ timeout: 120000 });
    
    // Assert a commit SHA is visible in the assistant's response. The exact SHA
    // depends on the branch created for the session, so match the SHA format
    // rather than a hard-coded historical commit.
    await expect(getChatMessageByText(page, /\b[a-f0-9]{40}\b/i, 'last')).toBeVisible({ timeout: 120000 });
  });
});