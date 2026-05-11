import { test, expect } from "./fixtures";
import { createBranchFromStaging, deleteBranch } from "./pages/github";
import { generateUniqueBranchName } from "./pages/branch-name";
import { createSessionWithBranch, mergePrFromSession, navigateToSessions, sendMessage, waitForFirstMessage, waitForPRButton } from "./pages/sessions";
import { setVideoLabel } from '@empiricalrun/playwright-utils/test';

test.describe('Merge Conflicts Tool Tests', () => {
  let branchName: string;
  
  test.beforeEach(async () => {
    branchName = generateUniqueBranchName('merge-test');
  });

  test.afterEach(async ({ page }) => {
    const buildUrl = process.env.BUILD_URL || "https://dash.empirical.run";
    await deleteBranch(page, branchName, buildUrl);
  });

  test('create conflicting changes in two sessions and verify conflict handling', async ({ page, customContextPageProvider, trackCurrentSession }) => {
    // Step 1: Create a new branch via GitHub proxy API
    await createBranchFromStaging(page, branchName);
    
    // Step 2: Navigate to homepage and create session 1
    setVideoLabel(page, 'session-1');
    await navigateToSessions(page);
    
    // Create session 1 with base branch
    // Uses login.spec.ts which exists in staging; renames the test title to create a conflict
    const message1 = 'rename the test "click login button and input dummy email" in tests/login.spec.ts to "click login button and verify redirect" and create a pr';
    await createSessionWithBranch(page, message1, branchName);
    trackCurrentSession(page);
    
    // Wait for the session chat page to load
    await waitForFirstMessage(page);
    
    // Step 3: Create session 2 in a new tab with the same base branch
    const { page: page2, context: context2 } = await customContextPageProvider();
    
    // Set video label for session 2
    setVideoLabel(page2, 'session-2');
    await navigateToSessions(page2);
    
    // Create session 2 with the same base branch — rename same test to a different name to create a conflict
    const message2 = 'rename the test "click login button and input dummy email" in tests/login.spec.ts to "click login button and check email form" but don\'t create pr';
    await createSessionWithBranch(page2, message2, branchName);
    
    // Wait for the session chat page to load
    await waitForFirstMessage(page2);
    
    // Step 4: In session 1, wait for PR creation (agent may use edit tool or bash to edit the file)
    // App creates PRs via bash tool (curl to GitHub API proxy) — wait for PR button in header
    await waitForPRButton(page, 300000);
    console.log('✅ Session 1: PR created');
    
    // Step 5: In session 2, wait for the agent to edit login.spec.ts (via edit tool or bash)
    // Tighten the match to require the file path so exploration commands don't pass this gate prematurely
    await expect(page2.getByText(/Used edit tool|Used bash:.*login\.spec\.ts/i).first()).toBeVisible({ timeout: 120000 });
    console.log('✅ Session 2: File edited');
    
    // Step 6: Merge the PR from session 1
    await mergePrFromSession(page);
    console.log('✅ Session 1: PR merged');
    
    // Step 7: In session 2, explicitly request conflict resolution against the updated base
    // The base branch was just merged with conflicting changes, so the agent must fetch
    // the latest base, detect conflicts, resolve them, and update (or create) the PR
    await sendMessage(page2, `the base branch ${branchName} was just updated with new commits that conflict with your changes. fetch the latest base branch, resolve any merge conflicts, and create or update the PR`);
    
    // Step 8: Verify the agent fetched the updated base branch to detect conflicts
    // This must happen BEFORE the PR is created — conflict resolution then PR creation
    // App uses bash git commands instead of the deprecated checkForMergeConflicts tool
    await expect(page2.getByText(/Used bash.*(git fetch|git pull|git merge|git rebase)/i).first()).toBeVisible({ timeout: 120000 });
    console.log('✅ Session 2: Conflict resolution via bash git commands verified');
    
    // Step 9: Wait for PR creation/update in session 2 (via bash tool — curl to GitHub API proxy)
    await waitForPRButton(page2, 300000);
    console.log('✅ Session 2: PR created/updated');
    
    // Close session 2 context
    await context2.close();
    
    console.log('✅ Merge conflicts test completed successfully');
  });
});
