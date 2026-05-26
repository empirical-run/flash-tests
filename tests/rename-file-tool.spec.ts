import { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { createSession, getSessionIdFromUrl, navigateToSessions } from "./pages/sessions";

async function getSuccessfulBashCommands(page: Page, sessionId: string): Promise<string[]> {
  const response = await page.request.get(`https://pi-worker.empirical.run/sessions/pi-session/chat_session_${sessionId}/session-entries`, {
    params: { page: '1', per_page: '100' },
  });
  if (!response.ok()) return [];

  const body = await response.json();
  const toolCalls = new Map<string, string>();
  const successfulToolCallIds = new Set<string>();

  for (const entry of body.data?.entries ?? []) {
    for (const part of entry.message?.content ?? []) {
      if (part.type === 'toolCall' && part.name === 'bash' && typeof part.arguments?.command === 'string') {
        toolCalls.set(part.id, part.arguments.command);
      }
    }

    if (entry.message?.role === 'toolResult' && entry.message.toolName === 'bash' && entry.message.isError === false) {
      successfulToolCallIds.add(entry.message.toolCallId);
    }
  }

  return [...successfulToolCallIds]
    .map(toolCallId => toolCalls.get(toolCallId))
    .filter((command): command is string => Boolean(command));
}

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
  const sessionId = getSessionIdFromUrl(page);

  // 1. Grep — agent uses bash to grep (shows as "Used bash: grep ... title ...")
  await expect(page.getByText(/Used bash:.*grep.*title/).first()).toBeVisible({ timeout: 120000 });
  // Verify the agent's summary confirms example.spec.ts was found
  await expect(
    page.locator('[data-message-id]').filter({ hasText: /example\.spec\.ts/ }).first()
  ).toBeVisible({ timeout: 60000 });

  // 2. Create then delete — the UI can truncate or group tool labels, so verify the
  // underlying successful bash tool commands from the session entries API.
  await expect.poll(
    async () => getSuccessfulBashCommands(page, sessionId),
    { timeout: 120000, message: 'successful bash command created demo.spec.ts' }
  ).toContainEqual(expect.stringMatching(/demo\.spec\.ts/));
  await expect.poll(
    async () => getSuccessfulBashCommands(page, sessionId),
    { timeout: 120000, message: 'successful bash command deleted demo.spec.ts' }
  ).toContainEqual(expect.stringMatching(/\brm\b[\s\S]*demo\.spec\.ts/));

  // 3. Rename via bash mv + git commit. Assert the actual successful tool commands,
  // rather than only the compact UI labels, so grouped tool displays remain covered.
  await expect.poll(
    async () => getSuccessfulBashCommands(page, sessionId),
    { timeout: 120000, message: 'successful bash command renamed example.spec.ts' }
  ).toContainEqual(expect.stringMatching(/\bmv\b[\s\S]*example\.spec\.ts[\s\S]*example\/index\.spec\.ts/));
  await expect.poll(
    async () => getSuccessfulBashCommands(page, sessionId),
    { timeout: 120000, message: 'successful git commit command ran' }
  ).toContainEqual(expect.stringMatching(/\bgit\b[\s\S]*\bcommit\b/));

  // Session will be automatically closed by afterEach hook
});
