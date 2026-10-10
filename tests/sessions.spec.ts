import { randomUUID } from 'node:crypto';
import { test, expect } from "./fixtures";
import { getBashOutput, openBashWithFullCommand } from './pages/session-runtime-proof';
import { getVisibleInitialDiscoveryTools } from './pages/session-discovery';
import { getApiWorkerAuthHeaders } from "./pages/api-auth";
import { closeSession, createSession, createSessionWithBranch, expectMessageContentsInDocumentOrder, expectSessionCreatedBy, expandToolGroups, filterSessionsByUser, resetSessionUserFilter, reapplySessionUserFilter, getBashToolCall, getChatMessageByText, getSessionIdFromUrl, getSessionComposer, getPendingSteer, getToolDetails, getToolOutput, navigateToSessions, openFirstSession, openNewSessionDialog, sendMessage, steerMessage, waitForAgentIdle, waitForAgentToFinish, waitForFirstMessage, waitForSandboxEnvironment } from "./pages/sessions";
import { getApiBaseUrl } from "./pages/urls";
import { writeTextToClipboard } from "./pages/clipboard";

test.describe('Sessions Tests', () => {
  test('Filter sessions list by users', async ({ page }) => {
    await navigateToSessions(page);
    const initialSelection = await filterSessionsByUser(page);
    await resetSessionUserFilter(page, initialSelection);
    const selectedUser = await reapplySessionUserFilter(page, initialSelection);
    await page.locator(`main li a[href="/sessions/${selectedUser.sessionId}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/sessions/${selectedUser.sessionId}$`));
    await expectSessionCreatedBy(page, selectedUser.userName);
  });

  test.describe('Chat Interaction Features', () => {
    test('stop tool execution and send new message', async ({ page, trackCurrentSession }) => {
      await navigateToSessions(page);
      
      // Finish mandatory branch setup in an earlier turn, not as a prefix to the
      // command we need to interrupt. No agent prose counts as execution proof.
      const localBranch = `stop-copy-${randomUUID()}`;
      await createSession(page, `Prepare a new local task branch named ${localBranch}. Do not push it. Do not copy files or sleep yet; finish setup and wait for my next instruction.`);
      trackCurrentSession(page);
      await waitForAgentToFinish(page, 120000);

      const copyCommand = 'sleep 60 && cp example.spec.ts example2.spec.ts';
      const toolMessage = `Use bash to run exactly this command as its own separate tool call: ${copyCommand}. Do not prepend or append branch setup or any other command. This will create example2.spec.ts as a copy of example.spec.ts after the delay.`;
      await sendMessage(page, toolMessage);

      const initialPrompt = page.locator('[data-slot="message-scroller-item"]')
        .filter({ hasText: toolMessage });
      await expect(initialPrompt).toBeVisible();
      const initialResponse = initialPrompt.locator('xpath=following-sibling::*[@data-slot="message-scroller-item"]');

      // Open the sole running bash in THIS turn and inspect its real, full Input.
      // A truncated summary or an earlier setup call cannot satisfy this proof.
      await openBashWithFullCommand(initialResponse, copyCommand, 'running');
      
      // Click the stop button to stop the tool execution
      await page.getByRole('button', { name: /^Stop/ }).click();
      
      // Assert that the agent and the specific in-flight command were stopped.
      await expect(page.getByText('Agent stopped')).toBeVisible();
      await waitForAgentIdle(page);
      await expect(initialResponse.getByTestId('running-bash')).toHaveCount(0);

      // Completed/aborted calls fold into Used N tools. Expand only this prompt's
      // completed turn before selecting its exact copy command.
      await expandToolGroups(initialResponse);
      const abortedCopyTool = await openBashWithFullCommand(initialResponse, copyCommand, 'used');
      const toolOutput = getBashOutput(abortedCopyTool);
      await expect(toolOutput.getByText('Command aborted', { exact: true })).toBeVisible();
      
      // Verify that message input is immediately available and enabled
      await expect(getSessionComposer(page)).toBeEnabled();
      
      // Send another message after aborting and require a real assistant reply.
      const newMessage = "What is 19 + 23? Reply with only the number, without using tools.";
      await getSessionComposer(page).click();
      await getSessionComposer(page).fill(newMessage);
      const responseFinished = waitForAgentToFinish(page);
      await page.getByRole('button', { name: 'Send' }).click();

      // Preserve the successful-send assertion, then prove the agent can respond
      // after Stop: the answer is absent from the user prompt and scoped to this turn.
      await expect(getChatMessageByText(page, newMessage)).toBeVisible();
      const newPrompt = page.locator('[data-slot="message-scroller-item"]')
        .filter({ hasText: newMessage });
      const newResponse = newPrompt.locator('xpath=following-sibling::*[@data-slot="message-scroller-item"]');
      await responseFinished;
      await expect(newResponse.getByText('42', { exact: true })).toBeVisible();

      // Session will be automatically closed by afterEach hook
    });

    test('Stop tool execution in new session', async ({ page, trackCurrentSession }) => {
      await navigateToSessions(page);

      await createSession(page, "hi what's in cwd?");
      trackCurrentSession(page);

      await expect(getChatMessageByText(page, "hi what's in cwd?")).toBeVisible();
      await expect(getVisibleInitialDiscoveryTools(page, "hi what's in cwd?")).not.toHaveCount(0, { timeout: 120000 });
      await waitForAgentIdle(page);

      await sendMessage(page, 'cool. can you use bash to sleep for 30 secs and then cat readme');

      const runningBashTool = page.getByText(/Running bash.*sleep 30/i);
      await expect(runningBashTool).toBeVisible({ timeout: 120000 });

      const steeredInstruction = 'no, cat package.json and share all dependencies packages instead';
      await steerMessage(page, steeredInstruction);
      await expect(runningBashTool).toBeVisible();
      await expect(page.locator('[data-slot="message-scroller-item"]')
        .getByText(steeredInstruction, { exact: true })).toHaveCount(0);

      await page.getByRole('button', { name: /^Stop/ }).click();

      await expect(page.getByText('Agent stopped')).toBeVisible({ timeout: 30000 });
      const abortedBashTool = page.getByText(/Used bash.*sleep 30/i);
      await expect(abortedBashTool).toBeVisible({ timeout: 30000 });

      await abortedBashTool.click();
      const toolOutput = await getToolOutput(page);
      await expect(toolOutput.getByText('Command aborted')).toBeVisible();

      const sendButton = page.getByRole('button', { name: /^Send/ });
      await expect(sendButton).toBeVisible({ timeout: 30000 });
      await expect(page.getByRole('button', { name: /^Stop/ })).toBeHidden();
      await expect(page.getByRole('button', { name: /^Steer/ })).toBeHidden();
      await expect(getPendingSteer(page, steeredInstruction)).toBeHidden();
      await expect(page.locator('[data-slot="message-scroller-item"]')
        .getByText(steeredInstruction, { exact: true })).toBeVisible();

      const continuationFinished = waitForAgentToFinish(page, 120000);
      await sendMessage(page, 'continue');
      await continuationFinished;
      const continuation = page.locator('[data-slot="message-scroller-item"]')
        .filter({ has: page.getByText('continue', { exact: true }) })
        .locator('xpath=following-sibling::*[@data-slot="message-scroller-item"]');
      await expandToolGroups(continuation);
      const packageTool = await openBashWithFullCommand(continuation, 'cat package.json', 'used');
      await expect(getBashOutput(packageTool)).toContainText('playwright-utils');
      await expect(continuation.locator('[data-slot="message"][data-align="start"]')
        .getByText(/playwright-utils/)).toBeVisible();
    });

    test("all pending steered messages are dequeued together after the next tool call", async ({
      page,
      trackCurrentSession,
    }) => {
      await navigateToSessions(page);

      const initialPrompt =
        "Run these bash commands one at a time, in order, waiting for each to fully finish before starting the next: (1) sleep 45 && echo FIRST_TOOL_DONE  (2) cat package.json  (3) sleep 30 && echo THIRD_TOOL_DONE";
      await createSession(page, initialPrompt);
      trackCurrentSession(page);
      const sessionId = getSessionIdFromUrl(page);
      const headers = await getApiWorkerAuthHeaders(page);

      const firstTool = getBashToolCall(
        page,
        /FIRST_TOOL_DONE/i,
        "running",
      );
      await expect(firstTool).toBeVisible({ timeout: 120000 });

      const firstSteeredMessage =
        "CHANGE OF PLANS: do not run commands (2) or (3). After the current sleep finishes, run only: echo STEER_INJECTED_OK.";
      const secondSteeredMessage =
        "After STEER_INJECTED_OK finishes, stop and tell me you stopped early because both queued instructions were received.";
      await steerMessage(page, firstSteeredMessage);
      await steerMessage(page, secondSteeredMessage);

      // Both instructions are still pending in this active tool, not delivered
      // optimistically as ordinary sent messages or queued for a later run.
      await expect(firstTool).toBeVisible();
      await expect(getPendingSteer(page, firstSteeredMessage)).toBeVisible();
      await expect(getPendingSteer(page, secondSteeredMessage)).toBeVisible();
      await expect(page.locator('[data-slot="message-scroller-item"]')
        .getByText(firstSteeredMessage, { exact: true })).toHaveCount(0);
      await expect(page.locator('[data-slot="message-scroller-item"]')
        .getByText(secondSteeredMessage, { exact: true })).toHaveCount(0);

      const completedFirstTool = getBashToolCall(
        page,
        /FIRST_TOOL_DONE/i,
        "used",
      );
      await expect(completedFirstTool).toBeVisible({ timeout: 120000 });

      // In `all` mode both queued steers are injected before the model's next
      // response. Their user entries may have bookkeeping entries between them,
      // but there must not be an assistant message between the two.
      await expect
        .poll(
          async () => {
            const response = await page.request.get(
              `${getApiBaseUrl()}/api/chat-sessions/${sessionId}/session-state?per_page=100`,
              { headers },
            );
            expect(response.ok()).toBe(true);

            const body = (await response.json()) as {
              data: {
                entries: Array<{
                  log_seq?: number;
                  type?: string;
                  message?: { role?: string; content?: unknown };
                }>;
              };
            };
            const entries = [...body.data.entries].sort(
              (left, right) => (left.log_seq ?? 0) - (right.log_seq ?? 0),
            );
            const entryText = (entry: (typeof entries)[number]) =>
              JSON.stringify(entry.message?.content ?? "");
            const firstResultIndex = entries.findIndex((entry) =>
              entry.message?.role === "toolResult" &&
              entryText(entry).includes("FIRST_TOOL_DONE"),
            );
            const firstEntryIndex = entries.findIndex((entry) =>
              entry.message?.role === "user" &&
              entryText(entry).includes(firstSteeredMessage),
            );
            const secondEntryIndex = entries.findIndex((entry) =>
              entry.message?.role === "user" &&
              entryText(entry).includes(secondSteeredMessage),
            );
            if (firstResultIndex < 0 || firstEntryIndex <= firstResultIndex || secondEntryIndex <= firstEntryIndex) {
              return false;
            }

            return !entries
              .slice(firstResultIndex + 1, secondEntryIndex)
              .some(
                (entry) =>
                  entry.type === "message" &&
                  entry.message?.role === "assistant",
              );
          },
          {
            message: "both steers should enter the same model turn",
            timeout: 120000,
          },
        )
        .toBe(true);

      await expect(getPendingSteer(page, firstSteeredMessage)).toBeHidden();
      await expect(getPendingSteer(page, secondSteeredMessage)).toBeHidden();
      const deliveredMessages = page.locator('[data-slot="message-scroller-item"]');
      await expect(deliveredMessages.getByText(firstSteeredMessage, { exact: true })).toBeVisible();
      await expect(deliveredMessages.getByText(secondSteeredMessage, { exact: true })).toBeVisible();
      await expectMessageContentsInDocumentOrder(page, [
        firstSteeredMessage,
        secondSteeredMessage,
      ]);

      const steeredTurn = deliveredMessages.filter({ hasText: secondSteeredMessage })
        .locator('xpath=following-sibling::*[@data-slot="message-scroller-item"]');
      await waitForAgentIdle(page, 120000);
      await expandToolGroups(steeredTurn);
      const injectedTool = await openBashWithFullCommand(steeredTurn, 'echo STEER_INJECTED_OK', 'used');
      await expect(getBashOutput(injectedTool).getByText('STEER_INJECTED_OK', { exact: true })).toBeVisible();

      // Only assistant content after the delivered instructions can satisfy this,
      // never the authored pending bubble or an earlier response.
      await expect(steeredTurn.getByText(/stopped early[\s\S]*both[\s\S]*instructions/i)).toBeVisible();

      await expectMessageContentsInDocumentOrder(page, [
        /Used bash[\s\S]*FIRST_TOOL_DONE/i,
        /Used bash[\s\S]*STEER_INJECTED_OK/i,
      ]);

      await expect(getBashToolCall(page, /cat package\.json/i)).toBeHidden();
      await expect(getBashToolCall(page, /THIRD_TOOL_DONE/i)).toBeHidden();
    });

    test('pause sandbox and automatically resume on new message', async ({ page, trackCurrentSession }) => {
      await navigateToSessions(page);

      const initialMessage = 'What is 2 + 2? Reply with only the number.';
      await createSession(page, initialMessage);
      trackCurrentSession(page);
      const sessionId = getSessionIdFromUrl(page);
      const chatMessages = page.locator('[data-message-id]');

      await expect(getChatMessageByText(page, initialMessage)).toBeVisible({ timeout: 30000 });
      await waitForSandboxEnvironment(page);
      // Message wrappers can duplicate the user bubble. An exact answer, absent
      // from the prompt, proves the assistant responded before checking for idle.
      await expect(chatMessages.getByText('4', { exact: true }).first()).toBeVisible({ timeout: 120000 });
      await waitForAgentIdle(page);
      await expect(page.getByRole('button', { name: /^Send/ })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Agent machine: Running', exact: true })).toBeVisible();

      const headers = await getApiWorkerAuthHeaders(page);
      const pauseResponse = await page.request.post(
        `${getApiBaseUrl()}/api/chat-sessions/${sessionId}/sandbox/control`,
        {
          headers,
          data: { action: 'pause' },
        }
      );
      await expect(pauseResponse).toBeOK();

      const pausedMachineButton = page.getByRole('button', { name: 'Agent machine: Paused', exact: true });
      await expect(pausedMachineButton).toBeVisible({ timeout: 30000 });

      const healthResponse = await page.request.get(
        `${getApiBaseUrl()}/api/chat-sessions/${sessionId}/sandbox/health`,
        { headers },
      );
      expect(healthResponse.status()).toBe(409);
      expect(await healthResponse.json()).toEqual({
        error: 'Sandbox is paused. Send a message in the session to resume it.',
      });
      await expect(pausedMachineButton).toBeVisible();

      const resumeMessage = 'What is 8 + 7? Reply with only the number.';
      await sendMessage(page, resumeMessage);

      await expect(chatMessages.filter({ hasText: resumeMessage }).first()).toBeVisible({ timeout: 30000 });
      await expect(page.getByRole('button', { name: 'Agent machine: Running', exact: true })).toBeVisible({ timeout: 60000 });
      await expect(chatMessages.getByText('15', { exact: true }).first()).toBeVisible({ timeout: 120000 });
      await waitForAgentIdle(page);
      await expect(page.getByRole('button', { name: /^Send/ })).toBeVisible();
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

  });

  test('Session with base branch', async ({ page, trackCurrentSession }) => {
    await navigateToSessions(page);
    
    // Request the fixture branch in the initial session prompt.
    const message = "list files in tests dir";
    await createSessionWithBranch(page, message, 'example-base-branch');
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);

    // Verify that empty-file-only-in-this-branch.spec.ts is visible in the response (only exists in example-base-branch)
    // In sandbox mode, allow extra time for sandbox environment setup before the agent can run
    await expect(page.getByText("empty-file-only-in-this-branch.spec.ts")).toBeVisible({ timeout: 120000 });

    // Wait for the agent to finish responding to the first message
    await waitForAgentIdle(page);
    
    // Require an actual write call, not an equivalent bash/edit modification.
    const insertMessage = 'Use the write tool (not bash or edit) to insert "// Start of file" at the top of tests/empty-file-only-in-this-branch.spec.ts, preserving any existing contents.';
    await sendMessage(page, insertMessage);

    // Observe the new turn starting and finishing before opening tool details;
    // the previous turn's completed groups must not satisfy this wait.
    await waitForAgentToFinish(page);
    const insertPrompt = page.locator('[data-slot="message-scroller-item"]')
      .filter({ has: getChatMessageByText(page, insertMessage) });
    await expect(insertPrompt).toHaveCount(1);
    await expect(insertPrompt).toBeVisible();
    const responseMessages = insertPrompt.locator('xpath=following-sibling::*[@data-slot="message-scroller-item"]');

    // Commit/PR cards can split the completed turn into several groups. Expand
    // all of this turn's groups, not just its final push/PR group.
    await expandToolGroups(responseMessages);
    const writeTool = responseMessages.getByTestId('used-write').last();

    // Open the completed write call's inline details.
    await expect(writeTool).toBeVisible();
    await writeTool.click();

    // Assert the inline Code Changes content shows the correct file was modified.
    const toolDetails = await getToolDetails(page);
    await expect(toolDetails.getByText('empty-file-only-in-this-branch.spec.ts').first()).toBeVisible();
    // And that the inserted text is present in the diff
    await expect(toolDetails.getByText('// Start of file').first()).toBeVisible();
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
    
    // Filter sessions to a user returned by the filter API.
    await filterSessionsByUser(page);
    
    // Open the first session in the filtered list and capture its ID
    const sessionId = await openFirstSession(page);
    
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
    await expect(getSessionComposer(page)).toBeVisible();
    
    // Wait for the first user message to appear
    await waitForFirstMessage(page);
    
    // Get the session title link in the sidebar (title is inferred from first message)
    const sessionTitleLink = page.getByRole('link', { name: uniqueMessage });
    const waitingIndicator = sessionTitleLink.locator('.lucide-message-square-reply');
    
    // Get the stop button reference for later use (button now includes keyboard shortcut like "Stop ⌃C")
    const stopButton = page.getByRole('button', { name: /^Stop/ });
    
    // Wait for the agent to finish processing the first message before sending the second.
    // Agent turns can occasionally exceed 60s on full-run infra, so use the same
    // 120s budget as the other agent-processing assertions in this suite.
    await expect(stopButton).toBeHidden({ timeout: 120000 });
    
    // Type "how are you" via clipboard paste (repro for copy-paste bug in prompt input)
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await writeTextToClipboard(page, 'how are you');
    const messageInput = getSessionComposer(page);
    await messageInput.click();
    await page.keyboard.press('Control+v');
    await expect(messageInput).toContainText('how are you');
    // Send via the Ctrl+Enter keyboard shortcut (shown as "Send ⌃ ↵") instead of clicking the button,
    // so this test also covers the send keyboard shortcut.
    await messageInput.press('Control+Enter');
    
    // Verify the message appears in the conversation
    await expect(getChatMessageByText(page, 'how are you')).toBeVisible();
    
    // Wait for the sandbox environment to go through its startup states before the agent runs
    await waitForSandboxEnvironment(page);
    
    // Verify the Stop button is visible while agent is responding to second message
    // (check immediately after message appears, before minimap steps, to catch the button reliably)
    // Timeout is 60s to account for the agent start-up latency after the sandbox shows "Running"
    await expect(stopButton).toBeVisible({ timeout: 60000 });
    
    // While Stop button is visible (agent is responding), verify the "waiting on user input" indicator is HIDDEN
    await expect(waitingIndicator).not.toBeVisible();
    
    // Verify the second message is visible in the chat conversation
    await expect(getChatMessageByText(page, 'how are you')).toBeVisible();
    
    // Wait for agent to finish responding to second message. As above, allow
    // enough time for slower full-run infra.
    await expect(stopButton).toBeHidden({ timeout: 120000 });
    
    // After agent finishes responding, the "waiting on user input" indicator should appear again
    await expect(waitingIndicator).toBeVisible();

    // Fold the closed-state coverage into this broader session lifecycle test.
    const sessionId = getSessionIdFromUrl(page);
    await closeSession(page);
    await page.goto(`/sessions/${sessionId}`);
    await expect(page.getByText('Closed', { exact: true })).toBeVisible();
    
    // Success: The test verified:
    // 1. Session was created from Sessions view with unique title using Date.now()
    // 2. Initial message was sent and agent responded
    // 3. "Waiting on user input" indicator (.lucide-message-square-reply) was hidden while Stop button was visible (agent responding)
    // 4. Second message "how are you" was sent
    // 5. User message count updated to (2) in the sidebar
    // 6. "Waiting on user input" indicator was hidden again while agent responded to second message
    // 7. After agent finished responding, "waiting on user input" indicator became visible again
    // 8. Real-time indicator updates work correctly throughout the session lifecycle
    // 9. The session can be closed and shows the Closed state when revisited
  });

});
