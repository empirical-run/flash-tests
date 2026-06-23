import { test, expect } from "./fixtures";
import { getMostRecentOpenPullRequest, getPullRequest } from "./pages/github";
import { createSession, navigateToSessions, waitForAgentToFinish, waitForFirstMessage } from "./pages/sessions";
import { getDashboardBaseUrl } from "./pages/urls";

test.describe('Session must not modify another PR', () => {
  test('agent cannot change the title of a PR it does not own', async ({ page, trackCurrentSession }) => {
    const buildUrl = getDashboardBaseUrl();

    // Step 1: Capture the most recent open PR in the repo. The session does not own
    // this PR, so the platform must prevent the agent from modifying it.
    const targetPr = await getMostRecentOpenPullRequest(page, buildUrl);
    expect(targetPr, 'Expected the repo to have at least one open PR').toBeTruthy();
    const prNumber = targetPr.number as number;
    const originalTitle = targetPr.title as string;

    // Step 2: Start a session asking the agent to edit ONLY this specific PR's title.
    // Pinning the PR number (instead of "the most recent open PR") removes ambiguity
    // and prevents the agent from working around the block by creating its own PR.
    // The agent is asked to report "DONE"/"NOT DONE" so we get a deterministic signal.
    await navigateToSessions(page);
    const message =
      `Edit the title of PR #${prNumber} to Date.now(). ` +
      `Only perform this single action and nothing else — do not create any new PR, ` +
      `branch, or make any other change. When finished, reply with exactly "DONE" if you ` +
      `successfully changed the title, or "NOT DONE" if you could not.`;
    await createSession(page, message);
    await waitForFirstMessage(page);
    trackCurrentSession(page);

    // Step 3: Wait for the agent to start working and then finish. The platform blocks
    // the sandbox from modifying a PR outside its own chat session branch (the GitHub
    // API call returns a 403 "Sandbox can only create pull requests from its chat
    // session branch"), so the agent attempts the change, is blocked, and stops.
    await waitForAgentToFinish(page);

    // Step 4: The agent's final reply must report that it could NOT make the change.
    // This is the positive signal that it actually attempted the edit and was blocked
    // (rather than silently doing nothing).
    // We scope to the LAST message bubble (the agent's final reply) so we don't match
    // the "NOT DONE" string echoed in the user's own prompt bubble (the first bubble).
    // `/NOT DONE/` also won't match a "DONE" success reply, so a regression is caught.
    const lastMessageBubble = page.locator('[data-message-id]').last();
    await expect(lastMessageBubble).toContainText(/NOT DONE/i, { timeout: 15000 });

    // Step 5: The PR title must remain unchanged — a session is not allowed to modify
    // a PR it does not own. Poll for a short window to catch any delayed write.
    await expect.poll(async () => {
      const pr = await getPullRequest(page, prNumber, buildUrl);
      return pr.title;
    }, {
      message: `PR #${prNumber} title must remain unchanged ("${originalTitle}")`,
      timeout: 20000,
      intervals: [3000]
    }).toBe(originalTitle);

    // Final explicit assertion.
    const finalPr = await getPullRequest(page, prNumber, buildUrl);
    expect(finalPr.title).toBe(originalTitle);
  });
});
