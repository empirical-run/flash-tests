import { test, expect } from '@playwright/test';

test.describe('Mobile Navigation Tests', () => {
  test('navigate to test runs via hamburger menu', async ({ page }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Wait for the page to load
    await expect(page.locator('body')).toBeVisible();
    
    // Click on the hamburger menu button
    await page.getByLabel('Open sidebar').click();
    
    // Click on "test runs" in the sidebar
    await page.getByRole('link', { name: 'Test Runs' }).click();
    
    // Verify we're on the test runs page
    await expect(page).toHaveURL(/test-runs/);
  });
});