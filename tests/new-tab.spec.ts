import { test, expect } from './fixtures';

test.describe('New Tab Navigation', () => {
  test('should navigate to all tests when clicking "See all tests"', async ({ loggedInPage }) => {
    await loggedInPage.goto('https://dash.empirical.run/lorem-ipsum-tests/test-runs/23649?group_by=none&status=none');
    
    // Click on "See all tests" link
    await loggedInPage.getByRole('link', { name: 'See all tests' }).click();
    
    // Verify that we navigate to the test cases page
    await expect(loggedInPage).toHaveURL(/\/lorem-ipsum-tests\/test-cases/);
    
    // Verify that the test cases page has loaded by checking for expected content
    await expect(loggedInPage.getByText('Test Cases')).toBeVisible();
  });
});