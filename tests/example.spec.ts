import { test, expect } from './fixtures';

test.describe('Example Tests', () => {
  test('dummy test - verify page title', async ({ page }) => {
    await page.goto('https://playwright.dev/');
    await expect(page).toHaveTitle(/Playwright/);
  });

  test('dummy test - check for heading', async ({ page }) => {
    await page.goto('https://playwright.dev/');
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible();
  });
});
