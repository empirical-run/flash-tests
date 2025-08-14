import { test, expect } from '@playwright/test';

test('investigate math response format', async ({ page }) => {
  await page.goto('/');
  
  // TODO(agent on page): Navigate to sessions, create a new session, and ask "what is 12 + 12?" then check what the response looks like
});