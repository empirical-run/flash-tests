import { test, expect } from '@playwright/test';
import { loggedInPage } from './fixtures';

test.describe('New Tab Tests', () => {
  test('should click on "See all tests" button', async ({ loggedInPage: page }) => {
    // Navigate to the specific test run page
    await page.goto('https://dash.empirical.run/lorem-ipsum-tests/test-runs/23649?group_by=none&status=none');
    
    // TODO(agent on page): Click on the "See all tests" button
  });
});