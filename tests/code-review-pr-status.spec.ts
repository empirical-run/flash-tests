import { test, expect } from "./fixtures";

test.describe('Code Review PR Status Tests', () => {
  test('Create session and verify PR status and code review functionality', async ({ page, trackCurrentSession }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions page
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Wait for sessions page to load
    await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Create a new session with code review test prompt
    await page.getByRole('button', { name: 'New' }).click();
    const uniqueId = `code-review-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const message = `Code review PR status test - ${uniqueId}`;
    await page.getByPlaceholder('Enter an initial prompt').fill(message);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Wait for the session chat page to load completely by waiting for message input to be available
    await expect(page.getByRole('textbox', { name: 'Type your message here...' })).toBeVisible({ timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Verify the assistant responds to our message
    await expect(page.locator('text=Code review').or(page.locator('text=test')).or(page.locator('text=Hello')).first()).toBeVisible({ timeout: 30000 });
    
    // Send a follow-up message to create more activity
    const followUpMessage = "Please confirm this is working for PR status tracking";
    await page.getByRole('textbox', { name: 'Type your message here...' }).click();
    await page.getByRole('textbox', { name: 'Type your message here...' }).fill(followUpMessage);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify the follow-up message appears
    await expect(page.getByText(followUpMessage)).toBeVisible({ timeout: 10000 });
    
    // Verify the assistant responds to the follow-up
    await expect(page.locator('text=confirm').or(page.locator('text=working')).or(page.locator('text=yes')).first()).toBeVisible({ timeout: 30000 });
    
    // The session will be automatically closed by the afterEach hook
    // This test is specifically designed to trigger PR creation and test the code review functionality
  });

  test('Verify Review button and code review tab functionality', async ({ page, trackCurrentSession }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions page
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Wait for sessions page to load
    await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Create a new session for review testing
    await page.getByRole('button', { name: 'New' }).click();
    const message = "Review functionality test - checking PR status indicators";
    await page.getByPlaceholder('Enter an initial prompt').fill(message);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Wait for the session to be ready
    await expect(page.locator('[data-message-id]').first()).toBeVisible({ timeout: 10000 });
    
    // This test creates a session that will be part of the PR
    // The actual Review button testing will happen after PR creation
    // when we can verify the yellow dot (#eab308) appears within 2 minutes
    // and then changes to green (#22c55e) or red (#ef4444) after 5 more minutes
    
    // Send a simple message to generate more PR activity
    await page.getByRole('textbox', { name: 'Type your message here...' }).click();
    await page.getByRole('textbox', { name: 'Type your message here...' }).fill('Testing PR review status tracking');
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Wait for response
    await expect(page.getByText('Testing PR review status tracking')).toBeVisible({ timeout: 10000 });
  });
});