import { test, expect } from './fixtures';

test.describe('New Tab Tests', () => {
  test('should click on "See all tests" button', async ({ loggedInPage: page }) => {
    // Navigate to the specific test run page
    await page.goto('https://dash.empirical.run/lorem-ipsum-tests/test-runs/23649?group_by=none&status=none');
    
    // Click on "See all tests" button which opens in a new tab
    const page1Promise = page.waitForEvent('popup');
    await page.getByRole('link', { name: 'See all tests' }).click();
    const page1 = await page1Promise;
    
    // Verify the new tab opened successfully
    await expect(page1).toHaveURL(/.*\/lorem-ipsum-tests\/tests/);
    
    // Close the new tab
    await page1.close();
  });
});