import { test, expect } from "./fixtures";
import { createSession, getBashToolCall, navigateToSessions } from "./pages/sessions";

test('bash file operations: grep, create/delete, and rename', async ({ page, trackCurrentSession }) => {
  await navigateToSessions(page);

  // Single session that exercises grep, write/delete, and rename via bash
  const prompt = [
    "Do these tasks in order, one by one. Use bash for all tasks:",
    "1. Search for files containing 'login'.",
    "2. Create tests/demo.spec.ts with just a comment '// this is test file', then run a separate bash command `rm tests/demo.spec.ts` to delete it.",
    "3. Run exactly one bash command for the rename and commit: `mkdir -p tests/login && mv tests/login.spec.ts tests/login/index.spec.ts && git add tests/login.spec.ts tests/login/index.spec.ts && git commit -m \"Move login.spec.ts to login/index.spec.ts\"`.",
  ].join(' ');

  await createSession(page, prompt);
  await expect(page).toHaveURL(/sessions\/[^\/]+/);
  trackCurrentSession(page);

  // 1. Grep. The UI may summarize intermediate bash calls, so assert the
  // assistant's task summary confirms the search result.
  await expect(
    page.locator('[data-message-id]').filter({ hasText: /Searched for files containing ['"]login['"]/i }).last()
  ).toBeVisible({ timeout: 120000 });
  await expect(
    page.locator('[data-message-id]').filter({ hasText: /login\.spec\.ts/ }).first()
  ).toBeVisible({ timeout: 60000 });

  // 2. Create then delete. Assert the task summary mentions the demo file was
  // created and deleted instead of relying on every intermediate bash label.
  await expect(
    page.locator('[data-message-id]').filter({ hasText: /Created[\s\S]*deleted[\s\S]*demo\.spec\.ts/i }).last()
  ).toBeVisible({ timeout: 120000 });

  // 3. Rename via bash mv + git commit. The chat bubble truncates long commands,
  // so open the actual bash tool details and assert against the full tool input.
  const renameAndCommitTool = getBashToolCall(page, /\bmv\b[\s\S]*login\.spec/i, 'used').first();
  await expect(renameAndCommitTool).toBeVisible({ timeout: 120000 });
  await renameAndCommitTool.click();
  await page.getByRole('button', { name: 'Tool Input' }).click();
  const toolInput = page.locator('pre');
  await expect(toolInput.getByText(/\bmv\b.*login\.spec\.ts.*login\/index\.spec\.ts/).first()).toBeVisible();
  await expect(toolInput.getByText(/git.*commit/).first()).toBeVisible();

  // Session will be automatically closed by afterEach hook
});
