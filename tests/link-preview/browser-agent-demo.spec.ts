import { test, expect } from '@playwright/test';

test.describe('Browser Agent Demo', () => {
  test('can interact on playwright.dev', async ({ page }) => {
    await page.goto('https://playwright.dev/');
    await expect(page).toHaveTitle(/Playwright/);
    // TODO(agent on page): Click the "Get started" link in the hero section and verify that the URL contains "docs/intro"
  });
});
