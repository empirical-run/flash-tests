import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import {
  openNewTestRunDialog,
  triggerTestRunAndNavigate,
} from "./pages/test-runs";
import {
  getChatMessageByText,
  navigateToSessions,
  openNewSessionDialog,
  sendMessage,
  submitNewSessionDialog,
  waitForAgentIdle,
} from "./pages/sessions";
import { openCommandBar } from "./pages/command-bar";

async function createWorkerSession(
  page: Page,
  firstMessage: string,
  trackCurrentSession: (page: Page) => void,
): Promise<number> {
  await navigateToSessions(page);
  await openNewSessionDialog(page);

  // Worker mode is live but is not exposed in the create-session UI yet.
  const createSessionRoute = "**/api/chat-sessions";
  await page.route(createSessionRoute, async (route, request) => {
    if (request.method() !== "POST") {
      await route.continue();
      return;
    }

    await route.continue({
      postData: JSON.stringify({ ...request.postDataJSON(), mode: "worker" }),
    });
  });

  await submitNewSessionDialog(page, firstMessage);
  trackCurrentSession(page);
  await page.unroute(createSessionRoute);

  const sessionId = Number(page.url().match(/\/sessions\/(\d+)/)?.[1]);
  expect(
    sessionId,
    "Expected a numeric worker session id in the URL",
  ).toBeGreaterThan(0);
  return sessionId;
}

