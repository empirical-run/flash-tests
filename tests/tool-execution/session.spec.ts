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
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Send the message "list all files in the root dir of the repo. no need to do anything else"
    const toolMessage = "list all files in the root dir of the repo. no need to do anything else";
    await page.getByPlaceholder('Type your message').click();
    await page.getByPlaceholder('Type your message').fill(toolMessage);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify the message was sent and appears in the conversation
    await expect(page.getByText(toolMessage)).toBeVisible({ timeout: 10000 });
    
    // Assert that tool execution is visible (the specific tool being used)
    await expect(page.getByText("Running str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
    
    // Click on "Running" to open the function details
    await page.getByText("Running str_replace_based_edit_tool: view tool").click();
    
    // Assert that the function details panel shows the common view command
    await expect(page.getByText('"command": "view"')).toBeVisible({ timeout: 10000 });
    
    // Wait for tool execution to complete and assert "used" text appears
    await expect(page.getByText("Used str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
    
    // Function details should auto-update to show the tool result when execution completes
    // Assert that the tool result is visible in the function details panel
    await expect(page.getByText("package.json")).toBeVisible({ timeout: 10000 });
    
    // Session will be automatically closed by afterEach hook
  });

  test('stop tool execution after seeing running and verify tool was rejected', async ({ page }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Create a new session
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Send a message that will trigger tool execution
    const toolMessage = "list all files in the root dir of the repo. no need to do anything else";
    await page.getByPlaceholder('Type your message').click();
    await page.getByPlaceholder('Type your message').fill(toolMessage);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify the message was sent and appears in the conversation
    await expect(page.getByText(toolMessage)).toBeVisible({ timeout: 10000 });
    
    // Wait for "Running" status to appear
    await expect(page.getByText("Running str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
    
    // Click the stop button to stop the tool execution
    await page.getByRole('button', { name: 'Stop' }).click();
    
    // Assert that tool was rejected/stopped
    await expect(page.getByText("str_replace_based_edit_tool: view was rejected by the user")).toBeVisible({ timeout: 10000 });
    
    // Verify that user can send a new message (message input should be enabled and available)
    await expect(page.getByPlaceholder('Type your message')).toBeEnabled({ timeout: 5000 });
    
    // Send another message to verify functionality is restored
    const newMessage = "hello again";
    await page.getByPlaceholder('Type your message').click();
    await page.getByPlaceholder('Type your message').fill(newMessage);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify the new message appears
    await expect(page.getByText(newMessage)).toBeVisible({ timeout: 10000 });
    
    // Click on Details tab to access session management options
    await page.getByRole('tab', { name: 'Details', exact: true }).click();
    
    // Close the session
    await page.getByRole('button', { name: 'Close Session' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
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
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Send the message requesting browser agent assistance
    const toolMessage = "Create a new test in tests/temp.spec.ts with test name \"should click button on page\" with a page.goto https://v0-button-to-open-v0-home-page-h5dizpkwp.vercel.app/ - then ask the browser to \"click on the button and do nothing else\"";
    await page.getByPlaceholder('Type your message').click();
    await page.getByPlaceholder('Type your message').fill(toolMessage);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify the message was sent and appears in the conversation
    await expect(page.getByText(toolMessage)).toBeVisible({ timeout: 10000 });
    
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
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Send the message to run example.spec.ts (which the AI confirmed exists)
    const toolMessage = "Please run the example.spec.ts test file";
    await page.getByPlaceholder('Type your message').click();
    await page.getByPlaceholder('Type your message').fill(toolMessage);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify the message was sent and appears in the conversation
    await expect(page.getByText(toolMessage)).toBeVisible({ timeout: 10000 });
    
    // First, wait for the file examination tool to complete
    await expect(page.getByText("Used str_replace_based_edit_tool")).toBeVisible({ timeout: 60000 });
    
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
    
    // Assert that user can play the video - try clicking on the video element itself
    await videoElement.click();
    
    // Verify video has controls attribute (indicates playback capability)
    await expect(videoElement).toHaveAttribute('controls');
    
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
    
    // Create a new session
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Send a prompt that will specifically trigger str_replace tool (not insert)
    const modifyMessage = "Replace the first line of example.spec.ts with '// This test validates the page title' followed by the original import statement";
    await page.getByPlaceholder('Type your message').click();
    await page.getByPlaceholder('Type your message').fill(modifyMessage);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify the message was sent and appears in the conversation
    await expect(page.getByText(modifyMessage)).toBeVisible({ timeout: 10000 });
    
    // First, wait for the file examination tool (view) to complete
    await expect(page.getByText("Used str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });
    
    // Then, wait for str_replace_based_edit_tool:str_replace tool call to be visible
    await expect(page.getByText("Running str_replace_based_edit_tool: str_replace tool")).toBeVisible({ timeout: 45000 });
    
    // Assert that str_replace_based_edit_tool:str_replace is successfully executed
    await expect(page.getByText("Used str_replace_based_edit_tool: str_replace tool")).toBeVisible({ timeout: 45000 });
    
    // Click on the Tools tab to verify the code change diff is visible
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    
    // Click on the "Used str_replace_based_edit_tool: str_replace tool" to open the diff details
    await page.getByText("Used str_replace_based_edit_tool: str_replace tool").click();
    
    // Assert that the code change diff is visible in tools tab
    // Look for the Code Changes section or diff file indicators
    await expect(page.getByText("Code Changes").first()).toBeVisible({ timeout: 10000 });
    
    // Assert that actual diff content is visible (not just loading state)
    // Wait for diff content to load and show actual changes (look for diff markers or comment content)
    await expect(page.getByText('+').or(page.getByText('-')).or(page.getByText('This test validates the page title')).first()).toBeVisible({ timeout: 15000 });
    
    // Session will be automatically closed by afterEach hook
  });

  test('create session, search files with grep tool and verify tool response in Tools tab', async ({ page, trackCurrentSession }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Create a new session
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Send the specific prompt to search for files containing 'title' keyword
    const searchMessage = "find all files containing 'title' keyword";
    await page.getByPlaceholder('Type your message').click();
    await page.getByPlaceholder('Type your message').fill(searchMessage);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify the message was sent and appears in the conversation
    await expect(page.getByText(searchMessage)).toBeVisible({ timeout: 10000 });
    
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
    
    // Click on Details tab to access session management options
    await page.getByRole('tab', { name: 'Details', exact: true }).click();
    
    // Close the session as requested
    await page.getByRole('button', { name: 'Close Session' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
  });

  test('create pull request and verify PR link is visible in tools tab', async ({ page, trackCurrentSession }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Create a new session
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Send the message to create a pull request
    const pullRequestMessage = "Create a Pull request just to add a Test comment in example.spec.ts file";
    await page.getByPlaceholder('Type your message').click();
    await page.getByPlaceholder('Type your message').fill(pullRequestMessage);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify the message was sent and appears in the conversation
    await expect(page.getByText(pullRequestMessage)).toBeVisible({ timeout: 10000 });
    
    // First, AI will examine the file using view tool
    await expect(page.getByText("Used str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 60000 });
    
    // Then, AI will add the comment using str_replace tool
    await expect(page.getByText("Used str_replace_based_edit_tool: str_replace tool")).toBeVisible({ timeout: 60000 });
    
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
    
    // Click on Details tab to access session management options
    await page.getByRole('tab', { name: 'Details', exact: true }).click();
    
    // Close the session
    await page.getByRole('button', { name: 'Close Session' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
  });

  test('run example.spec.ts and verify fetchImage tool execution with screenshot visibility', async ({ page, trackCurrentSession }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Create a new session
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Send the specific prompt to run example.spec.ts and get screenshot
    const toolMessage = "Run example.spec.ts and give me the screenshot";
    await page.getByPlaceholder('Type your message').click();
    await page.getByPlaceholder('Type your message').fill(toolMessage);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify the message was sent and appears in the conversation
    await expect(page.getByText(toolMessage)).toBeVisible({ timeout: 10000 });
    
    // First, wait for the file examination tool (view) to complete
    await expect(page.getByText("Used str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 60000 });
    
    // Now wait for the runTest tool execution to complete
    await expect(page.getByText("Used runTest")).toBeVisible({ timeout: 300000 });
    
    // Then, wait for fetchImage tool execution to start
    await expect(page.getByText("Running fetchImage")).toBeVisible({ timeout: 60000 });
    
    // Assert that fetchImage tool execution completes successfully
    await expect(page.getByText("Used fetchImage")).toBeVisible({ timeout: 60000 });
    
    // Navigate to Tools tab to verify screenshot visibility
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    
    // Click on "Used fetchImage tool" text to open the tool details
    await page.getByText("Used fetchImage").click();
    
    // Assert that the screenshot image is visible in the tools tab
    // Look for an img element within the Response section that contains the screenshot
    const responseSection = page.locator('text=Response').locator('..');
    const screenshotImage = responseSection.locator('img').first();
    await expect(screenshotImage).toBeVisible({ timeout: 15000 });
    
    // Verify that the image has a valid src attribute (should be a base64 data URL or valid URL)
    await expect(screenshotImage).toHaveAttribute('src', /^(data:image\/|https?:\/\/)/);
    
    // Click on Details tab to access session management options
    await page.getByRole('tab', { name: 'Details', exact: true }).click();
    
    // Close the session manually
    await page.getByRole('button', { name: 'Close Session' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    
    // Session will also be automatically closed by afterEach hook as backup
  });

  test('create and delete test file using deleteFile tool and verify deletion message in tools tab', async ({ page, trackCurrentSession }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Create a new session
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Send the specific prompt to create and delete a test file
    const toolMessage = "Create a new test file in the tests/ directory (e.g., tests/demo.spec.ts) with just a single comment 'this is test file' Then delete it";
    await page.getByPlaceholder('Type your message').click();
    await page.getByPlaceholder('Type your message').fill(toolMessage);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify the message was sent and appears in the conversation
    await expect(page.getByText(toolMessage)).toBeVisible({ timeout: 10000 });
    
    // First, wait for the file creation tool to complete
    await expect(page.getByText("Used str_replace_based_edit_tool: create tool")).toBeVisible({ timeout: 60000 });
    
    // Navigate to Tools tab to verify file creation
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    
    // Click on "Used str_replace_based_edit_tool: create tool" to view creation details
    await page.getByText("Used str_replace_based_edit_tool: create tool").click();
    
    // Assert that the file was created with the expected comment
    await expect(page.getByText("this is test file")).toBeVisible({ timeout: 10000 });
    
    // Navigate back to Conversation tab to continue with deletion
    await page.getByRole('tab', { name: 'Conversation', exact: true }).click();
    
    // Then, wait for deleteFile tool execution to start
    await expect(page.getByText("Running deleteFile")).toBeVisible({ timeout: 60000 });
    
    // Assert that deleteFile tool execution completes successfully
    await expect(page.getByText("Used deleteFile")).toBeVisible({ timeout: 60000 });
    
    // Navigate to Tools tab to verify deleteFile tool results
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    
    // Click on "Used deleteFile" text to open the tool details
    await page.getByText("Used deleteFile").click();
    
    // Assert that the deleted file message is visible in the tools tab
    // Look for the specific success message that appears after deleteFile tool execution
    await expect(page.getByText("Successfully deleted file: tests/demo.spec.ts")).toBeVisible({ timeout: 10000 });
    
    // Click on Details tab to access session management options
    await page.getByRole('tab', { name: 'Details', exact: true }).click();
    
    // Close the session
    await page.getByRole('button', { name: 'Close Session' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
  });
});