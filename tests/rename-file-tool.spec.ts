import { test, expect } from "./fixtures";
import { createSession, navigateToSessions } from "./pages/sessions";

test('bash file operations: grep, create/delete, and rename', async ({ page, trackCurrentSession }) => {
  await navigateToSessions(page);

  // Single session that exercises grep, write/delete, and rename via bash
  const prompt = [
    "Do these tasks in order, one by one. Use bash for all tasks:",
    "1. Search for files containing 'title'.",
    "2. Create tests/demo.spec.ts with just a comment '// this is test file', then run a separate bash command `rm tests/demo.spec.ts` to delete it.",
    "3. Rename example.spec.ts to example/index.spec.ts using a bash command with `mv`, then commit the rename.",
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

  // 3. Rename via bash mv + git commit.
  await expect(page.getByText(/Used bash:.*\bmv\b.*example\.spec\.ts.*example\/index\.spec\.ts/).first()).toBeVisible({ timeout: 120000 });
  await expect(page.getByText(/Used bash:.*git.*commit/).first()).toBeVisible({ timeout: 120000 });

  // Session will be automatically closed by afterEach hook
});
