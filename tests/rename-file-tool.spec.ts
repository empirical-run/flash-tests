import { test, expect } from "./fixtures";
import { createSession, navigateToSessions, expandToolOutput } from "./pages/sessions";

test('bash file operations: grep, create/delete, and rename', async ({ page, trackCurrentSession, withSandboxSession }) => {
  await navigateToSessions(page);

  // Single session that exercises grep, write/delete, and rename via bash
  const prompt = [
    "Do these tasks in order, one by one:",
    "1. Search for files containing 'title'.",
    "2. Create tests/demo.spec.ts with just a comment '// this is test file', then delete it.",
    "3. Rename example.spec.ts to example/index.spec.ts.",
  ].join(' ');

  await createSession(page, prompt);
  await expect(page).toHaveURL(/sessions\/[^\/]+/);
  trackCurrentSession(page);

  // 1. Grep
  await expect(page.getByText(/Used grep for "title"/).first()).toBeVisible({ timeout: 120000 });
  await page.getByText(/Used grep for "title"/).first().click();
  const toolOutputSection = await expandToolOutput(page);
  await expect(toolOutputSection.getByText('example.spec.ts', { exact: false }).first()).toBeVisible();

  // 2. Create then delete
  await expect(page.getByText(/Used write tool/).first()).toBeVisible({ timeout: 120000 });
  await expect(page.getByText(/Used bash:.*rm.*demo\.spec\.ts/).first()).toBeVisible({ timeout: 120000 });

  // 3. Rename via bash mv + git commit
  await expect(page.getByText(/Used bash:.*mv.*example\.spec\.ts/).first()).toBeVisible({ timeout: 120000 });
  await expect(page.getByText(/Used bash:.*git.*commit/).first()).toBeVisible({ timeout: 60000 });
  await expect(
    page.locator('[data-message-id]').filter({ hasText: /example\/index\.spec\.ts/ }).first()
  ).toBeVisible({ timeout: 30000 });

  // Session will be automatically closed by afterEach hook
  });

});
