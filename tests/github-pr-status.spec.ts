import { test, expect } from "./fixtures";
import { generateUniqueBranchName } from "./pages/branch-name";
import {
  createBranchFromStaging,
  deleteBranch,
  getPullRequest,
} from "./pages/github";
import {
  createSessionWithBranch,
  getSessionIdFromUrl,
  mergePrFromSession,
  navigateToSessions,
  waitForFirstMessage,
  waitForPRButton,
} from "./pages/sessions";

test.describe("GitHub PR Status Tests", () => {
  let baseBranch: string;

  test.beforeEach(() => {
    baseBranch = generateUniqueBranchName("pr-attribution-test");
  });

  test.afterEach(async ({ page }) => {
    // Always remove the throwaway merge target, including when setup or an assertion fails.
    await deleteBranch(page, baseBranch);
  });

  test("create and merge a PR, then attribute the merged timeline event to the user", async ({
    page,
    trackCurrentSession,
  }) => {
    // Merging is safe only because the session's PR targets this unique branch forked
    // from staging, rather than staging/main or another shared default branch.
    await createBranchFromStaging(page, baseBranch);
    await navigateToSessions(page);

    // The agent is asked to create the PR itself so the platform flow injects the
    // session ID and user identity into the PR description.
    const timestamp = new Date()
      .toISOString()
      .replace("T", " at ")
      .replace("Z", " UTC");
    const formattedDate = `Updated on: ${timestamp}`;
    const message = `update the README.md file to include this exact text at the top: "${formattedDate}" - do this change without asking me for anything else - use str replace (not insert) tool - then create a pull request`;
    await createSessionWithBranch(page, message, baseBranch);
    await waitForFirstMessage(page);
    trackCurrentSession(page);

    const sessionId = getSessionIdFromUrl(page);
    await expect(page.getByText(/Used read tool/).first()).toBeVisible({
      timeout: 60000,
    });
    await expect(page.getByText(/Used edit tool/).first()).toBeVisible({
      timeout: 150000,
    });

    // The header PR button is linked by the same platform flow that injects the
    // session metadata. Read its number for the API and timeline assertions below.
    const prButton = await waitForPRButton(page, 120000);
    await expect(prButton.first()).toHaveText(/PR #\d+/);
    const prButtonText = await prButton.first().textContent();
    const prNumber = prButtonText?.match(/PR #(\d+)/)?.[1];
    expect(prNumber).toBeTruthy();

    // Keep coverage for both metadata fields in the generated PR description.
    const userEmail = process.env.AUTOMATED_USER_EMAIL;
    expect(userEmail, "AUTOMATED_USER_EMAIL env var must be set").toBeTruthy();

    await expect
      .poll(
        async () => {
          const data = await getPullRequest(page, Number(prNumber));
          const body = data.body || "";
          return body.includes(sessionId) && body.includes(userEmail!);
        },
        {
          message: `PR description should contain session ID "${sessionId}" and user email "${userEmail}"`,
          timeout: 30000,
          intervals: [3000],
        },
      )
      .toBe(true);

    // mergePrFromSession uses the dashboard Review UI and verifies the actual PR
    // base via GitHub before clicking Merge, preventing a destructive shared-branch merge.
    const mergedPrNumber = await mergePrFromSession(page, baseBranch);
    expect(mergedPrNumber).toBe(prNumber);

    // Scope attribution to the merged PR timeline mini-bubble. The identity lives in
    // the bubble metadata (avatar tooltip), not in the event label itself; this catches
    // regressions where created_by/created_by_user_detail is missing on the event.
    const mergedTimelineBubble = page
      .locator('[data-slot="message-scroller-item"]')
      .filter({
        has: page.getByText(`PR #${prNumber} merged`, { exact: true }),
      });
    await expect(mergedTimelineBubble).toBeVisible({ timeout: 30000 });
    const mergedByIdentity = mergedTimelineBubble.locator(
      '[data-slot="tooltip-trigger"]',
    );
    await expect(mergedByIdentity).toBeVisible();
    await mergedByIdentity.hover();
    await expect(page.getByRole("tooltip", { name: userEmail! })).toBeVisible();
  });
});
