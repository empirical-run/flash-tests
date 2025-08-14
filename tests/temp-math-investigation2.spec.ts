import { test, expect } from '@playwright/test';

test('investigate exact math response format', async ({ page }) => {
  await page.goto('/');
  
  // TODO(agent on page): Navigate to sessions, create a new session, and ask "Stop and answer: what is 12 + 12? (keyboard shortcuts only)" then check what the response looks like
});