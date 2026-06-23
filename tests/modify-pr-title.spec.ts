import { test, expect } from "./fixtures";
import { createBranchFromStaging, createFileOnBranch, createPullRequest, getPullRequest, deleteBranch } from "./pages/github";
import { generateUniqueBranchName } from "./pages/branch-name";
import { createSession, getSessionIdFromUrl, navigateToSessions, waitForFirstMessage } from "./pages/sessions";
import { getDashboardBaseUrl } from "./pages/urls";

test.describe('Session modifies PR title', () => {
  let branchName: string;
  let prNumber: number | undefined;

  test.beforeEach(async () => {
    branchName = generateUniqueBranchName('modify-pr-title-test');
    prNumber = undefined;
  });

  test.afterEach(async ({ page }) => {
    // Close the PR if it is still open, then delete the branch
    if (prNumber !== undefined) {
      const buildUrl = getDashboardBaseUrl();
      await page.request.post(`${buildUrl}/api/github/proxy`, {
        headers: { 'Content-Type': 'application/json' },
        data: {
          method: 'PATCH',
          url: `/repos/empirical-run/lorem-ipsum-tests/pulls/${prNumber}`,
          body: { state: 'closed' }
        }
      });
    }
    await deleteBranch(page, branchName);
  });

  test('agent finds the most recent open PR and updates its title to Date.now()', async ({ page, trackCurrentSession }) => {
    // Step 1: Set up a known open PR so the "most recent open PR" is deterministic.
    // Create a fresh branch off staging and commit a file so the PR has a diff.
    await createBranchFromStaging(page, branchName);
    await createFileOnBranch(
      page,
      branchName,
      `tmp/${branchName}.txt`,
      `Seed file for ${branchName}\n`,
      `Add seed file for ${branchName}`
    );

    // Open the PR with a clearly non-numeric title so we can detect when the agent changes it.
    const originalTitle = `Title to be updated by agent (${branchName})`;
    const pr = await createPullRequest(
      page,
      originalTitle,
      branchName,
      'staging',
      'PR created by automated test to verify the agent can update a PR title.'
    );
    prNumber = pr.number;
    expect(prNumber).toBeTruthy();

    // Step 2: Start a session asking the agent to find the most recent open PR and rename it.
    await navigateToSessions(page);
    const message = "find the most recent open PR in the repo, and modify it's title to Date.now()";
    await createSession(page, message);
    await waitForFirstMessage(page);
    trackCurrentSession(page);

    // Capture the session id (helps debugging and confirms we are on a session page)
    getSessionIdFromUrl(page);

    // Step 3: Poll the PR via the GitHub API until the title is changed to a numeric
    // Date.now() value (a string of digits) that differs from the original title.
    const buildUrl = getDashboardBaseUrl();
    let finalTitle = '';
    await expect.poll(async () => {
      const updatedPr = await getPullRequest(page, prNumber!, buildUrl);
      finalTitle = updatedPr.title ?? '';
      return finalTitle !== originalTitle && /^\d+$/.test(finalTitle.trim());
    }, {
      message: `PR #${prNumber} title should be updated to a numeric Date.now() value`,
      timeout: 300000,
      intervals: [5000]
    }).toBe(true);

    // Final assertion: the title is a numeric timestamp.
    expect(finalTitle.trim()).toMatch(/^\d+$/);
  });
});
