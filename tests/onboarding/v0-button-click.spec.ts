import { test, expect } from '@playwright/test';

test.describe('V0 Button Click', () => {
  test('should navigate to v0 app and click the button', async ({ page }) => {
    await page.goto('https://v0-button-to-open-v0-home-page-h5dizpkwp.vercel.app/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Look for a button element and click it
    const button = page.locator('button').first();
    await expect(button).toBeVisible();
    await button.click();
    
    // You can add additional assertions here based on what should happen after clicking
  });
});