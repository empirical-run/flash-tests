import { test, expect } from '@playwright/test';

test.describe('Link Preview Tests', () => {

  test('playwright page has title', async ({ page }) => {
    // Navigate to the specific session URL
    await page.goto('/flash-tests/sessions/2941');
    
    // Check that the page title contains the session number
    await expect(page).toHaveTitle(/Session #2941/);
  });
});