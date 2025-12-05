import { test, expect } from "./fixtures";

test.describe('Home Page Tests', () => {
  test('toggle shows Lorem Ipsum', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for page to load
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Click on the Lorem Ipsum toggle button
    await page.getByRole('button', { name: 'Lorem Ipsum' }).click();
    
    // Verify the Lorem Ipsum toggle is selected/visible
    await expect(page.getByRole('button', { name: 'Lorem Ipsum' })).toBeVisible();
  });

  test('empirical.run redirects to dashboard', async ({ page }) => {
    // Navigate to empirical.run
    await page.goto('https://empirical.run');
    
    // Should be redirected to the dashboard
    await expect(page).toHaveURL(/dash\.empirical\.run/);
    
    // Verify we're on the dashboard by checking for dashboard elements
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
  });
});
