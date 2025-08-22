import { test, expect } from "./fixtures";

test.describe('Issues Tests', () => {
  test('open issues page', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Click on Issues in the sidebar
    await page.getByRole('link', { name: 'Issues', exact: true }).click();
    
    // Wait for issues page to load
    await expect(page).toHaveURL(/issues$/, { timeout: 10000 });
    
    // Verify the Issues page loaded with the page heading visible
    await expect(page.getByText('Issues (')).toBeVisible({ timeout: 10000 });
  });

  test('create triage session, create issue with timestamp, verify issue and session link', async ({ page, trackCurrentSession }) => {
    // Generate unique timestamp for this test
    const timestamp = Date.now();
    
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions page
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Wait for sessions page to load
    await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Create a new session
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Extract session ID from the current URL
    const sessionUrl = page.url();
    const sessionIdMatch = sessionUrl.match(/\/sessions\/([^/?#]+)/);
    const sessionId = sessionIdMatch ? sessionIdMatch[1] : null;
    expect(sessionId).toBeTruthy();
    
    // PATCH session source to set it to triage using API call
    const patchResponse = await page.request.patch(`/api/chat-sessions/${sessionId}`, {
      data: {
        source: 'triage'
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('PATCH response status:', patchResponse.status());
    const responseText = await patchResponse.text();
    console.log('PATCH response body:', responseText);
    
    // Send message to create an issue with timestamp
    const issueMessage = `create an issue with title Foo ${timestamp} and description Bar ${timestamp}`;
    await page.getByPlaceholder('Type your message').click();
    await page.getByPlaceholder('Type your message').fill(issueMessage);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify the message was sent and appears in the conversation
    await expect(page.getByText(issueMessage)).toBeVisible({ timeout: 10000 });
    
    // Assert that create issue tool was used - wait for tool execution to complete
    await expect(page.getByText("Used createIssue").or(page.getByText("Used create_issue"))).toBeVisible({ timeout: 45000 });
    
    // Click on the tool execution result to assert issue created successfully is shown
    await page.getByText("Used createIssue").or(page.getByText("Used create_issue")).click();
    
    // Assert issue created successfully message or response is visible
    await expect(page.getByText("successfully").or(page.getByText("created")).first()).toBeVisible({ timeout: 10000 });
    
    // Go to issues tab
    await page.getByRole('link', { name: 'Issues', exact: true }).click();
    
    // Wait for issues page to load
    await expect(page).toHaveURL(/issues$/, { timeout: 10000 });
    
    // Assert Foo timestamp is visible and click it
    await expect(page.getByText(`Foo ${timestamp}`)).toBeVisible({ timeout: 10000 });
    await page.getByText(`Foo ${timestamp}`).click();
    
    // Wait for issue details page to load (uses query parameter format)
    await expect(page).toHaveURL(/issues\?issueId=/, { timeout: 10000 });
    
    // Assert triage session id is visible (same number as the session we created)
    // Use first() to handle multiple occurrences of the session ID
    await expect(page.getByText(sessionId).first()).toBeVisible({ timeout: 10000 });
    
    // Click on session id to open session page
    await page.getByText(sessionId).first().click();
    
    // Verify we're redirected back to the session page
    await expect(page).toHaveURL(new RegExp(`sessions/${sessionId}`), { timeout: 10000 });
    
    // Session will be automatically closed by afterEach hook
  });
});