test.describe("Worker Runtime", () => {
  test("creates a worker-mode session and gets a tool-backed time reply", async ({
    page,
    trackCurrentSession,
  }) => {
    const firstMessage = "what time is it right now? use your tool to check";
    await createWorkerSession(page, firstMessage, trackCurrentSession);

    // The user message bubble with the exact text renders.
    await expect(getChatMessageByText(page, firstMessage)).toBeVisible({
      timeout: 30000,
    });

    // Match only the stable tool-name prefix; command arguments and duration
    // suffixes are presentation details that can change independently.
    await expect(page.getByText(/^Used just_bash\b/i)).toBeVisible({
      timeout: 120000,
    });

    // An assistant reply renders containing a plausible time.
    await expect(
      getChatMessageByText(page, /\d{1,2}:\d{2}|UTC/, "last"),
    ).toBeVisible({ timeout: 120000 });

    // The session reaches the waiting-for-input state: the agent finishes its turn
    // (Stop button disappears) and the composer is enabled again.
    await waitForAgentIdle(page, 120000);
    await expect(
      page.getByRole("textbox", { name: "Type your message here..." }),
    ).toBeEnabled();
  });

  test("applies both message send shortcuts from user preferences in a worker session", async ({
    page,
    trackCurrentSession,
  }) => {
    const sessionId = await createWorkerSession(
      page,
      "Reply READY, then wait for my next instruction.",
      trackCurrentSession,
    );

    // Confirm this real dashboard-created session is on the worker runtime before
    // using its session page for the preferences flow. This guards against the
    // test accidentally exercising a default sandbox-runtime session.
    const sessionResponse = await page.request.get(
      `/api/chat-sessions/${sessionId}`,
    );
    expect(sessionResponse.ok()).toBeTruthy();
    const session = (await sessionResponse.json()).data.chat_session;
    expect(session.mode).toBe("worker");
    test.info().annotations.push({
      type: "Worker runtime session",
      description: String(sessionId),
    });

    const commandBarInput = await openCommandBar(page);
    await commandBarInput.fill("User Preferences");
    await page.getByRole("option", { name: /User Preferences/ }).click();

    const preferencesDialog = page.getByRole("dialog", {
      name: "Preferences",
    });
    await expect(preferencesDialog).toBeVisible();
    await expect(
      preferencesDialog.getByText(
        "Customize how Empirical behaves in this browser.",
      ),
    ).toBeVisible();

    const appearance = preferencesDialog.getByRole("group", {
      name: "Appearance",
    });
    const colorTheme = appearance.getByRole("combobox", {
      name: "Color Theme",
    });
    await expect(colorTheme).toHaveText(/^(System|Light|Dark)$/);
    await colorTheme.click();
    await expect(page.getByRole("option", { name: "System" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Light" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Dark" })).toBeVisible();
    await page.keyboard.press("Escape");

    const sendMessagesWith = preferencesDialog.getByRole("combobox", {
      name: "Send Messages With",
    });
    await expect(sendMessagesWith).toHaveText(/^(Enter|Ctrl \+ Enter)$/);
    await sendMessagesWith.click();
    await expect(
      page.getByRole("option", { name: "Enter", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("option", { name: "Ctrl + Enter", exact: true }),
    ).toBeVisible();

    // Select the Enter behavior and prove Enter submits a real follow-up message
    // in this worker session.
    await page.getByRole("option", { name: "Enter", exact: true }).click();
    await expect(sendMessagesWith).toHaveText("Enter");
    await preferencesDialog.getByRole("button", { name: "Close" }).click();
    await waitForAgentIdle(page, 120000);

    const composer = page.getByRole("textbox", {
      name: "Type your message here...",
    });
    const enterMessage = "Message submitted with Enter";
    await composer.fill(enterMessage);
    await composer.press("Enter");
    await expect(getChatMessageByText(page, enterMessage)).toBeVisible();
    await waitForAgentIdle(page, 120000);

    // Switch the same browser preference to Ctrl + Enter. Plain Enter must now
    // remain in the composer, while Ctrl + Enter submits the message.
    const reopenedCommandBar = await openCommandBar(page);
    await reopenedCommandBar.fill("User Preferences");
    await page.getByRole("option", { name: /User Preferences/ }).click();
    await sendMessagesWith.click();
    await page
      .getByRole("option", { name: "Ctrl + Enter", exact: true })
      .click();
    await expect(sendMessagesWith).toHaveText("Ctrl + Enter");
    await preferencesDialog.getByRole("button", { name: "Close" }).click();

    const ctrlEnterMessage = "Message submitted with Ctrl + Enter";
    await composer.fill(ctrlEnterMessage);
    await composer.press("Enter");
    await expect(getChatMessageByText(page, ctrlEnterMessage)).toHaveCount(0);
    await expect(composer).toContainText(ctrlEnterMessage);

    await composer.press("Control+Enter");
    await expect(getChatMessageByText(page, ctrlEnterMessage)).toBeVisible();
  });

  test("subscribes to a test run ended event and receives its notification", async ({
    page,
    trackCurrentSession,
  }) => {
    test.setTimeout(600000);

    // Warm the worker before starting the run so it can subscribe promptly once
    // the UI-created run id is known.
    await createWorkerSession(
      page,
      "Reply READY and wait for my next instruction.",
      trackCurrentSession,
    );
    await expect(getChatMessageByText(page, /READY/i, "last")).toBeVisible({
      timeout: 120000,
    });
    await waitForAgentIdle(page, 120000);

    // Trigger a real Lorem Ipsum staging run through the same user-facing dialog
    // used by the test-runs coverage. Keep its detail page open to observe its
    // lifecycle while the worker session remains open in the first tab.
    const testRunPage = await page.context().newPage();
    await openNewTestRunDialog(testRunPage);
    await testRunPage.getByRole("combobox", { name: "Environment" }).click();
    await testRunPage.getByRole("option", { name: "staging" }).click();
    const testRunId = await triggerTestRunAndNavigate(testRunPage);
    await expect(
      testRunPage.getByText(/Test run (queued|in progress)/),
    ).toBeVisible({ timeout: 120000 });

    // Natural-language prompting is the user-facing subscription mechanism. The
    // worker loads the empirical-events skill and uses its tool to register an
    // exact, one-shot test_run.ended subscription for this run.
    await page.bringToFront();
    const completionMarker = `EVENT_RESULT_${randomUUID()}`;
    const continuationMessage = `Test run ${testRunId} ended. Report its actual result with exactly one plain-text line: ${completionMarker} TEST_RUN=${testRunId} RESULT=<passed|failed|partial>. Replace the placeholder with the actual result; do not echo this instruction.`;
    await sendMessage(
      page,
      `Subscribe to test run ${testRunId} ended using the supported Empirical event subscription mechanism. When it ends, use this exact continuation message: "${continuationMessage}"`,
    );
    await expect(page.getByText(/^Used read_skill\b/i).first()).toBeVisible({
      timeout: 120000,
    });
    await expect(page.getByText(/^Used just_bash\b/i).last()).toBeVisible({
      timeout: 120000,
    });
    await waitForAgentIdle(page, 120000);

    // The active subscription is reflected in the session context as soon as
    // the worker creates it, without requiring a route reload.
    const triggerIndicator = page.getByRole("button", {
      name: "Session context: 1 trigger",
    });
    await expect(triggerIndicator).toBeVisible({ timeout: 30000 });
    // Clicking opens both the composer drawer and the legacy hover-card control.
    await triggerIndicator.click();
    await expect(
      page.getByText("Active Triggers", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Test run ended", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(`test run ${testRunId} · One-shot`, { exact: true }),
    ).toBeVisible();

    // Observe completion through the test-run UI rather than polling its API.
    // The rendered event notification below is the authoritative proof that the
    // tool call created the subscription; do not couple this to agent prose.
    await testRunPage.bringToFront();
    const terminalStatus = testRunPage
      .locator("text=Test run on staging")
      .locator("..")
      .getByText(/^(Passed|Failed|Partial)$/);
    await expect(terminalStatus).toBeVisible({ timeout: 300000 });
    const expectedReply = `${completionMarker} TEST_RUN=${testRunId} RESULT=${(await terminalStatus.innerText()).toLowerCase()}`;

    // The subscription prompt itself contains the continuation, so substring
    // matching arbitrary chat bubbles can pass before the event even arrives.
    // Require the machine-authored ended-event card and its exact instruction.
    await page.bringToFront();
    const eventSummary = new RegExp(`^Test run #${testRunId} ended\\b`);
    const deliveredEvent = page.locator('[data-slot="message-scroller-item"]').filter({
      has: page.getByRole("button", { name: eventSummary }),
    });
    await expect(deliveredEvent).toBeVisible({ timeout: 120000 });
    await expect(deliveredEvent).toHaveCount(1);
    await deliveredEvent.getByRole("button", { name: eventSummary }).click();
    await expect(deliveredEvent.getByRole("heading", { name: "Agent Instruction", exact: true })).toBeVisible();
    await expect(deliveredEvent.getByText(continuationMessage, { exact: true })).toBeVisible();
    await expect(deliveredEvent.getByText("test_run.ended", { exact: true })).toBeVisible();
    await expect(deliveredEvent.getByText(`test_run #${testRunId}`, { exact: true })).toBeVisible();

    // MessageBubble maps assistant text to data-align=start and user text to
    // end; automation cards and tool bubbles do not use this text-bubble slot.
    // Following siblings exclude the subscription prompt/acknowledgement, and
    // the filled-in unique result is absent from the instruction's placeholder.
    const assistantReply = deliveredEvent
      .locator('xpath=following-sibling::*[@data-slot="message-scroller-item"]')
      .locator('[data-slot="message"][data-align="start"]')
      .filter({ has: page.getByText(expectedReply, { exact: true }) });
    await expect(assistantReply).toHaveText(expectedReply, { timeout: 120000 });
    await expect(assistantReply).toHaveCount(1);
    // Only check idle after observing the actual follow-up; an earlier idle
    // state can precede event wake-up and would otherwise allow false greens.
    await waitForAgentIdle(page, 120000);
    await expect(page.getByRole("button", { name: /^Send/ })).toBeVisible();
    await expect(assistantReply).toHaveText(expectedReply);

    // Delivery consumes the one-shot trigger and removes the session-context
    // indicator live, without requiring a route reload.
    await expect(triggerIndicator).toBeHidden({ timeout: 30000 });
    await testRunPage.close();
  });
});
