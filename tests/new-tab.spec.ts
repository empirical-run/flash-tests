import { test, expect } from './fixtures';

test.describe('New Tab Navigation', () => {
  test('should navigate to all tests when clicking "See all tests"', async ({ loggedInPage }) => {
    await loggedInPage.goto('https://dash.empirical.run/lorem-ipsum-tests/test-runs/23649?group_by=none&status=none');
    
    // TODO(agent on loggedInPage): Click on "See all tests" and verify what happens after the click
  });
});