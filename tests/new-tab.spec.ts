import { test, expect } from '@playwright/test';
import { loggedInPage } from './fixtures';

test.describe('New Tab Navigation', () => {
  test('should navigate to all tests when clicking "See all tests"', async ({ page }) => {
    await page.goto('https://dash.empirical.run/lorem-ipsum-tests/test-runs/23649?group_by=none&status=none');
    
    // TODO(agent on page): Click on "See all tests" and verify what happens after the click
  });
});