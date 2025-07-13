import { test, expect } from '@playwright/test';

test.describe('Link Preview Tests', () => {
  test('should load page as social media crawler', async ({ page }) => {
    // Navigate to the homepage
    await page.goto('/');
    
    // Verify the page loads successfully
    await expect(page).toHaveTitle(/Empirical/);
    
    // Check that the page responds to the social media crawler user agent
    const userAgent = await page.evaluate(() => navigator.userAgent);
    expect(userAgent).toContain('facebookexternalhit');
    expect(userAgent).toContain('Facebot');
    expect(userAgent).toContain('Twitterbot');
  });

  test('should navigate to session page and show session number in title', async ({ page }) => {
    // Navigate to the specific session URL
    await page.goto('/flash-tests/sessions/2941');
    
    // Check that the page title contains the session number
    await expect(page).toHaveTitle(/Session #2941/);
  });
});