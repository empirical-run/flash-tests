import { test, expect } from '@playwright/test';

test.describe('Link Preview Tests', () => {

  test('should navigate to session page and show session number in title', async ({ page }) => {
    // Navigate to the specific session URL
    await page.goto('/sessions/2941');
    
    // Check that the page title contains the session number
    await expect(page).toHaveTitle(/Session #2941/);
  });
});