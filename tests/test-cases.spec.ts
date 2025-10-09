import { test, expect } from "./fixtures";

test.describe('Test Cases Tests', () => {
  test('Edit test case should show new session screen instead of "session not found"', async ({ page }) => {
    // This test documents a current issue:
    // When user clicks "Edit" on a test case detail view, it currently shows "Session not found" error
    // Expected behavior: Should create/redirect to a new session where user can send messages
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Test Cases page from sidebar
    await page.getByRole('link', { name: 'Test Cases', exact: true }).click();
    
    // Wait for test cases page to load
    await expect(page).toHaveURL(/test-cases$/, { timeout: 10000 });
    
    // Wait for test cases to load (ensure the table content is available)
    await expect(page.getByRole('row').first()).toBeVisible({ timeout: 10000 });
    
    // Click on the first test case link in the table (generalized approach)
    await page.getByRole('row').getByRole('link').first().click();
    
    // Wait for test case detail view to load
    await expect(page).toHaveURL(/test-cases\/.*$/, { timeout: 10000 });
    
    // Click the Edit button
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    
    // EXPECTED BEHAVIOR: Should redirect to a new session where user can send messages
    // The Edit button opens a "Create new session" modal with the test case context pre-filled
    
    // Wait for the modal to appear
    await expect(page.getByText('Create new session')).toBeVisible({ timeout: 10000 });
    
    // Click the Create button to actually create the session
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Wait for session page to load - URL changes to session format
    await expect(page).toHaveURL(/.*\/sessions\/\d+$/, { timeout: 10000 });
    
    // Check that the session interface is available (message input field)
    await expect(page.getByPlaceholder('Type your message here...')).toBeVisible({ timeout: 10000 });
    
    // Check that the Stop button is available (indicating active session)
    await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
    
    // Verify that we can actually type in the message field (not disabled)
    await expect(page.getByPlaceholder('Type your message here...')).toBeEnabled();
    
    // Verify that session details panel is visible
    await expect(page.getByText('Details')).toBeVisible();
  });

  test('Test cases page shows last run video', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Test Cases page from sidebar
    await page.getByRole('link', { name: 'Test Cases', exact: true }).click();
    
    // Wait for test cases page to load
    await expect(page).toHaveURL(/test-cases$/, { timeout: 10000 });
    
    // Wait for test cases to load
    await expect(page.getByRole('row').first()).toBeVisible({ timeout: 10000 });
    
    // Click on the specific test case "search for auth shows only 1 card"
    await page.getByRole('link', { name: 'search for auth shows only 1 card' }).click();
    
    // Wait for test case detail view to load
    await expect(page).toHaveURL(/test-cases\/.*$/, { timeout: 10000 });
    
    // Assert that the video is visible
    const video = page.locator('video').first();
    await expect(video).toBeVisible({ timeout: 10000 });
    
    // Assert that the video can be played (has valid source)
    await expect(video).toHaveAttribute('src', /.+/);
    
    // Optional: verify video has loaded metadata
    await video.waitFor({ state: 'visible' });
    
    // Click on "view full report" button/link
    const [newPage] = await Promise.all([
      page.context().waitForEvent('page'),
      page.getByRole('link', { name: /view full report/i }).click()
    ]);
    
    // Wait for the new tab to load
    await newPage.waitForLoadState('domcontentloaded');
    
    // Assert that the test name is visible in the new tab
    await expect(newPage.getByText('search for auth shows only 1 card')).toBeVisible({ timeout: 10000 });
  });
});