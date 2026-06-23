import { test, expect } from "./fixtures";
import { getApiWorkerAuthHeaders } from "./pages/api-auth";
import { closeSession, createSession, createSessionWithBranch, expandToolOutput, expectMessageContentsInDocumentOrder, expectSessionCreatedBy, filterSessionsByUser, getSessionIdFromUrl, navigateToSessions, openNewSessionDialog, openSessionInfoPanel, sendMessage, steerMessage, waitForFirstMessage, waitForSandboxEnvironment } from "./pages/sessions";
import { getApiBaseUrl } from "./pages/urls";

test.describe('Sessions Tests', () => {
  test('Filter sessions list by users', async ({ page, trackCurrentSession }) => {
    await navigateToSessions(page);
    
    // Filter sessions to show only Arjun Attam's sessions
    await filterSessionsByUser(page, 'Arjun Attam');
    
    // Verify filtered sessions are displayed in the sidebar
    await expect(page.locator('a[href*="/sessions/"]').first()).toBeVisible({ timeout: 15000 });
    
    // Click on the first session in the filtered list to open it
    await page.locator('a[href*="/sessions/"]').first().click();
    
    // Wait for session to load (question mark icon replaces old Details tab)
    await expect(page.getByRole('button', { name: 'Show session info' })).toBeVisible();
    
    // Verify the creator matches the filter (Arjun Attam). The header shows the creator
    // as an avatar; hovering over it reveals a tooltip with the creator's name.
    await expectSessionCreatedBy(page, 'Arjun Attam');
  });

  test('Close session and verify session state', async ({ page, trackCurrentSession }) => {
    await navigateToSessions(page);
    
    // Create a new session with a simple prompt that gets a quick agent response
    const uniqueId = `test-session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const message = `Say hello - ${uniqueId}`;
    await createSession(page, message);
    
    // Wait for the session chat page to load completely by waiting for message to appear
    await waitForFirstMessage(page);
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);

    // Verify sandbox environment status pill states above the input
    await waitForSandboxEnvironment(page);

    // Wait for the agent to finish responding
    await expect(page.getByRole('button', { name: /^Stop/ })).toBeHidden({ timeout: 60000 });
    
    // Get the session ID from the current URL before closing
    const sessionId = getSessionIdFromUrl(page);
    
    // Close the session via the dropdown menu next to "Review"
    await closeSession(page);
    
    // Navigate to sessions list page (no longer redirects automatically)
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    await expect(page).toHaveURL(/sessions$/);

    // Navigate back to the specific session page via URL to check closed status
    await page.goto(`/sessions/${sessionId}`);
    
    // Verify session is closed by checking for the Closed status badge in the header
    await expect(page.getByText('Closed', { exact: true })).toBeVisible();
  });

  test.describe('Chat Interaction Features', () => {
    test('stop tool execution and send new message', async ({ page, trackCurrentSession }) => {
      await navigateToSessions(page);
      
      // Create a new session with tool execution prompt
      const toolMessage = "create a file called example2.spec.ts which is a copy of example.spec.ts";
      await createSession(page, toolMessage);
      
      // Track the session for automatic cleanup
      trackCurrentSession(page);
      
      // Wait for the agent to start using tools (sandbox UI shows "Used <tool>" labels)
      await expect(page.getByText(/Used (read|bash|write|shell) .*/)).toBeVisible({ timeout: 120000 });
      
      // Click the stop button to stop the tool execution
      await page.getByRole('button', { name: /^Stop/ }).click();
      
      // Assert that the agent was stopped
      await expect(page.getByText('Agent stopped')).toBeVisible();
      
      // Verify that message input is immediately available and enabled
      await expect(page.getByRole('textbox', { name: 'Type your message here...' })).toBeEnabled();
      
      // Send a new message immediately after stopping
      const newMessage = "What is the weather like today?";
      await page.getByRole('textbox', { name: 'Type your message here...' }).click();
      await page.getByRole('textbox', { name: 'Type your message here...' }).fill(newMessage);
      await page.getByRole('button', { name: 'Send' }).click();
      
      // Verify the new message appears in the conversation (this confirms user can send messages after stopping)
      // Use data-message-id attribute to uniquely identify the message in the chat conversation
      await expect(page.locator('[data-message-id]').filter({ hasText: newMessage })).toBeVisible();
      
      // Session will be automatically closed by afterEach hook
    });

    test('Stop tool execution in new session', async ({ page, trackCurrentSession }) => {
      await navigateToSessions(page);

      await createSession(page, "hi what's in cwd?");
      trackCurrentSession(page);

      await expect(page.locator('[data-message-id]').filter({ hasText: "hi what's in cwd?" })).toBeVisible();
      await expect(page.getByText(/Used (ls|shell|bash) tool/i)).toBeVisible({ timeout: 120000 });
      await expect(page.getByRole('button', { name: /^Stop/ })).toBeHidden({ timeout: 60000 });

      await sendMessage(page, 'cool. can you use bash to sleep for 30 secs and then cat readme');

      const runningBashTool = page.getByText(/Running bash.*sleep 30/i).first();
      await expect(runningBashTool).toBeVisible({ timeout: 120000 });

      await steerMessage(page, 'no, cat package.json instead');

      await page.getByRole('button', { name: /^Stop/ }).click();

      await expect(page.getByText('Agent stopped')).toBeVisible({ timeout: 30000 });
      const abortedBashTool = page.getByText(/Used bash.*sleep 30/i).first();
      await expect(abortedBashTool).toBeVisible({ timeout: 30000 });

      await abortedBashTool.click();
      const toolOutput = await expandToolOutput(page);
      await expect(toolOutput.getByText('Command aborted')).toBeVisible();

      const sendButton = page.getByRole('button', { name: /^Send/ });
      await expect(sendButton).toBeVisible({ timeout: 30000 });
      await expect(page.getByRole('button', { name: /^Stop/ })).toBeHidden();
      await expect(page.getByRole('button', { name: /^Steer/ })).toBeHidden();
      await expect(page.getByText('Steered messages', { exact: true })).toBeHidden();

      await sendMessage(page, 'continue');
      await expect(page.getByText('playwright-utils')).toBeVisible({ timeout: 120000 });
    });

    test('steered message is dequeued after the next tool call while agent is still running', async ({ page, trackCurrentSession }) => {
      await navigateToSessions(page);

      const initialPrompt = 'Run these bash commands one at a time, in order, waiting for each to fully finish before starting the next: (1) sleep 45 && echo FIRST_TOOL_DONE  (2) cat package.json  (3) sleep 30 && echo THIRD_TOOL_DONE';
      await createSession(page, initialPrompt);
      trackCurrentSession(page);

      const firstTool = page.getByText(/Running bash.*FIRST_TOOL_DONE/i).first();
      await expect(firstTool).toBeVisible({ timeout: 120000 });

      const steeredMessage = 'CHANGE OF PLANS: do not run commands (2) or (3). After the current sleep finishes, run only: echo STEER_INJECTED_OK -- then stop and tell me you stopped early because I steered you.';
      await steerMessage(page, steeredMessage);

      const completedFirstTool = page.getByText(/Used bash.*FIRST_TOOL_DONE/i).first();
      await expect(completedFirstTool).toBeVisible({ timeout: 120000 });

      const dequeuedSteeredMessage = page.locator('[data-message-id]').filter({ hasText: steeredMessage }).first();
      await expect(dequeuedSteeredMessage).toBeVisible({ timeout: 30000 });

      const injectedTool = page.getByText(/Used bash.*STEER_INJECTED_OK/i).first();
      await expect(injectedTool).toBeVisible({ timeout: 60000 });
      await expectMessageContentsInDocumentOrder(page, [
        /Used bash[\s\S]*FIRST_TOOL_DONE/i,
        steeredMessage,
        /Used bash[\s\S]*STEER_INJECTED_OK/i,
      ]);

      await expect(page.getByText(/(Running|Used) bash[\s\S]*cat package\.json/i)).toBeHidden();
      await expect(page.getByText(/(Running|Used) bash[\s\S]*THIRD_TOOL_DONE/i)).toBeHidden();
    });

    test('pause sandbox and automatically resume on new message', async ({ page, trackCurrentSession }) => {
      await navigateToSessions(page);

      await createSession(page, 'hi');
      trackCurrentSession(page);
      const sessionId = getSessionIdFromUrl(page);
      const chatMessages = page.locator('[data-message-id]');

      await expect(chatMessages.filter({ hasText: 'hi' }).first()).toBeVisible({ timeout: 30000 });
      await waitForSandboxEnvironment(page);
      await expect(chatMessages.nth(1)).toBeVisible({ timeout: 60000 });
      await expect(page.getByRole('button', { name: /^Stop/ })).toBeHidden({ timeout: 60000 });
      await expect(page.getByRole('button', { name: 'Running', exact: true })).toBeVisible();

      const headers = await getApiWorkerAuthHeaders(page);
      const pauseResponse = await page.request.post(
        `${getApiBaseUrl()}/api/chat-sessions/${sessionId}/sandbox/control`,
        {
          headers,
          data: { action: 'pause' },
        }
      );
      await expect(pauseResponse).toBeOK();

      await expect(page.getByRole('button', { name: 'Paused', exact: true })).toBeVisible({ timeout: 30000 });

      const messageCountAfterPause = await chatMessages.count();
      const resumeMessage = 'hi again';
      await sendMessage(page, resumeMessage);

      await expect(chatMessages.filter({ hasText: resumeMessage }).first()).toBeVisible({ timeout: 30000 });
      await expect(page.getByRole('button', { name: 'Running', exact: true })).toBeVisible({ timeout: 60000 });
      await expect.poll(async () => chatMessages.count(), { timeout: 120000 }).toBeGreaterThan(messageCountAfterPause + 1);
      await expect(page.getByRole('button', { name: /^Stop/ })).toBeHidden({ timeout: 60000 });
    });

    test.skip('edit message updates assistant response', async ({ page, trackCurrentSession }) => { // skipped: edit message button not supported in sandbox mode
      const initialPrompt = "just answer this math question: what is 2 + 2?";
      const updatedPrompt = "just answer this math question: what is 8 + 7?";

      await navigateToSessions(page);

      // Create a new session with the initial prompt
      await createSession(page, initialPrompt);

      // Track the session for automatic cleanup
      trackCurrentSession(page);

      const chatBubbles = page.locator('[data-message-id]');
      const stopButton = page.getByRole('button', { name: 'Stop' });

      // Wait for the first user message bubble to appear
      await expect(chatBubbles.first()).toBeVisible({ timeout: 30000 });

      // Wait for the assistant to finish responding to the initial prompt before editing
      if (await stopButton.isVisible()) {
        await expect(stopButton).toBeHidden({ timeout: 60000 });
      }

      await expect(
        chatBubbles.filter({ hasText: /\b4\b|equals 4|= 4/ }).first()
      ).toBeVisible({ timeout: 30000 });

      const userMessageBubble = chatBubbles.filter({ hasText: initialPrompt }).first();
      await userMessageBubble.hover();
      await userMessageBubble.getByRole('button', { name: 'Edit message' }).click();

      const editTextbox = page.getByRole('textbox', { name: 'Edit your message...' });
      await editTextbox.fill(updatedPrompt);
      await page.getByRole('button', { name: 'Save Changes' }).click();

      await expect(chatBubbles.filter({ hasText: updatedPrompt }).first()).toBeVisible({ timeout: 20000 });

      // Assert the assistant responds to the updated message with the correct answer (15)
      await expect(
        chatBubbles.filter({ hasText: /15|equals 15|= 15/ }).first()
      ).toBeVisible({ timeout: 60000 });

      // Click on "(edited)" to view edit history
      const editedUserMessageBubble = chatBubbles.filter({ hasText: updatedPrompt }).first();
      await editedUserMessageBubble.getByText('(edited)').click();

      // Assert that edit history modal is visible
      const editHistoryModal = page.getByLabel('Edit History');
      await expect(editHistoryModal).toBeVisible();
      
      // Assert both old and new messages are visible in the edit history modal
      await expect(editHistoryModal.getByText(initialPrompt)).toBeVisible();
      await expect(editHistoryModal.getByText(updatedPrompt)).toBeVisible();
    });








    test.describe('Keyboard Shortcuts', () => {
      test('simple keyboard shortcut test - basic message only', async ({ page, trackCurrentSession }) => {
        await navigateToSessions(page);
        
        // Create a new session with simple math prompt
        const message = "Simple keyboard test - what is 2 + 2?";
        await createSession(page, message);
        
        // Track the session for automatic cleanup
        trackCurrentSession(page);
        
        // Wait for the user message bubble to appear
        await waitForFirstMessage(page);

        // Assert the message is attributed to the user in the session header.
        // The header shows the creator as an avatar; hovering over it reveals a tooltip
        // with the creator's identity (email when no display name is set).
        const userEmail = process.env.AUTOMATED_USER_EMAIL || 'automation-test@example.com';
        await expectSessionCreatedBy(page, userEmail);

        // Assert the user message bubble shows the sender avatar next to the chat message bubble.
        // The UI shows a user icon avatar (span with data-state for tooltip) instead of a text label.
        const userMessageBubble = page.locator('[data-message-id]').filter({ hasText: message }).first();
        const senderLabel = userMessageBubble.locator('span[data-state]').first();
        await expect(senderLabel).toBeVisible();

        // Hover over the sender avatar to reveal the attribution tooltip showing the user's full identity
        await senderLabel.hover();
        await expect(page.getByRole('tooltip', { name: userEmail })).toBeVisible();

        // Verify assistant responds
        await expect(page.locator('text=2 + 2').or(page.locator('text=equals 4')).or(page.locator('text=The answer is 4')).first()).toBeVisible({ timeout: 30000 });
      });
    });




  });

  test('Session with base branch', async ({ page, trackCurrentSession }) => {
    await navigateToSessions(page);
    
    // Create a new session with advanced settings and a custom base branch
    const message = "list files in tests dir";
    await createSessionWithBranch(page, message, 'example-base-branch');
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);

    // Verify that empty-file-only-in-this-branch.spec.ts is visible in the response (only exists in example-base-branch)
    // In sandbox mode, allow extra time for sandbox environment setup before the agent can run
    await expect(page.getByText("empty-file-only-in-this-branch.spec.ts")).toBeVisible({ timeout: 120000 });

    // Wait for the agent to finish responding to the first message
    await expect(page.getByRole('button', { name: /^Stop/ })).toBeHidden({ timeout: 60000 });
    
    // Send a message to insert a line at the top of empty-file-only-in-this-branch.spec.ts
    const insertMessage = 'insert "// Start of file" at the top of empty-file-only-in-this-branch.spec.ts';
    await sendMessage(page, insertMessage);
    
    // In sandbox mode, tools show as "Used <tool>" labels (no filename in the label).
    // Wait for the write tool to complete — this covers the full insert operation
    // (the agent reads the file first, then writes it with the inserted content)
    await expect(page.getByText('Used write tool')).toBeVisible({ timeout: 120000 });

    // After the insert commits the change, open session info to verify the base branch is correctly set
    await openSessionInfoPanel(page);
    await expect(page.getByText("→ example-base-branch")).toBeVisible({ timeout: 30000 });

    // Click on the write tool bubble to open the Code Changes panel
    await page.getByText('Used write tool').last().click();

    // Assert the Code Changes panel shows the correct file was modified.
    // The tool panel container (div.space-y-4) holds Tool Input, Tool Output, and Code Changes as siblings,
    // so we go up two levels from the Tool Input button to reach this common ancestor.
    const toolPanel = page.getByRole('button', { name: 'Tool Input' }).locator('xpath=../..');
    await expect(toolPanel.getByText('empty-file-only-in-this-branch.spec.ts').first()).toBeVisible();
    // And that the inserted text is present in the diff
    await expect(toolPanel.getByText('// Start of file').first()).toBeVisible();
  });

  test('Authorization - modified project_id should not return chat sessions', async ({ page }) => {
    let capturedProjectId: number | null = null;
    let modifiedResponseData: any = null;

    // Set up route interception to capture the original project_id from the browser's request
    await page.route('**/api/chat-sessions*', async (route, request) => {
      const url = new URL(request.url());
      const projectId = url.searchParams.get('project_id');
      
      // Capture the project_id from the first request
      if (capturedProjectId === null && projectId) {
        capturedProjectId = parseInt(projectId);
      }
      
      // Let the request go through normally
      await route.continue();
    });

    // Navigate to Sessions page - this will trigger the intercepted API call
    await navigateToSessions(page);
    
    // Assert that project_id is the lorem-ipsum project in the original request
    expect(capturedProjectId).toBe(Number(process.env.LOREM_IPSUM_PROJECT_ID));
    
    // Make second request with modified project_id (unauthorized)
    const secondResponse = await page.request.get('/api/chat-sessions', {
      params: {
        project_id: '1', // Modified to unauthorized project
      },
    });
    
    const secondData = await secondResponse.json();
    modifiedResponseData = secondData;
    
    // Assert that no chat sessions are returned when project_id is modified to 1 (unauthorized)
    // This test is expected to FAIL because of the authorization bug - sessions ARE being returned
    expect(modifiedResponseData.data || []).toEqual([]);
  });

  test.skip('Subscribe to session and verify in Subscribed sessions list', async ({ page, trackCurrentSession }) => {
    await navigateToSessions(page);
    
    // Filter sessions to show only Arjun Attam's sessions
    await filterSessionsByUser(page, 'Arjun Attam');
    
    // Wait for filtered sessions to be displayed in the sidebar
    await expect(page.locator('a[href*="/sessions/"]').first()).toBeVisible({ timeout: 15000 });
    
    // Get the first session link from the sidebar list and extract session ID
    const firstSessionLink = page.locator('a[href*="/sessions/"]').first();
    const sessionHref = await firstSessionLink.getAttribute('href');
    const sessionId = sessionHref?.split('/').pop();
    
    // Click on the first session to open it
    await firstSessionLink.click();
    
    // Wait for session to load, then open session info panel (question mark icon)
    await openSessionInfoPanel(page);
    
    // Wait for either Subscribe or Unsubscribe button to be visible first
    const subscribeButton = page.getByRole('button', { name: 'Subscribe', exact: true });
    const unsubscribeButton = page.getByRole('button', { name: 'Unsubscribe', exact: true });
    await expect(subscribeButton.or(unsubscribeButton)).toBeVisible();

    // Check if already subscribed and unsubscribe to ensure clean state
    if (await unsubscribeButton.isVisible()) {
      await unsubscribeButton.click();
      await expect(subscribeButton).toBeVisible();
    }
    
    // Click on the Subscribe button in the Details panel
    await subscribeButton.click();
    
    // Verify that the button changes to "Unsubscribe"
    await expect(unsubscribeButton).toBeVisible();
    
    // Navigate back to project Sessions page using direct URL to preserve context
    await page.goto('/sessions');
    
    // Wait for sessions page to load
    await expect(page).toHaveURL(/sessions/);
    
    // Verify the subscribed session appears in the list with the bell icon (.lucide-bell)
    // The bell icon indicates the session is subscribed
    const sessionLinkWithBell = page.locator(`a[href*="/sessions/${sessionId}"]`).filter({ has: page.locator('.lucide-bell') });
    await expect(sessionLinkWithBell).toBeVisible();
    
    // Click on the subscribed session
    await sessionLinkWithBell.click();
    
    // Wait for session to load, then open session info panel (question mark icon)
    await openSessionInfoPanel(page);
    
    // Click on the Unsubscribe button to clean up the state
    await unsubscribeButton.click();
    
    // Verify that the button changes back to "Subscribe"
    await expect(subscribeButton).toBeVisible();
  });

  test('Verify session creation and basic chat interaction from Sessions', async ({ page, trackCurrentSession }) => {
    await navigateToSessions(page);
    
    // Click the + icon button next to the filter icon to open the create session dialog
    await openNewSessionDialog(page);
    
    const uniqueMessage = `hello ${Date.now()}`;
    await page.getByRole('textbox', { name: 'Enter an initial prompt or' }).fill(uniqueMessage);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session
    await expect(page).toHaveURL(/sessions\/\d+/);
    test.info().annotations.push({ type: 'Session URL', description: page.url() });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Wait for the session to actually load by checking that the chat interface is ready
    // (wait for the message input area to be visible instead of waiting for messages)
    await expect(page.getByRole('textbox', { name: 'Type your message here...' })).toBeVisible();
    
    // Wait for the first user message to appear
    await waitForFirstMessage(page);
    
    // Get the session title link in the sidebar (title is inferred from first message)
    const sessionTitleLink = page.getByRole('link', { name: uniqueMessage });
    const waitingIndicator = sessionTitleLink.locator('.lucide-message-square-reply');
    
    // Get the stop button reference for later use (button now includes keyboard shortcut like "Stop ⌃C")
    const stopButton = page.getByRole('button', { name: /^Stop/ });
    
    // Wait for the agent to finish processing the first message before sending the second
    await expect(stopButton).toBeHidden({ timeout: 60000 });
    
    // Type "how are you" via clipboard paste (repro for copy-paste bug in prompt input)
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.evaluate(async () => { await navigator.clipboard.writeText('how are you'); });
    const messageInput = page.getByRole('textbox', { name: 'Type your message here...' });
    await messageInput.click();
    await page.keyboard.press('Control+v');
    await expect(messageInput).toContainText('how are you');
    await page.getByRole('button', { name: 'Send ⌃ ↵' }).click(); // Full button text to avoid strict mode violation with sidebar buttons
    
    // Verify the message appears in the conversation
    await expect(page.locator('[data-message-id]').filter({ hasText: 'how are you' }).first()).toBeVisible();
    
    // Wait for the sandbox environment to go through its startup states before the agent runs
    await waitForSandboxEnvironment(page);
    
    // Verify the Stop button is visible while agent is responding to second message
    // (check immediately after message appears, before minimap steps, to catch the button reliably)
    // Timeout is 60s to account for the agent start-up latency after the sandbox shows "Running"
    await expect(stopButton).toBeVisible({ timeout: 60000 });
    
    // While Stop button is visible (agent is responding), verify the "waiting on user input" indicator is HIDDEN
    await expect(waitingIndicator).not.toBeVisible();
    
    // Verify the second message is visible in the chat conversation
    await expect(page.locator('[data-message-id]').filter({ hasText: 'how are you' }).first()).toBeVisible();
    
    // Wait for agent to finish responding to second message
    await expect(stopButton).toBeHidden({ timeout: 60000 });
    
    // After agent finishes responding, the "waiting on user input" indicator should appear again
    await expect(waitingIndicator).toBeVisible();
    
    // Session will be automatically closed by afterEach hook
    
    // Success: The test verified:
    // 1. Session was created from Sessions view with unique title using Date.now()
    // 2. Initial message was sent and agent responded
    // 3. "Waiting on user input" indicator (.lucide-message-square-reply) was hidden while Stop button was visible (agent responding)
    // 4. Second message "how are you" was sent
    // 5. User message count updated to (2) in the sidebar
    // 6. "Waiting on user input" indicator was hidden again while agent responded to second message
    // 7. After agent finished responding, "waiting on user input" indicator became visible again
    // 8. Real-time indicator updates work correctly throughout the session lifecycle
  });

});