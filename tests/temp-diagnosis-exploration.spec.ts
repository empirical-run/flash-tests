import { test, expect } from "./fixtures";

test.describe('Explore Diagnosis UI', () => {
  test('explore test detail view to find diagnosis URL', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to test runs
    await page.getByRole('link', { name: 'Test Runs' }).click();
    
    // Wait for test runs to load
    await page.waitForTimeout(2000);
    
    // Click on a test run with failed tests
    const testRunLink = page.locator('a[href*="/test-runs/"]').filter({ hasText: '1' }).first();
    await testRunLink.click();
    
    // Wait for page to load
    await expect(page).toHaveURL(/test-runs/, { timeout: 10000 });
    
    // Wait for failed test to appear
    await page.waitForTimeout(1000);
    
    // Click on a failed test
    const failedTestLink = page.locator('a').filter({ hasText: 'search' }).first();
    if (await failedTestLink.count() > 0) {
      await failedTestLink.click();
      
      // Wait for detail to load
      await expect(page).toHaveURL(/detail=/, { timeout: 10000 });
      
      console.log('Current URL:', page.url());
      
      // TODO(agent on page): Look for any buttons or links that might navigate to a diagnosis page or contain "diagnosis" in their href or text
    } else {
      console.log('No failed tests found, skipping');
    }
  });
});
