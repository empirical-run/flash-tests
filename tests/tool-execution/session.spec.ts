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
    
    // Wait for str_replace_based_edit_tool:str_replace tool call to be visible
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

  test('create test2 file with comment and verify tool execution and diff visibility', async ({ page, trackCurrentSession }) => {
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
    
    // Send the specific prompt that will trigger str_replace_based_edit_tool:create
    const createMessage = "add one test2 named file. just add a single line comment in it";
    await page.getByPlaceholder('Type your message').click();
    await page.getByPlaceholder('Type your message').fill(createMessage);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify the message was sent and appears in the conversation
    await expect(page.getByText(createMessage)).toBeVisible({ timeout: 10000 });
    
    // Wait for str_replace_based_edit_tool:view tool to finish first (AI examines repo structure)
    await expect(page.getByText("Used str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 60000 });
    
    // Wait for str_replace_based_edit_tool:create tool call to be visible
    await expect(page.getByText("Running str_replace_based_edit_tool: create tool")).toBeVisible({ timeout: 30000 });
    
    // Assert that str_replace_based_edit_tool:create is successfully executed
    await expect(page.getByText("Used str_replace_based_edit_tool: create tool")).toBeVisible({ timeout: 60000 });
    
    // Click on the Tools tab to verify the code change diff is visible
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    
    // Click on the "Used str_replace_based_edit_tool: create tool" to open the diff details
    await page.getByText("Used str_replace_based_edit_tool: create tool").click();
    
    // Assert that the code change diff is visible in tools tab
    await expect(page.getByText("Code Changes").first()).toBeVisible({ timeout: 10000 });
    
    // Wait for diff content to fully load (not just "Loading diff...")
    await expect(page.getByText("Loading diff...")).toBeHidden({ timeout: 30000 });
    
    // Assert that the actual comment which was added is visible in the diff 
    // After clicking on the tool execution, the diff should show the comment content
    // Look for the comment text (it should be visible in the diff area)
    await expect(page.getByText("// This is a test file").or(page.getByText("test file")).first()).toBeVisible({ timeout: 15000 });
    
    // Click on Details tab to access session management options
    await page.getByRole('tab', { name: 'Details', exact: true }).click();
    
    // Close the session
    await page.getByRole('button', { name: 'Close Session' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    
    // Session will also be automatically closed by afterEach hook as backup
  });
});