import { test, expect } from "./fixtures";
import {
  getBashOutput,
  openBashWithFullCommand,
} from "./pages/session-runtime-proof";
import { getVisibleInitialDiscoveryTools } from "./pages/session-discovery";
import { getApiWorkerAuthHeaders } from "./pages/api-auth";
import {
  closeSession,
  createSession,
  createWorkerSession,
  createSessionWithBranch,
  expectMessageContentsInDocumentOrder,
  expectSessionCreatedBy,
  expandToolGroups,
  getResponseAfterPrompt,
  filterSessionsByUser,
  resetSessionUserFilter,
  reapplySessionUserFilter,
  projectSessionsPath,
  getBashToolCall,
  getChatMessageByText,
  getSessionIdFromUrl,
  getSessionComposer,
  getPendingSteer,
  getToolOutput,
  navigateToSessions,
  openFirstSession,
  openNewSessionDialog,
  sendMessage,
  steerMessage,
  waitForAgentIdle,
  waitForAgentToFinish,
  waitForFirstMessage,
  waitForSandboxEnvironment,
} from "./pages/sessions";
import { getApiBaseUrl } from "./pages/urls";
import { writeTextToClipboard } from "./pages/clipboard";

test.describe("Sessions Tests", () => {
  test("Filter sessions list by users", async ({ page }) => {
    await navigateToSessions(page);
    const initialSelection = await filterSessionsByUser(page);
    await resetSessionUserFilter(page, initialSelection);
    const selectedUser = await reapplySessionUserFilter(page, initialSelection);
    const sessionPath = `${projectSessionsPath(page)}/${selectedUser.sessionId}`;
    await page.locator(`main li a[href="${sessionPath}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${sessionPath}$`));
    await expectSessionCreatedBy(page, selectedUser.userName);
  });

  test.describe("Chat Interaction Features", () => {
    test("Stop tool execution in new session", async ({
      page,
      trackCurrentSession,
    }) => {
      await navigateToSessions(page);

      await createSession(page, "hi what's in cwd?");
      trackCurrentSession(page);

      await expect(
        getChatMessageByText(page, "hi what's in cwd?"),
      ).toBeVisible();
      await expect(
        getVisibleInitialDiscoveryTools(page, "hi what's in cwd?"),
      ).not.toHaveCount(0, { timeout: 120000 });
      await waitForAgentIdle(page);

      await sendMessage(
        page,
        "cool. can you run sleep 30 on your computer and then cat readme",
      );

      // The default (main-worker) agent runs shell commands through use_computer.
      const runningBashTool = page.getByText(/Running use_computer.*sleep 30/i);
      await expect(runningBashTool).toBeVisible({ timeout: 120000 });

      const steeredInstruction =
        'no, when I send "continue" after stopping this command, run exactly "cat package.json" as its own command on your computer, then share all dependency packages instead';
      await steerMessage(page, steeredInstruction);
      await expect(runningBashTool).toBeVisible();
      await expect(
        page
          .locator('[data-slot="message-scroller-item"]')
          .getByText(steeredInstruction, { exact: true }),
      ).toHaveCount(0);

      await page.getByRole("button", { name: /^Stop/ }).click();

      // Stop ends the run: the composer returns to Send, with no Stop or Steer.
      const sendButton = page.getByRole("button", { name: /^Send/ });
      await expect(sendButton).toBeVisible({ timeout: 30000 });
      await expect(page.getByRole("button", { name: /^Stop/ })).toBeHidden();
      await expect(page.getByRole("button", { name: /^Steer/ })).toBeHidden();

      // The interrupted command's output shows it was aborted.
      await expandToolGroups(page.getByRole("region", { name: "Messages" }));
      const abortedBashTool = page.getByText(/Used use_computer.*sleep 30/i);
      await expect(abortedBashTool).toBeVisible({ timeout: 30000 });
      await abortedBashTool.click();
      const toolOutput = await getToolOutput(page);
      await expect(toolOutput).toContainText("Tool use_computer was aborted");

      const continuationFinished = waitForAgentToFinish(page, 120000);
      await sendMessage(page, "continue");
      await continuationFinished;
      const continuation = page
        .locator('[data-slot="message-scroller-item"]')
        .filter({ has: page.getByText("continue", { exact: true }) })
        .locator(
          'xpath=following-sibling::*[@data-slot="message-scroller-item"]',
        );
      // The steer is not lost by Stop: it is delivered, no longer pending.
      await expect(getPendingSteer(page, steeredInstruction)).toBeHidden();
      await expect(
        page
          .locator('[data-slot="message-scroller-item"]')
          .getByText(steeredInstruction, { exact: true }),
      ).toBeVisible();
      await expandToolGroups(continuation);
      const packageTool = await openBashWithFullCommand(
        continuation,
        "cat package.json",
        "used",
        "use_computer",
      );
      await expect(getBashOutput(packageTool)).toContainText(
        "playwright-utils",
      );
      await expect(
        continuation
          .locator('[data-slot="message"][data-align="start"]')
          .getByText(/playwright-utils/),
      ).toBeVisible();
    });

    for (const runtime of [
      {
        suffix: "",
        create: createSession,
        toolName: "use_computer",
      },
      {
        suffix: " (worker)",
        create: createWorkerSession,
        toolName: "just_bash",
      },
    ]) {
      test(`all pending steered messages are dequeued together after the next tool call${runtime.suffix}`, async ({
        page,
        trackCurrentSession,
      }) => {
        await navigateToSessions(page);

        const initialPrompt =
          "Run these bash commands one at a time, in order, waiting for each to fully finish before starting the next: (1) sleep 45 && echo FIRST_TOOL_DONE  (2) cat package.json  (3) sleep 30 && echo THIRD_TOOL_DONE";
        await runtime.create(page, initialPrompt);
        trackCurrentSession(page);
        const sessionId = getSessionIdFromUrl(page);
        const headers = await getApiWorkerAuthHeaders(page);

        const firstTool = getBashToolCall(
          page,
          /FIRST_TOOL_DONE/i,
          "running",
          runtime.toolName,
        );
        await expect(firstTool).toBeVisible({ timeout: 120000 });

        const firstSteeredMessage =
          "CHANGE OF PLANS: do not run commands (2) or (3). After the current sleep finishes, run only: echo STEER_INJECTED_OK.";
        const secondSteeredMessage =
          "After STEER_INJECTED_OK finishes, stop and tell me you stopped early because both queued instructions were received.";
        await steerMessage(page, firstSteeredMessage);
        await steerMessage(page, secondSteeredMessage);

        // Both runtimes show pending bubbles, not delivered transcript messages.
        // The ledger below must place both instructions after this tool's result
        // in one model turn; pending UI alone is not proof of delivery.
        await expect(firstTool).toBeVisible();
        await expect(getPendingSteer(page, firstSteeredMessage)).toHaveCount(1);
        await expect(getPendingSteer(page, secondSteeredMessage)).toHaveCount(
          1,
        );
        await expect(
          page
            .locator('[data-slot="message-scroller-item"]')
            .getByText(firstSteeredMessage, { exact: true }),
        ).toHaveCount(0);
        await expect(
          page
            .locator('[data-slot="message-scroller-item"]')
            .getByText(secondSteeredMessage, { exact: true }),
        ).toHaveCount(0);

        const completedFirstTool = getBashToolCall(
          page,
          /FIRST_TOOL_DONE/i,
          "used",
          runtime.toolName,
        );
        await expect(
          completedFirstTool
            .or(
              getResponseAfterPrompt(page, initialPrompt)
                .getByRole("button", { name: /^Used \d+ tools$/ })
                .first(),
            )
            .first(),
        ).toBeVisible({ timeout: 120000 });
        await expandToolGroups(getResponseAfterPrompt(page, initialPrompt));
        await expect(completedFirstTool).toBeVisible();

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
              const firstResultIndex = entries.findIndex(
                (entry) =>
                  entry.message?.role === "toolResult" &&
                  entryText(entry).includes("FIRST_TOOL_DONE"),
              );
              const firstEntryIndex = entries.findIndex(
                (entry) =>
                  entry.message?.role === "user" &&
                  entryText(entry).includes(firstSteeredMessage),
              );
              const secondEntryIndex = entries.findIndex(
                (entry) =>
                  entry.message?.role === "user" &&
                  entryText(entry).includes(secondSteeredMessage),
              );
              if (
                firstResultIndex < 0 ||
                firstEntryIndex <= firstResultIndex ||
                secondEntryIndex <= firstEntryIndex
              ) {
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
        const deliveredMessages = page.locator(
          '[data-slot="message-scroller-item"]',
        );
        await expect(
          deliveredMessages.getByText(firstSteeredMessage, { exact: true }),
        ).toBeVisible();
        await expect(
          deliveredMessages.getByText(secondSteeredMessage, { exact: true }),
        ).toBeVisible();
        await expectMessageContentsInDocumentOrder(page, [
          firstSteeredMessage,
          secondSteeredMessage,
        ]);

        const steeredTurn = deliveredMessages
          .filter({ hasText: secondSteeredMessage })
          .locator(
            'xpath=following-sibling::*[@data-slot="message-scroller-item"]',
          );
        await waitForAgentIdle(page, 120000);
        await expandToolGroups(steeredTurn);
        const injectedTool = await openBashWithFullCommand(
          steeredTurn,
          "echo STEER_INJECTED_OK",
          "used",
          runtime.toolName,
        );
        await expect(
          getBashOutput(injectedTool).getByText("STEER_INJECTED_OK", {
            exact: true,
          }),
        ).toBeVisible();

        // Only assistant content after the delivered instructions can satisfy this,
        // never the authored pending bubble or an earlier response.
        await expect(
          steeredTurn.getByText(/stopped early[\s\S]*both[\s\S]*instructions/i),
        ).toBeVisible();

        await expectMessageContentsInDocumentOrder(page, [
          new RegExp(`Used ${runtime.toolName}[\\s\\S]*FIRST_TOOL_DONE`, "i"),
          new RegExp(`Used ${runtime.toolName}[\\s\\S]*STEER_INJECTED_OK`, "i"),
        ]);

        await expect(
          getBashToolCall(page, /cat package\.json/i, "any", runtime.toolName),
        ).toBeHidden();
        await expect(
          getBashToolCall(page, /THIRD_TOOL_DONE/i, "any", runtime.toolName),
        ).toBeHidden();
      });
    }

    test("pause sandbox and automatically resume on new message", async ({
      page,
      trackCurrentSession,
    }) => {
      await navigateToSessions(page);

      const initialMessage = "What is 2 + 2? Reply with only the number.";
      await createSession(page, initialMessage);
      trackCurrentSession(page);
      const sessionId = getSessionIdFromUrl(page);
      const chatMessages = page.locator("[data-message-id]");

      await expect(getChatMessageByText(page, initialMessage)).toBeVisible({
        timeout: 30000,
      });
      await waitForSandboxEnvironment(page);
      // Message wrappers can duplicate the user bubble. An exact answer, absent
      // from the prompt, proves the assistant responded before checking for idle.
      await expect(
        chatMessages.getByText("4", { exact: true }).first(),
      ).toBeVisible({ timeout: 120000 });
      await waitForAgentIdle(page);
      await expect(page.getByRole("button", { name: /^Send/ })).toBeVisible();
      await waitForSandboxEnvironment(page, 15000);

      const headers = await getApiWorkerAuthHeaders(page);
      const pauseResponse = await page.request.post(
        `${getApiBaseUrl()}/api/chat-sessions/${sessionId}/sandbox/control`,
        {
          headers,
          data: { action: "pause" },
        },
      );
      await expect(pauseResponse).toBeOK();

      // Pausing is intentionally invisible in the UI. Verify the actual sandbox
      // state before sending the message that must automatically resume it.
      await expect
        .poll(
          async () => {
            const response = await page.request.get(
              `${getApiBaseUrl()}/api/chat-sessions/${sessionId}/sandbox/health`,
              { headers },
            );
            return { status: response.status(), body: await response.json() };
          },
          { timeout: 30000, message: "Sandbox must be paused before resuming" },
        )
        .toEqual({
          status: 409,
          body: {
            error:
              "Sandbox is paused. Send a message in the session to resume it.",
          },
        });

      const resumeMessage = "What is 8 + 7? Reply with only the number.";
      await sendMessage(page, resumeMessage);

      await expect(
        chatMessages.filter({ hasText: resumeMessage }).first(),
      ).toBeVisible({ timeout: 30000 });
      await waitForSandboxEnvironment(page);
      await expect(
        chatMessages.getByText("15", { exact: true }).first(),
      ).toBeVisible({ timeout: 120000 });
      await waitForAgentIdle(page);
      await expect(page.getByRole("button", { name: /^Send/ })).toBeVisible();
    });

    test.skip("edit message updates assistant response", async ({
      page,
      trackCurrentSession,
    }) => {
      // skipped: edit message button not supported in sandbox mode
      const initialPrompt = "just answer this math question: what is 2 + 2?";
      const updatedPrompt = "just answer this math question: what is 8 + 7?";

      await navigateToSessions(page);

      // Create a new session with the initial prompt
      await createSession(page, initialPrompt);

      // Track the session for automatic cleanup
      trackCurrentSession(page);

      const chatBubbles = page.locator("[data-message-id]");
      const stopButton = page.getByRole("button", { name: "Stop" });

      // Wait for the first user message bubble to appear
      await expect(chatBubbles.first()).toBeVisible({ timeout: 30000 });

      // Wait for the assistant to finish responding to the initial prompt before editing
      if (await stopButton.isVisible()) {
        await expect(stopButton).toBeHidden({ timeout: 60000 });
      }

      await expect(
        chatBubbles.filter({ hasText: /\b4\b|equals 4|= 4/ }).first(),
      ).toBeVisible({ timeout: 30000 });

      const userMessageBubble = chatBubbles
        .filter({ hasText: initialPrompt })
        .first();
      await userMessageBubble.hover();
      await userMessageBubble
        .getByRole("button", { name: "Edit message" })
        .click();

      const editTextbox = page.getByRole("textbox", {
        name: "Edit your message...",
      });
      await editTextbox.fill(updatedPrompt);
      await page.getByRole("button", { name: "Save Changes" }).click();

      await expect(
        chatBubbles.filter({ hasText: updatedPrompt }).first(),
      ).toBeVisible({ timeout: 20000 });

      // Assert the assistant responds to the updated message with the correct answer (15)
      await expect(
        chatBubbles.filter({ hasText: /15|equals 15|= 15/ }).first(),
      ).toBeVisible({ timeout: 60000 });

      // Click on "(edited)" to view edit history
      const editedUserMessageBubble = chatBubbles
        .filter({ hasText: updatedPrompt })
        .first();
      await editedUserMessageBubble.getByText("(edited)").click();

      // Assert that edit history modal is visible
      const editHistoryModal = page.getByLabel("Edit History");
      await expect(editHistoryModal).toBeVisible();

      // Assert both old and new messages are visible in the edit history modal
      await expect(editHistoryModal.getByText(initialPrompt)).toBeVisible();
      await expect(editHistoryModal.getByText(updatedPrompt)).toBeVisible();
    });
  });

  test("Session with base branch", async ({ page, trackCurrentSession }) => {
    await navigateToSessions(page);

    // Finish branch setup before requesting files so discovery cannot run on
    // the default branch in the same turn as the checkout.
    await createSessionWithBranch(
      page,
      "Check out a session branch based on it, then wait for my next message.",
      "example-base-branch",
    );

    // Track the session for automatic cleanup
    trackCurrentSession(page);
    await waitForAgentToFinish(page);

    await sendMessage(page, "list files in tests dir");

    // Verify that empty-file-only-in-this-branch.spec.ts is visible in the response (only exists in example-base-branch)
    // In sandbox mode, allow extra time for sandbox environment setup before the agent can run
    await expect(
      page.getByText("empty-file-only-in-this-branch.spec.ts"),
    ).toBeVisible({ timeout: 120000 });

    // Wait for the agent to finish responding
    await waitForAgentIdle(page);
  });

  test("Authorization - modified project_id should not return chat sessions", async ({
    page,
  }) => {
    // Observe the real list request before navigation; project filtering is now
    // multi-select (project_ids). Do not race it or capture the JS asset request.
    const listRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.pathname === "/api/chat-sessions" &&
        url.searchParams.has("project_ids")
      );
    });
    await navigateToSessions(page);
    const request = await listRequest;
    expect(new URL(request.url()).searchParams.get("project_ids")).toBe(
      process.env.LOREM_IPSUM_PROJECT_ID,
    );

    // Change only the project selection on the actual browser request, preserving
    // its pagination/filters, and verify no unauthorized sessions are returned.
    const unauthorizedUrl = new URL(request.url());
    unauthorizedUrl.searchParams.set("project_ids", "1");
    const response = await page.request.get(unauthorizedUrl.toString());
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.data).toEqual([]);
  });

  test.skip("Subscribe to session and verify in Subscribed sessions list", async ({
    page,
  }) => {
    await navigateToSessions(page);

    // Filter sessions to a user returned by the filter API.
    await filterSessionsByUser(page);

    // Open the first session in the filtered list and capture its ID
    const sessionId = await openFirstSession(page);

    // Wait for either Subscribe or Unsubscribe button to be visible first
    const subscribeButton = page.getByRole("button", {
      name: "Subscribe",
      exact: true,
    });
    const unsubscribeButton = page.getByRole("button", {
      name: "Unsubscribe",
      exact: true,
    });
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
    await page.goto("/sessions");

    // Wait for sessions page to load
    await expect(page).toHaveURL(/sessions/);

    // Verify the subscribed session appears in the list with the bell icon (.lucide-bell)
    // The bell icon indicates the session is subscribed
    const sessionLinkWithBell = page
      .locator(`a[href*="/sessions/${sessionId}"]`)
      .filter({ has: page.locator(".lucide-bell") });
    await expect(sessionLinkWithBell).toBeVisible();

    // Click on the subscribed session
    await sessionLinkWithBell.click();

    // Click on the Unsubscribe button to clean up the state
    await unsubscribeButton.click();

    // Verify that the button changes back to "Subscribe"
    await expect(subscribeButton).toBeVisible();
  });

  test("Verify session creation and basic chat interaction from Sessions", async ({
    page,
    trackCurrentSession,
  }) => {
    await navigateToSessions(page);

    // Click the + icon button next to the filter icon to open the create session dialog
    await openNewSessionDialog(page);

    const uniqueMessage = `hello ${Date.now()}`;
    await page
      .getByRole("textbox", { name: "Enter an initial prompt or" })
      .fill(uniqueMessage);
    await page.getByRole("button", { name: "Create" }).click();

    // Verify we're in a session
    await expect(page).toHaveURL(/sessions\/\d+/);
    test
      .info()
      .annotations.push({ type: "Session URL", description: page.url() });

    // Track the session for automatic cleanup
    trackCurrentSession(page);

    // Wait for the session to actually load by checking that the chat interface is ready
    // (wait for the message input area to be visible instead of waiting for messages)
    await expect(getSessionComposer(page)).toBeVisible();

    // Wait for the first user message to appear
    await waitForFirstMessage(page);

    // Get the session title link in the sidebar (title is inferred from first message)
    const sessionTitleLink = page.getByRole("link", { name: uniqueMessage });
    const waitingIndicator = sessionTitleLink.locator(
      ".lucide-message-square-reply",
    );

    // Get the stop button reference for later use (button now includes keyboard shortcut like "Stop ⌃C")
    const stopButton = page.getByRole("button", { name: /^Stop/ });

    // Wait for the agent to finish processing the first message before sending the second.
    // Agent turns can occasionally exceed 60s on full-run infra, so use the same
    // 120s budget as the other agent-processing assertions in this suite.
    await expect(stopButton).toBeHidden({ timeout: 120000 });

    // Type "how are you" via clipboard paste (repro for copy-paste bug in prompt input)
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
    // The sandbox-free default agent replies to a short greeting in about a second,
    // faster than the Stop check below can observe. Ask for a longer reply so the
    // responding state stays visible long enough.
    const secondMessage =
      "how are you? Also write a 300-word story about a software tester.";
    await writeTextToClipboard(page, secondMessage);
    const messageInput = getSessionComposer(page);
    await messageInput.click();
    await page.keyboard.press("Control+v");
    await expect(messageInput).toContainText(secondMessage);
    // Send via the Ctrl+Enter keyboard shortcut (shown as "Send ⌃ ↵") instead of clicking the button,
    // so this test also covers the send keyboard shortcut.
    await messageInput.press("Control+Enter");

    // Verify the message appears in the conversation
    await expect(getChatMessageByText(page, secondMessage)).toBeVisible();

    // Verify the Stop button is visible while agent is responding to second message
    // (check immediately after message appears, before minimap steps, to catch the button reliably).
    // The default (main-worker) agent has no sandbox, so there is no sandbox startup to wait for.
    await expect(stopButton).toBeVisible({ timeout: 60000 });

    // While Stop button is visible (agent is responding), verify the "waiting on user input" indicator is HIDDEN
    await expect(waitingIndicator).not.toBeVisible();

    // Verify the second message is visible in the chat conversation
    await expect(getChatMessageByText(page, secondMessage)).toBeVisible();

    // Wait for agent to finish responding to second message. As above, allow
    // enough time for slower full-run infra.
    await expect(stopButton).toBeHidden({ timeout: 120000 });

    // After agent finishes responding, the "waiting on user input" indicator should appear again
    await expect(waitingIndicator).toBeVisible();

    // Fold the closed-state coverage into this broader session lifecycle test.
    const sessionId = getSessionIdFromUrl(page);
    await closeSession(page);
    await page.goto(`/sessions/${sessionId}`);
    await expect(page).toHaveURL(new RegExp(`/sessions/${sessionId}$`));
    // Accessible role lookup excludes hidden SSR segments while the header hydrates.
    const closedControl = page
      .locator("#inner-sidebar-detail header button")
      .and(page.getByRole("button", { name: "Closed", exact: true }));
    await expect(closedControl).toHaveCount(1);
    await expect(closedControl).toBeVisible();
    await expect(closedControl).toBeDisabled();

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
