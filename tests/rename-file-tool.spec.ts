import { test, expect } from "./fixtures";
import { createSession, getToolDetails, navigateToSessions, waitForAgentIdle } from "./pages/sessions";

test('bash file operations: grep, create/delete, and rename', async ({ page, trackCurrentSession, trackRemoteBranch }) => {
  await navigateToSessions(page);

  // A fixed branch would collide when this test overlaps across workers or full runs.
  // The fixture deletes this distinctively-prefixed branch through GitHub after the
  // assertions, including when a later assertion fails.
  const branchName = `flash-test-rename-login-${Date.now()}-${process.pid}`;
  trackRemoteBranch('empirical-run/test-generator', branchName);

  // Single session that exercises grep, write/delete, and rename via bash
  const prompt = [
    "Do these tasks in order, one by one. Use bash for all tasks:",
    "1. Search for files containing 'login'.",
    "2. Create tests/demo.spec.ts with just a comment '// this is test file', then run a separate bash command `rm tests/demo.spec.ts` to delete it.",
    `3. Run exactly one bash command for the rename, commit, and push: \`branch=${branchName} && git switch -c "$branch" && mkdir -p tests/login && mv tests/login.spec.ts tests/login/index.spec.ts && git add tests/login.spec.ts tests/login/index.spec.ts && git commit -m "Move login.spec.ts to login/index.spec.ts" && git push -u origin "$branch"\`.`,
  ].join(' ');

  await createSession(page, prompt);
  await expect(page).toHaveURL(/sessions\/[^\/]+/);
  trackCurrentSession(page);

  // 1. Grep. The UI may summarize intermediate bash calls, so assert the
  // assistant's response mentions the file found by the search.
  await expect(page.getByText(/login\.spec\.ts/).first()).toBeVisible({ timeout: 120000 });

  // 2. Create then delete. Assert the task summary mentions the demo file instead
  // of relying on every intermediate bash label.
  await expect(page.getByText(/demo\.spec\.ts/).first()).toBeVisible({ timeout: 120000 });

  // 3. A bash command that creates a git commit is represented by a commit card,
  // rather than a completed bash-tool marker. Open its code changes panel.
  const commitCard = page.getByRole('button', { name: /\bCommit created\b.*\bView changes\b/i }).last();
  await expect(commitCard).toBeVisible({ timeout: 120000 });
  await waitForAgentIdle(page, 120000);
  await expect(commitCard).toContainText('Move login.spec.ts to login/index.spec.ts');
  await commitCard.getByRole('button', { name: 'View changes', exact: true }).click();

  const codeChanges = await getToolDetails(page);
  await expect(codeChanges.getByText('Code Changes')).toBeVisible();

  // Verify the pushed commit's rename details are rendered in the panel.
  await expect(codeChanges.getByText(/tests\/login\.spec\.ts/).last()).toBeVisible({ timeout: 120000 });
  await expect(codeChanges.getByText(/tests\/login\/index\.spec\.ts/).last()).toBeVisible();

  // Session will be automatically closed by afterEach hook
});
