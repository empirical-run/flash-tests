import { test, expect } from "./fixtures";
import { createBranchFromStaging, deleteBranch } from "./pages/github";
import { generateUniqueBranchName } from "./pages/branch-name";
import {
  createSessionWithBranch,
  mergePrFromSession,
  navigateToSessions,
  openSessionInfoPanel,
  waitForFirstMessage,
  waitForPRButton,
} from "./pages/sessions";

/**
 * Regression test for test-generator#6714.
 *
 * Bug: merging a PR from the dashboard UI did NOT update the session's PR status.
 * The GitHub `pull_request(merged)` webhook handler threw while upserting the
 * pull_requests row (a raw JS Date was interpolated into a
 * `sql`COALESCE(merged_at, ${date})`` template, which postgres.js rejects). Because
 * the handler runs in `waitUntil`, the merge request still returned 200, but
 * `chat_sessions.pr_status` never advanced to "merged" — so the session header kept
 * showing the "Review PR #<n>" button (matches /PR #\d+/) instead of flipping to
 * "Merged". Only merges hit this path (the open path has merged_at=null).
 *
 * This test creates a session on a throwaway branch, has the agent create a PR,
 * merges it via the dashboard UI, and asserts the header transitions to "Merged".
 * The merge + assertion live in mergePrFromSession (via expectSessionPrMerged).
 */
test.describe("Session PR merge status", () => {
  let branchName: string;

  test.beforeEach(async () => {
    branchName = generateUniqueBranchName("pr-merge-status-test");
  });

  test.afterEach(async ({ page }) => {
    await deleteBranch(page, branchName);
  });

  test("merging a PR from the dashboard flips the session header to Merged", async ({ page, trackCurrentSession }) => {
    // Step 1: Create a fresh throwaway branch so the PR merge is non-destructive.
    await createBranchFromStaging(page, branchName);

    // Step 2: Create a session targeting that branch and ask the agent to make a
    // trivial README change and open a PR.
    await navigateToSessions(page);
    const timestamp = new Date().toISOString();
    const message = `update the README.md file to append a new line at the end with the exact text "PR merge status regression check ${timestamp}" - do this change without asking me anything else - use the str replace (edit) tool, not the insert tool - then create a pull request`;
    await createSessionWithBranch(page, message, branchName);
    trackCurrentSession(page);

    await waitForFirstMessage(page);

    // Guardrail: fail fast if the base-branch fill silently fell back to the default
    // "staging" branch. This must happen before the merge so we never merge into a
    // shared branch.
    await openSessionInfoPanel(page);
    await expect(page.getByText(`→ ${branchName}`)).toBeVisible({ timeout: 30000 });

    // Step 3: Wait for the agent to edit the README.
    await expect(page.getByText(/Used edit tool/).first()).toBeVisible({ timeout: 180000 });

    // Step 4: Wait for the PR to be created — the PR button appears in the session
    // header once the platform has linked the PR.
    await waitForPRButton(page, 300000);

    // Step 5: Merge the PR via the dashboard UI. mergePrFromSession asserts (via
    // expectSessionPrMerged) that the header flips to "Merged" and no "PR #<n>"
    // button remains — this is the regression assertion. Before the fix, the
    // header stayed on "Review PR #<n>" so this fails.
    await mergePrFromSession(page, branchName);
  });
});
