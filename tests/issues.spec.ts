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
    
    // Navigate to Test Runs page to find a completed test
    await page.getByRole('link', { name: 'Test Runs', exact: true }).click();
    
    // Wait for test runs page to load
    await expect(page).toHaveURL(/test-runs$/, { timeout: 10000 });
    
    // Find and click on the first completed test run (look for one that has "Run logs" button)
    // Wait for the table to load first
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10000 });
    
    // Click on the first test run row to open the details
    await page.locator('table tbody tr').first().click();
    
    // Wait for test run details page to load
    await expect(page).toHaveURL(/test-runs\//, { timeout: 10000 });
    
    // Look for "New triage session" button next to "Run logs" button
    await expect(page.getByRole('button', { name: 'New triage session' })).toBeVisible({ timeout: 10000 });
    
    // Click on "New triage session" button
    await page.getByRole('button', { name: 'New triage session' }).click();
    
    // Verify we're redirected to a new session page
    await expect(page).toHaveURL(/sessions\//, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Extract session ID from the current URL for later verification
    const sessionUrl = page.url();
    const sessionIdMatch = sessionUrl.match(/\/sessions\/([^/?#]+)/);
    const sessionId = sessionIdMatch ? sessionIdMatch[1] : null;
    expect(sessionId).toBeTruthy();
    
    // Send message to create an issue with timestamp
    const issueMessage = `create an issue with title Foo ${timestamp} and description Bar ${timestamp}`;
    await page.getByPlaceholder('Type your message').click();
    await page.getByPlaceholder('Type your message').fill(issueMessage);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify the message was sent and appears in the conversation
    await expect(page.getByText(issueMessage)).toBeVisible({ timeout: 10000 });
    
    // Assert that create issue tool is used - wait for tool execution
    await expect(page.getByText("Running createIssue").or(page.getByText("Running create_issue"))).toBeVisible({ timeout: 45000 });
    
    // Wait for tool execution to complete
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
    
    // Wait for issue details page to load
    await expect(page).toHaveURL(/issues\//, { timeout: 10000 });
    
    // Assert triage session id is visible (same number as the session we created)
    await expect(page.getByText(sessionId)).toBeVisible({ timeout: 10000 });
    
    // Click on session id to open session page
    await page.getByText(sessionId).click();
    
    // Verify we're redirected back to the session page
    await expect(page).toHaveURL(new RegExp(`sessions/${sessionId}`), { timeout: 10000 });
    
    // Session will be automatically closed by afterEach hook
  });
});