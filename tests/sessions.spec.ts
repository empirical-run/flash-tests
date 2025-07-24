import { test, expect } from "./fixtures";

test.describe('Sessions Tests', () => {
  test('Sort sessions by title', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum")).toBeVisible();
    
    // Navigate to Sessions page
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Wait for sessions page to load
    await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Click on the Title column header to sort by title
    // This is expected to crash the page currently
    await page.getByRole('cell', { name: 'Title' }).click();
    
    // If the page doesn't crash, we would expect to see the sessions sorted by title
    // This assertion will likely fail due to the crash
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
  });

  test('Close session and verify session state', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum")).toBeVisible();
    
    // Navigate to Sessions page
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Wait for sessions page to load
    await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Create a new session
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Send a message with unique identifier to make the session easily identifiable
    const uniqueId = `test-session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const message = `Close session test - ${uniqueId}`;
    await page.getByPlaceholder('Type your message').click();
    await page.getByPlaceholder('Type your message').fill(message);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify the message was sent and appears in the conversation
    await expect(page.getByText(message)).toBeVisible({ timeout: 10000 });
    
    // Get the session ID from the current URL before closing
    const sessionUrl = page.url();
    const sessionId = sessionUrl.split('/').pop();
    
    // Click on Details tab to access session management options
    await page.getByRole('tab', { name: 'Details', exact: true }).click();
    
    // Close the session
    await page.getByRole('button', { name: 'Close Session' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    
    // Assert redirection to sessions list page (check for New button)
    await expect(page.getByRole('button', { name: 'New' })).toBeVisible({ timeout: 10000 });
    
    // Assert the closed session is not visible in the active sessions list
    // We can check this by ensuring the session ID or session content is not present
    await expect(page.getByText(message)).not.toBeVisible();
    
    // Navigate back to the specific session page via URL to check closed status
    await page.goto(sessionUrl);
    
    // Assert "Session Closed" button is visible
    await expect(page.getByRole('button', { name: 'Session Closed', exact: true })).toBeVisible({ timeout: 10000 });
  });



  test('investigate HTML paste behavior', async ({ page }) => {
    await page.goto('/');
    // TODO(agent on page): Navigate to Sessions, create a new session, try pasting HTML content with hyperlink using clipboard API, then send message and check what appears in the chat
  });

  test('Rich text paste on chat input', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum")).toBeVisible();
    
    // Navigate to Sessions page
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Wait for sessions page to load
    await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Create a new session
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Prepare rich text content with hyperlink in clipboard
    // This simulates copying rich text with hyperlink from another application (like copying from a website)
    // The clipboard should contain both HTML and plain text versions
    const htmlContent = `<a href="https://example.com">Visit Example</a>`;
    const plainTextContent = `Visit Example`;
    
    await page.evaluate(async (data) => {
      // Create a rich text representation in clipboard
      const clipboardItem = new ClipboardItem({
        'text/html': new Blob([data.html], { type: 'text/html' }),
        'text/plain': new Blob([data.plain], { type: 'text/plain' })
      });
      await navigator.clipboard.write([clipboardItem]);
    }, { html: htmlContent, plain: plainTextContent });
    
    // Click on the chat input field - use the correct placeholder text
    await page.getByRole('textbox', { name: 'Type your message here...' }).click();
    
    // Paste the rich text content using keyboard shortcut
    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+KeyV' : 'Control+KeyV');
    
    // Send the message
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify that the hyperlink is preserved in the message
    // The expectation is that when rich HTML is pasted, it should preserve the hyperlink
    // Currently this should fail as only the plain text appears, not the hyperlink
    await expect(page.locator('a[href="https://example.com"]').getByText('Visit Example')).toBeVisible({ timeout: 10000 });
  });
});