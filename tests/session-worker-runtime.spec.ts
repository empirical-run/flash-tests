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

async function createWorkerSession(
  page: Page,
  firstMessage: string,
  trackCurrentSession: (page: Page) => void,
): Promise<void> {
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

    // The worker uses just_bash to run `date`; match the stable label prefix so
    // command flags and duration suffixes can change without breaking the test.
    await expect(page.getByText(/Used just_bash: date/i)).toBeVisible({
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
    const continuationMessage = `Test run ${testRunId} ended. Report its result and include test run ${testRunId} in your reply.`;
    await sendMessage(
      page,
      `Subscribe to test run ${testRunId} ended using the supported Empirical event subscription mechanism. When it ends, use this exact continuation message: "${continuationMessage}"`,
    );
    await expect(page.getByText(/Used read_skill tool/i).first()).toBeVisible({
      timeout: 120000,
    });
    await expect(page.getByText(/Used just_bash:/i).last()).toBeVisible({
      timeout: 120000,
    });
    await waitForAgentIdle(page, 120000);

    // The active subscription is reflected in the session context as soon as
    // the worker creates it, without requiring a route reload.
    const triggerIndicator = page.getByRole("button", {
      name: "Session context: 1 trigger",
    });
    await expect(triggerIndicator).toBeVisible({ timeout: 30000 });
    await triggerIndicator.hover();
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
    await expect(
      testRunPage
        .locator("text=Test run on staging")
        .locator("..")
        .getByText(/Passed|Failed|Partial/),
    ).toBeVisible({ timeout: 300000 });

    // The ended event wakes the idle worker and appends its continuation to the
    // real chat transcript. The follow-up assistant message reports the outcome.
    await page.bringToFront();
    await expect(
      getChatMessageByText(page, continuationMessage, "last"),
    ).toBeVisible({ timeout: 120000 });
    await expect(
      getChatMessageByText(
        page,
        new RegExp(
          `test run ${testRunId}.*(passed|failed|partial|ended)|(passed|failed|partial|ended).*test run ${testRunId}`,
          "i",
        ),
        "last",
      ),
    ).toBeVisible({ timeout: 120000 });
    await waitForAgentIdle(page, 120000);

    // Delivery consumes the one-shot trigger and removes the session-context
    // indicator live, without requiring a route reload.
    await expect(triggerIndicator).toBeHidden({ timeout: 30000 });
    await testRunPage.close();
  });
});
