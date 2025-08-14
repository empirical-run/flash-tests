import { test, expect } from "./fixtures";
import { detectOSBrowser, chordFor, type OS } from "./utils";

test.describe('Clear Queue Investigation', () => {
  test('investigate clear queue status during tool execution', async ({ page, trackCurrentSession }) => {
    // Navigate to homepage
    await page.goto('/');

    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();

    // Navigate to Sessions page
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();

    // Create a new session
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByRole('button', { name: 'Create' }).click();

    // Verify we're in a session
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });

    // Track the session for automatic cleanup
    trackCurrentSession(page);

    // TODO(agent on page): Start tool execution by sending "what is inside package.json", then queue a message "test queue message", then try to clear the queue with Control+X, and check if there are any visual indicators showing the queue state or clear queue feedback
  });
});