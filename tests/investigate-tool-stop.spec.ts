import { test, expect } from "@playwright/test";
import { chordFor } from './utils';
import { getCurrentPlatform } from './utils';
import os from 'os';

test.describe('Tool Stop Investigation', () => {
  test('investigate tool stop functionality and rejection message', async ({ page }) => {
    await page.goto('/');
    // TODO(agent on page): Create session, start tool execution (like file view), try to stop it with keyboard shortcut, and check what rejection message appears and when. Also check if the input becomes re-enabled after stopping.
  });
});