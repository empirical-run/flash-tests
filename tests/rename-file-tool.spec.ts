import { test, expect } from "./fixtures";
import { createSession, navigateToSessions } from "./pages/sessions";

test('bash file operations: grep, create/delete, and rename', async ({ page, trackCurrentSession }) => {
  await navigateToSessions(page);

  // Single session that exercises grep, write/delete, and rename via bash
  const prompt = [
    "Do these tasks in order, one by one. Use bash for all tasks:",
    "1. Search for files containing 'title'.",
    "2. Create tests/demo.spec.ts with just a comment '// this is test file', then run a separate bash command `rm tests/demo.spec.ts` to delete it.",
    "3. Run exactly one bash command for the rename and commit: `mkdir -p tests/example && mv tests/example.spec.ts tests/example/index.spec.ts && git add tests/example.spec.ts tests/example/index.spec.ts && git commit -m \"Move example.spec.ts to example/index.spec.ts\"`.",
  ].join(' ');

  await createSession(page, prompt);
  await expect(page).toHaveURL(/sessions\/[^\/]+/);
  trackCurrentSession(page);

  // 1. Grep — agent uses bash to grep (shows as "Used bash: grep ... title ...")
  await expect(page.getByText(/Used bash:.*grep.*title/).first()).toBeVisible({ timeout: 120000 });
  // Verify the agent's summary confirms example.spec.ts was found
  await expect(
    page.locator('[data-message-id]').filter({ hasText: /example\.spec\.ts/ }).first()
  ).toBeVisible({ timeout: 60000 });

  // 2. Create then delete. The prompt asks for a separate rm command so the delete
  // operation remains directly observable in the tool execution list.
  await expect(page.getByText(/Used bash:(?!.*\brm\b).*demo\.spec\.ts/).first()).toBeVisible({ timeout: 120000 });
  await expect(page.getByText(/Used bash:.*\brm\b.*demo\.spec\.ts/).first()).toBeVisible({ timeout: 120000 });

  // 3. Rename via bash mv + git commit. The chat bubble truncates long commands,
  // so open the actual bash tool details and assert against the full tool input.
  const renameAndCommitTool = page.getByTestId('used-bash').filter({
    hasText: /Used bash:.*\bmv\b.*example\.spec/i,
  }).first();
  await expect(renameAndCommitTool).toBeVisible({ timeout: 120000 });
  await renameAndCommitTool.click();
  await page.getByRole('button', { name: 'Tool Input' }).click();
  const toolInput = page.locator('pre');
  await expect(toolInput.getByText(/\bmv\b.*example\.spec\.ts.*example\/index\.spec\.ts/).first()).toBeVisible();
  await expect(toolInput.getByText(/git.*commit/).first()).toBeVisible();

  // Session will be automatically closed by afterEach hook
});
