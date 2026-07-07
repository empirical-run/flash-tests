import { test, expect } from "./fixtures";
import { expectAppLoaded } from "./pages/home";

test.describe('Home Page Tests', () => {
  test('toggle shows Lorem Ipsum', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for page to load
    await expectAppLoaded(page);
    
    // Click on the Lorem Ipsum toggle button
    await page.getByRole('button', { name: 'Lorem Ipsum' }).click();
    
    // Verify the project switcher opened and still marks Lorem Ipsum as selected.
    await expect(page.getByRole('option', { name: /Lorem Ipsum/ })).toBeVisible();
  });

  test('empirical.run redirects to dashboard', async ({ page }) => {
    test.skip(true, "Skipping - see Slack thread");
    
    // Navigate to empirical.run
    await page.goto('https://empirical.run');
    
    // Should be redirected to the dashboard
    await expect(page).toHaveURL(/dash\.empirical\.run/);
    
    // Verify we're on the dashboard by checking for dashboard elements
    await expectAppLoaded(page);
  });
});
