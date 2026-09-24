import { test, expect } from "./fixtures";
import {
  createBranchFromStaging,
  deleteBranch,
  setProtectedBranch,
} from "./pages/github";
import { generateUniqueBranchName } from "./pages/branch-name";
import {
  createSessionWithBranch,
  expectSessionBaseBranch,
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
    
    // Step 2: Navigate to homepage and create session
    await navigateToSessions(page);

    // Create session with base branch
    const message1 = 'view tests/login.spec.ts, delete it, and create a pr - do these actions one by one, not in parallel';
    await createSessionWithBranch(page, message1, branchName);
    trackCurrentSession(page);
    
    // Wait for the session chat page to load
    await waitForFirstMessage(page);

    // Guardrail: fail fast if the base-branch fill silently failed and the session
    // fell back to the default "staging" branch. This must happen before any
    // destructive merge so we never merge a delete PR into a shared branch.
    await expectSessionBaseBranch(page, branchName);
    
    // Steps 3-4: The agent's completed file deletion is now represented by a commit card,
    // rather than the old "Used bash" tool bubble. Wait for the change and for the full turn
    // to finish before checking the PR created from that deletion.
    const deletionCommitCard = page.getByRole('button', { name: /\bCommit created\b.*\bView changes\b/i }).last();
    await expect(deletionCommitCard).toBeVisible({ timeout: 120000 });
    await expect(deletionCommitCard).toContainText('tests/login.spec.ts');
    await expect(deletionCommitCard).toContainText('+0');
    await expect(deletionCommitCard).toContainText(/-\d+/);
    await waitForAgentIdle(page, 120000);
    
    // Step 5: Wait for first PR to be created — use the PR button in the session header
    // which appears deterministically whenever a PR is created, regardless of which tool was used
    await waitForPRButton(page, 300000);
    
    // Steps 6-7: Open the header Review UI and merge the first PR. mergePrFromSession
    // closes the Review dialog and asserts the header flipped to "Merged".
    await mergePrFromSession(page, branchName);
    
    // Step 8: Wait for the session to return to idle state (send button replaces stop/steer buttons)
    // After merging, the agent may still be running. We need to wait for it to finish.
    await expect(page.locator('button[name="send"]')).toBeVisible({ timeout: 90000 });
    
    // Send second message to create another PR
    await page.getByRole('textbox', { name: 'Type your message here...' }).click();
    const message2 = 'create login.spec.ts that clicks the login button, inputs a dummy email, and create a pr';
    await page.getByRole('textbox', { name: 'Type your message here...' }).fill(message2);
    await page.locator('button[name="send"]').click();
    
    // Step 9/10: Wait for the second PR button to appear in the session header.
    // After the first PR is merged its button changes state (no longer matches /PR #\d+/),
    // so waitForPRButton here reliably waits for the newly created second PR.
    await waitForPRButton(page, 300000);
    
    // Verify there's at least one PR button visible (the second one, as first is merged)
    await waitForPRButton(page, 15000);
    
  });
});
