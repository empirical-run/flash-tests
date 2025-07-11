import { test, expect } from '@playwright/test';

test.describe('Hacker News', () => {
  test('should require login to submit a new post', async ({ page }) => {
    await page.goto('https://news.ycombinator.com/');
    await page.getByRole('link', { name: 'submit' }).click();

    // The user is redirected to the login page.
    await expect(page).toHaveURL('https://news.ycombinator.com/login?goto=submit');

    // Fill in the login form with invalid credentials from the codegen.
    await page.locator('input[name="acct"]').fill('arjun27k');
    await page.locator('input[name="pw"]').fill('asasfasdf');
    await page.getByRole('button', { name: 'login' }).click();

    // Assert that the login failed.
    await expect(page.getByText('Bad login.')).toBeVisible();
  });
});
