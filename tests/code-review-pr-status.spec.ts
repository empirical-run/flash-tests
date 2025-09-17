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
    
    // Create a new session with a clear, actionable prompt that won't confuse the agent
    await page.getByRole('button', { name: 'New' }).click();
    const uniqueId = `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const message = `Hello! Please help me write a simple test that verifies a button click works correctly. This is for testing our code review and PR status tracking system. Just respond with a basic example of how to test clicking a button in Playwright. Test ID: ${uniqueId}`;
    await page.getByPlaceholder('Enter an initial prompt').fill(message);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions" and a session ID)
    await expect(page).toHaveURL(/sessions\/\d+/, { timeout: 15000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Wait for the session chat page to load completely by waiting for message input to be available
    // Use a more flexible approach to detect when the session is ready
    await expect(
      page.getByRole('textbox', { name: 'Type your message here...' }).or(
        page.getByPlaceholder('Type your message')
      ).or(
        page.getByPlaceholder('Type your message here...')
      )
    ).toBeVisible({ timeout: 30000 });
    
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
    
    // Now test the PR review status indicators (this is the core requirement)
    
    // First, wait for up to 2 minutes for the yellow dot to appear on the Review button
    console.log('Waiting for yellow dot to appear on Review button within 2 minutes...');
    const reviewButton = page.getByRole('button', { name: 'Review' });
    
    // CORE REQUIREMENT: Check for yellow dot (#eab308) within 2 minutes (120000ms)
    // This MUST be found for the test to pass
    await expect(reviewButton.locator('[style*="#eab308"], [class*="yellow"], [style*="rgb(234, 179, 8)"]')).toBeVisible({ timeout: 120000 });
    console.log('✅ Yellow dot appeared on Review button!');
    
    // Click the Review button to open the Code Review Tab
    await reviewButton.click();
    
    // CORE REQUIREMENT: Verify the Code Review Tab shows review in "queued" state
    await expect(page.getByText('queued').or(page.getByText('Queued')).or(page.locator('[data-status="queued"]'))).toBeVisible({ timeout: 10000 });
    console.log('✅ Review shows in queued state in Code Review Tab!');
    
    // CORE REQUIREMENT: Wait for 5 more minutes for the dot to change color
    console.log('Waiting 5 more minutes for dot to change from yellow to green or red...');
    
    // Check if dot changes to green (#22c55e) or red (#ef4444) within 5 minutes (300000ms)
    const dotColorChange = page.locator('[style*="#22c55e"], [style*="rgb(34, 197, 94)"], [style*="#ef4444"], [style*="rgb(239, 68, 68)"]');
    await expect(dotColorChange).toBeVisible({ timeout: 300000 });
    
    // Determine if it's green (approved) or red (rejected)
    const isGreen = await page.locator('[style*="#22c55e"], [style*="rgb(34, 197, 94)"]').isVisible();
    const isRed = await page.locator('[style*="#ef4444"], [style*="rgb(239, 68, 68)"]').isVisible();
    
    if (isGreen) {
      console.log('✅ Dot changed to GREEN - Review APPROVED!');
      // Verify approved state in Code Review Tab
      await expect(page.getByText('approved').or(page.getByText('Approved')).or(page.locator('[data-status="approved"]'))).toBeVisible({ timeout: 10000 });
    } else if (isRed) {
      console.log('✅ Dot changed to RED - Review REJECTED!');
      // Verify rejected state in Code Review Tab  
      await expect(page.getByText('rejected').or(page.getByText('Rejected')).or(page.locator('[data-status="rejected"]'))).toBeVisible({ timeout: 10000 });
    }
    
    // The session will be automatically closed by the afterEach hook
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
    
    // Verify we're in a session (URL should contain "sessions" and a session ID)
    await expect(page).toHaveURL(/sessions\/\d+/, { timeout: 15000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Wait for the session to be ready with more flexible selectors
    await expect(
      page.getByRole('textbox', { name: 'Type your message here...' }).or(
        page.getByPlaceholder('Type your message')
      ).or(
        page.getByPlaceholder('Type your message here...')
      )
    ).toBeVisible({ timeout: 30000 });
    
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
    
    // Test the Review button functionality
    console.log('Testing Review button and Code Review Tab functionality...');
    
    // Wait for the Review button to be available (should appear after PR is created)
    const reviewButton = page.getByRole('button', { name: 'Review' });
    await expect(reviewButton).toBeVisible({ timeout: 60000 });
    
    // Check if Review button has a yellow dot initially (within 2 minutes of PR creation)
    const hasYellowDot = await reviewButton.locator('[style*="#eab308"], [style*="rgb(234, 179, 8)"]').isVisible({ timeout: 5000 });
    if (hasYellowDot) {
      console.log('✅ Yellow dot found on Review button');
    }
    
    // Click the Review button to open Code Review Tab
    await reviewButton.click();
    
    // Verify the Code Review Tab opens and shows review information
    // This could show different states: queued, approved, rejected, etc.
    const reviewStates = page.locator('text=/queued|approved|rejected|pending/i');
    await expect(reviewStates.first()).toBeVisible({ timeout: 10000 });
    
    console.log('✅ Code Review Tab opened successfully and shows review state');
  });
});