import { test, expect } from "./fixtures";
import { getMostRecentOpenPullRequest, getPullRequest } from "./pages/github";
import { createSession, getSessionIdFromUrl, navigateToSessions, waitForAgentToFinish, waitForFirstMessage } from "./pages/sessions";
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

    // Step 2: Start a session asking the agent to find the most recent open PR and
    // rename its title to Date.now().
    await navigateToSessions(page);
    const message = "find the most recent open PR in the repo, and modify it's title to Date.now()";
    await createSession(page, message);
    await waitForFirstMessage(page);
    trackCurrentSession(page);

    // Capture the session id (confirms we are on a session page; helps debugging)
    getSessionIdFromUrl(page);

    // Step 3: Wait for the agent to start working and then finish (it should attempt
    // the change, be blocked, and stop).
    await waitForAgentToFinish(page);

    // Step 4: The platform must block the modification. When the sandbox tries to call
    // the GitHub API for a PR outside its own chat session branch, it gets a 403 with
    // this exact message — surfacing it proves the agent actually attempted the change
    // and was blocked (rather than simply choosing not to act).
    await expect(
      page.getByText(/Sandbox can only create pull requests from its chat session branch/i).first()
    ).toBeVisible({ timeout: 15000 });

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
