import { test, expect } from "./fixtures";
import {
  getChatMessageByText,
  navigateToSessions,
  openNewSessionDialog,
  submitNewSessionDialog,
  waitForAgentIdle,
} from "./pages/sessions";

test.describe("Worker Runtime", () => {
  // The "worker" chat-session mode is live in production. There is still no UI
  // control to set it, so this test injects `mode: "worker"` into the
  // POST /api/chat-sessions request via route interception.
  test("creates a worker-mode session and gets a tool-backed time reply", async ({
    page,
    trackCurrentSession,
  }) => {
    await navigateToSessions(page);

    // Start creating a new session the normal way.
    await openNewSessionDialog(page);

    // Intercept ONLY the POST that creates the chat session (it hits the API
    // worker origin, not the dashboard origin) and inject `mode: "worker"` into
    // the JSON body. Every other request is passed through untouched.
    const createSessionRoute = "**/api/chat-sessions";
    await page.route(createSessionRoute, async (route, request) => {
      if (request.method() !== "POST") {
        await route.continue();
        return;
      }

      const body = request.postDataJSON();
      const modifiedBody = { ...body, mode: "worker" };
      await route.continue({ postData: JSON.stringify(modifiedBody) });
    });

    const firstMessage = "what time is it right now? use your tool to check";
    await submitNewSessionDialog(page, firstMessage);

    // Track the session for automatic cleanup.
    trackCurrentSession(page);

    // The interception is only needed for the create request; stop intercepting
    // now that the session exists so later requests are never touched.
    await page.unroute(createSessionRoute);

    // The user message bubble with the exact text renders.
    await expect(getChatMessageByText(page, firstMessage)).toBeVisible({
      timeout: 30000,
    });

    // A tool-use entry for the current_time tool appears (renders like
    // "Used current_time tool"). Agent turns take a while, so allow a generous timeout.
    await expect(page.getByText(/Used current_time tool/i)).toBeVisible({
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
});
