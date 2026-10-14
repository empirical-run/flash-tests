import { test, expect } from "./fixtures";
import { generateUniqueBranchName } from "./pages/branch-name";
import { getBranchSha } from "./pages/github";
import { expectPushedLoginEmailChange } from "./pages/impacted-tests-review";
import {
  getCommitCardForSha,
  getCommitCards,
} from "./pages/session-runtime-proof";
import {
  createSession,
  navigateToSessions,
  openReviewPanel,
  waitForAgentIdle,
} from "./pages/sessions";

test.describe("Impacted Tests Review", () => {
  // This inner hook runs before fixtures.ts's outer cleanup hook, including
  // after a failed UI assertion. The modal otherwise makes the composer inert.
  test.afterEach(async ({ page }) => {
    const reviewDialog = page.getByRole("dialog").filter({
      has: page.getByRole("tab", { name: /^Impacted Tests/ }),
    });
    if (await reviewDialog.isVisible()) {
      await reviewDialog
        .getByRole("button", { name: "Close", exact: true })
        .click();
      await expect(reviewDialog).toBeHidden();
    }
  });

  test("create session, modify test, and verify impacted tests in review tab", async ({
    page,
    trackCurrentSession,
    trackRemoteBranch,
  }) => {
    await navigateToSessions(page);

    // Pin the parent and ask this session to author/push on its own branch.
    // Register it before creation so assertion failures still trigger cleanup.
    const baseSha = await getBranchSha(page, "staging");
    const branchName = generateUniqueBranchName("flash-test-impacted-login");
    trackRemoteBranch("empirical-run/lorem-ipsum-tests", branchName);
    const message = `Fetch origin staging, then create and switch to a new branch ${branchName} from commit ${baseSha} BEFORE editing. Modify the test in tests/login.spec.ts to use user@example.com as the input email. Make no other change. Then commit and push the change to origin on ${branchName}. Do not amend or rebase after committing; do not create a PR.`;
    await createSession(page, message);
    trackCurrentSession(page);

    // Tool choice/collapsed summaries are not the objective. Require the real
    // owned pushed card (enabled View changes, no Not pushed), then an idle turn.
    const messages = page.getByRole("region", { name: "Messages" });
    const ownedCommitCards = getCommitCards(messages).filter({
      has: page.getByText(branchName, { exact: true }),
    });
    await expect(ownedCommitCards).toHaveCount(1, { timeout: 300000 });
    await expect(ownedCommitCards).toBeVisible({ timeout: 300000 });
    await waitForAgentIdle(page, 300000);

    // Independently bind the UI card to the owned remote's full SHA and verify
    // the persisted email-only diff. This does NOT replace the Review UI below.
    const sha = await expectPushedLoginEmailChange(page, branchName, baseSha);
    const commitCard = getCommitCardForSha(messages, sha).filter({
      has: page.getByText(branchName, { exact: true }),
    });
    await expect(commitCard).toHaveCount(1);
    await expect(commitCard).toBeVisible();
    await expect(
      commitCard.getByRole("button", { name: "View changes", exact: true }),
    ).toBeEnabled();

    // Keep both real reloads: impacted tests must survive session rehydration.
    await page.reload();
    await page.reload();
    await expect(commitCard).toBeVisible({ timeout: 60000 });

    const reviewDialog = await openReviewPanel(page);
    const impactedTests = reviewDialog.getByRole("tab", {
      name: "Impacted Tests (1)",
      exact: true,
    });
    await expect(impactedTests).toBeVisible({ timeout: 60000 });
    await impactedTests.click();
    await expect(impactedTests).toHaveAttribute("aria-selected", "true");

    // The title uniquely identifies the actual list item, not a detail heading.
    const impactedRow = reviewDialog.getByTitle(
      "click login button and input dummy email",
      { exact: true },
    );
    await expect(impactedRow).toHaveCount(1);
    await expect(impactedRow).toBeVisible();

    // Existing automatic teardown deletes/verifies only this owned branch and
    // closes this tracked session, including when the assertions fail.
  });
});
