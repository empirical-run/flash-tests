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
});