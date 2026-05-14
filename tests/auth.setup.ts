import { test as setup, expect } from "./fixtures";

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // The login page differs across environments:
  // - Preview: shows a selection screen first; clicking "Login with password" reveals a single
  //   form with email + password fields together (no "Continue" step).
  // - Production: email input is shown directly, followed by a two-step flow (email → Continue → password → Submit).
  const loginWithPasswordBtn = page.getByRole('button', { name: 'Login with password' });
  const emailInput = page.getByRole('textbox', { name: 'Enter email' });

  // Wait for either the selection screen button or the direct email input to appear
  await loginWithPasswordBtn.or(emailInput).first().waitFor({ state: 'visible' });

  if (await loginWithPasswordBtn.isVisible()) {
    // New UI (preview): click to reveal the single email+password form
    await loginWithPasswordBtn.click();
    await page.locator('#email-password').fill(process.env.AUTOMATED_USER_EMAIL!);
    await page.locator('#password').fill(process.env.AUTOMATED_USER_PASSWORD!);
    await page.getByRole('button', { name: 'Submit' }).click();
  } else {
    // Old UI (production): two-step flow
    await page.getByRole('textbox', { name: 'Enter email' }).fill(process.env.AUTOMATED_USER_EMAIL!);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('textbox', { name: 'Password' }).fill(process.env.AUTOMATED_USER_PASSWORD!);
    await page.getByRole('button', { name: 'Submit' }).click();
  }
  
  // Assert that we're logged in by checking for the Dashboard heading
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});