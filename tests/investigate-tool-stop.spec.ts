import { test, expect } from "@playwright/test";
import { chordFor, detectOSBrowser } from './utils';

test.describe('Tool Stop Investigation', () => {
  test('investigate tool stop functionality and rejection message', async ({ page }) => {
    await page.goto('/');
    // TODO(agent on page): Create session, start tool execution (like file view), try to stop it with keyboard shortcut, and check what rejection message appears and when. Also check if the input becomes re-enabled after stopping.
  });

  test('investigate stopping longer tool execution', async ({ page }) => {
    await page.goto('/');
    // TODO(agent on page): Create session, start a potentially longer tool execution (like writing a large file or complex analysis), then quickly try to stop it using keyboard shortcut and see what rejection message appears
  });
});