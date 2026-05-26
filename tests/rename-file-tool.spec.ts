import { test, expect } from "./fixtures";
import { createSession, navigateToSessions } from "./pages/sessions";

test('bash file operations: grep, create/delete, and rename', async ({ page, trackCurrentSession }) => {
  await navigateToSessions(page);

  // Single session that exercises grep, write/delete, and rename via bash
  const prompt = [
    "Do these tasks in order, one by one. Use bash for all tasks:",
    "1. Search for files containing 'title'.",
    "2. Create tests/demo.spec.ts with just a comment '// this is test file', then delete it.",
    "3. Rename example.spec.ts to example/index.spec.ts.",
    "After task 2, include the phrase 'deleted tests/demo.spec.ts' in your response.",
    "After task 3, include the phrase 'renamed tests/example.spec.ts to tests/example/index.spec.ts' in your response.",
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

  // 2. Create then delete — the UI can truncate compound bash commands, so verify the
  // visible tool execution plus the agent's explicit completion summary.
  await expect(page.getByText(/Used bash:.*demo\.spec\.ts/).first()).toBeVisible({ timeout: 120000 });
  await expect(
    page.locator('[data-message-id]').filter({ hasText: /deleted tests\/demo\.spec\.ts/i }).first()
  ).toBeVisible({ timeout: 120000 });

  // 3. Rename via bash + git commit. In compact mode the individual mv command can be
  // grouped behind "Used N tools", so assert the commit tool and final rename summary.
  await expect(page.getByText(/Used bash:.*git.*commit/).first()).toBeVisible({ timeout: 120000 });
  await expect(
    page.locator('[data-message-id]').filter({ hasText: /renamed tests\/example\.spec\.ts to tests\/example\/index\.spec\.ts/i }).first()
  ).toBeVisible({ timeout: 60000 });

  // Session will be automatically closed by afterEach hook
});
