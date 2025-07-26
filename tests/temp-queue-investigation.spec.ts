import { test, expect } from "./fixtures";

test.describe('Queue Investigation', () => {
  test('investigate queue functionality', async ({ page }) => {
    await page.goto('/');
    // TODO(agent on page): Navigate to sessions, create new session, send a tool execution message, wait for it to start running, then queue a message "What is 2 + 2?" and observe what happens in the UI
  });
});