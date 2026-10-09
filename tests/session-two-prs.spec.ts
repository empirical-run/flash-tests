import { test, expect } from "./fixtures";
import {
  createBranchFromStaging,
  getBranchSha,
  deleteBranch,
  setProtectedBranch,
} from "./pages/github";
import { generateUniqueBranchName } from "./pages/branch-name";
import { getCommitCardForSha, getDisplayedPrHead } from './pages/session-runtime-proof';
import {
  createSessionWithBranch,
  getSessionComposer,
  mergePrFromSession,
  navigateToSessions,
  waitForAgentIdle,
  waitForFirstMessage,
  waitForPRButton,
} from "./pages/sessions";

test.describe('Session with 2 PRs', () => {
  let branchName: string;
  
  test.beforeEach(async () => {
    branchName = generateUniqueBranchName('two-prs-test');
  });

  test.afterEach(async ({ page }) => {
    await setProtectedBranch(page, branchName, false);
    await deleteBranch(page, branchName);
  });

  test('create session with 2 PRs from different messages', async ({ page, trackCurrentSession }) => {
    // Step 1: Create and protect a new branch via the GitHub proxy and project APIs
    await createBranchFromStaging(page, branchName);
    await setProtectedBranch(page, branchName, true);
    const deletionBaseSha = await getBranchSha(page, branchName);
    
    // Step 2: Navigate to homepage and create session
    await navigateToSessions(page);

    // Create session with base branch
    const deletionBranch = `${branchName}-delete`;
    const restoreBranch = `${branchName}-restore`;
    const message1 = `Fetch and check out the current base branch ${branchName}, then create a new branch ${deletionBranch} FROM that base BEFORE changing files or committing. View tests/login.spec.ts, delete it, commit and push the deletion, and create a PR from ${deletionBranch} into ${branchName}. Do these actions one by one, not in parallel.`;
    await createSessionWithBranch(page, message1, branchName);
    trackCurrentSession(page);
    
    // Wait for the session chat page to load
    await waitForFirstMessage(page);

    await waitForPRButton(page, 300000);
    await waitForAgentIdle(page, 120000);
    const firstPr = await getDisplayedPrHead(page, branchName, deletionBranch, deletionBaseSha);
    const messages = page.getByRole('region', { name: 'Messages' });
    const deletionCommitCard = getCommitCardForSha(messages, firstPr.sha);
    await expect(deletionCommitCard, 'The actual pushed deletion SHA must have a real UI card').toHaveCount(1, { timeout: 120000 });
    await expect(deletionCommitCard).toBeVisible();
    await deletionCommitCard.getByRole('button', { name: 'View changes', exact: true }).click();

    const commitReview = page.getByRole('dialog', { name: /^Commit [a-f0-9]{7}$/i });
    await expect(commitReview).toHaveAccessibleName(`Commit ${firstPr.sha.slice(0, 7)}`);
    await expect(commitReview.getByText('tests/login.spec.ts').first()).toBeVisible({ timeout: 120000 });
    await expect(commitReview.getByText(/-\d+/).first()).toBeVisible({ timeout: 120000 });
    await commitReview.getByRole('button', { name: 'Close' }).click();
    
    // Step 5: Wait for first PR to be created — use the PR button in the session header
    // which appears deterministically whenever a PR is created, regardless of which tool was used
    await waitForPRButton(page, 300000);
    
    // Steps 6-7: mergePrFromSession's GitHub-API check of the actual PR base is now
    // the sole safety net against merging this deletion into a shared branch; there
    // is no earlier UI-side base-branch check. It then merges via the Review UI,
    // closes the dialog, and asserts the header flipped to "Merged".
    await mergePrFromSession(page, branchName);

    // Step 8: Wait for the session to return to idle state (send button replaces stop/steer buttons)
    // After merging, the agent may still be running. We need to wait for it to finish.
    await expect(page.locator('button[name="send"]')).toBeVisible({ timeout: 90000 });
    
    // Independently capture the updated owned base BEFORE the second commit.
    const restoreBaseSha = await getBranchSha(page, branchName);
    expect(restoreBaseSha).not.toBe(deletionBaseSha);
    // Send second message to create another PR
    await getSessionComposer(page).click();
    const message2 = `The first PR has merged into ${branchName}. BEFORE editing, committing or pushing, fetch origin and create a NEW branch ${restoreBranch} from the CURRENT origin/${branchName}. Then create tests/login.spec.ts that clicks the login button and inputs a dummy email; commit and push that change, and create a NEW PR from ${restoreBranch} into ${branchName}. Establish the current base before committing; do not rebase or amend the commit after creating it.`;
    await getSessionComposer(page).fill(message2);
    await page.locator('button[name="send"]').click();
    
    // Step 9/10: Wait for the second PR button to appear in the session header.
    // After the first PR is merged its button changes state (no longer matches /PR #\d+/),
    // so waitForPRButton here reliably waits for the newly created second PR.
    await waitForPRButton(page, 300000);
    
    await waitForAgentIdle(page, 120000);
    const secondPr = await getDisplayedPrHead(page, branchName, restoreBranch, restoreBaseSha);
    expect(secondPr.number).not.toBe(firstPr.number);
    expect(secondPr.sha).not.toBe(firstPr.sha);
    const secondPrompt = page.locator('[data-slot="message-scroller-item"]').filter({ hasText: message2 });
    await expect(secondPrompt).toHaveCount(1);
    const secondResponse = secondPrompt.locator('xpath=following-sibling::*[@data-slot="message-scroller-item"]');
    const secondCommitCard = getCommitCardForSha(secondResponse, secondPr.sha);
    // Missing rewritten-head metadata is an app blocker, never an API-diff fallback.
    await expect(secondCommitCard, 'APP blocker: pushed second-PR head has no displayed commit card').toHaveCount(1, { timeout: 120000 });
    await expect(secondCommitCard).toBeVisible();
    await expect(getCommitCardForSha(secondResponse, firstPr.sha)).toHaveCount(0);
    await expect(deletionCommitCard).not.toHaveAttribute('title', `Commit ${secondPr.sha}`);
    await secondCommitCard.getByRole('button', { name: 'View changes', exact: true }).click();
    await expect(commitReview).toHaveAccessibleName(`Commit ${secondPr.sha.slice(0, 7)}`);
    await expect(commitReview.getByText('Unable to load this commit', { exact: false }), 'APP blocker: the correct pushed-head card cannot load').toHaveCount(0);
    await expect(commitReview.getByText('tests/login.spec.ts').first()).toBeVisible({ timeout: 120000 });
    await expect(commitReview.getByText(/\+\d+/).first()).toBeVisible({ timeout: 120000 });
    await commitReview.getByRole('button', { name: 'Close' }).click();
    
  });
});
