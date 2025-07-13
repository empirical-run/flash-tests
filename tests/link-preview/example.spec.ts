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

  test('should have proper meta tags for social sharing', async ({ page }) => {
    await page.goto('/');
    
    // Check for Open Graph meta tags
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    const ogDescription = await page.locator('meta[property="og:description"]').getAttribute('content');
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
    
    // Verify meta tags exist (adjust expectations based on your app's actual meta tags)
    expect(ogTitle).toBeTruthy();
    expect(ogDescription).toBeTruthy();
    expect(ogImage).toBeTruthy();
  });

  test('should handle link preview requests without authentication', async ({ page }) => {
    // This test verifies that link previews work without requiring user authentication
    await page.goto('/');
    
    // Verify page loads without authentication
    await expect(page).toHaveTitle(/Empirical/);
    
    // Check that we're not redirected to login page
    expect(page.url()).not.toContain('/login');
  });
});