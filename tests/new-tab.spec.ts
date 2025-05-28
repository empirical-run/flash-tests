import { test, expect } from './fixtures';

test.describe('New Tab Tests', () => {
  test('should click on "See all tests" and verify navigation', async ({ loggedInPage }) => {
    // Navigate to the test run page
    await loggedInPage.goto('https://dash.empirical.run/lorem-ipsum-tests/test-runs/23649?group_by=none&status=none');
    
    // Click on "See all tests" which opens a new tab/popup
    const page1Promise = loggedInPage.waitForEvent('popup');
    await loggedInPage.getByRole('link', { name: 'See all tests' }).click();
    const newPage = await page1Promise;
    
    // Wait for the new page to load and verify it navigated to the tests page
    await newPage.waitForLoadState('networkidle');
    
    // Assert that the new page URL contains the expected path
    expect(newPage.url()).toContain('/lorem-ipsum-tests/tests');
    
    // Verify that the new page has test-related content
    await expect(newPage.getByText('Tests')).toBeVisible();
    
    // Clean up by closing the new page
    await newPage.close();
  });
});