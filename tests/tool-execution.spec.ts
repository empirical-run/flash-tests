import { test, expect } from "./fixtures";

test.describe('Tool Execution Tests', () => {
  test('safeBash tool execution to get commit SHA', async ({ page, trackCurrentSession }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions page
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Wait for sessions page to load
    await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Create a new session with advanced settings
    await page.getByRole('button', { name: 'New' }).click();
    
    // Open advanced settings
    await page.getByRole('button', { name: 'Advanced' }).click();
    
    // Set the base branch to 'example-base-branch'
    await page.getByLabel('Base Branch').fill('example-base-branch');
    
    // Enter the user message to get commit SHA
    const message = "what's the commit sha/ref for the last commit";
    await page.getByPlaceholder('Enter an initial prompt').fill(message);
    
    // Create the session
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Assert safeBash tool is running
    await expect(page.getByText(/Running safeBash/)).toBeVisible({ timeout: 60000 });
    
    // Assert safeBash tool was used
    await expect(page.getByText(/Used safeBash/)).toBeVisible({ timeout: 60000 });
    
    // Assert the specific commit SHA is visible in the data-message-id bubble
    await expect(page.locator('[data-message-id]').filter({ hasText: 'b028df844e4ffb38d1cfeba6cdb4432de556cffc' })).toBeVisible({ timeout: 60000 });
  });
});
