import { test as setup, expect } from "./fixtures";

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Login with email and password
  await page.getByRole('button', { name: 'Login with password' }).click();
  await page.locator('#email-password').click();
  await page.locator('#email-password').fill(process.env.AUTOMATED_USER_EMAIL!);
  await page.getByPlaceholder('●●●●●●●●').click();
  await page.getByPlaceholder('●●●●●●●●').fill(process.env.AUTOMATED_USER_PASSWORD!);
  await page.getByRole('button', { name: 'Submit' }).click();
  
  // Assert that we're logged in by checking for the Sessions heading
  await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();

  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});