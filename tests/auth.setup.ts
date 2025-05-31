import { test as setup, expect } from "./fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Use email client for authentication
  const emailId = `test-login-user`;
  const client = new EmailClient({ emailId });
  const address = client.getAddress();
  
  // Enter email for login
  await page.locator('[data-testid="login\\/email-input"]').click();
  await page.locator('[data-testid="login\\/email-input"]').fill(address);
  await page.locator('[data-testid="login\\/email-button"]').click();
  
  // Wait for verification code email
  const email = await client.waitForEmail();
  const loginCode = email.codes[0];
  
  // Enter verification code
  await page.getByPlaceholder('Enter 6-digit code').fill(loginCode);
  await page.getByRole('button', { name: 'Verify' }).click();
  
  // Assert that "Lorem Ipsum" text is visible after successful login
  await expect(page.getByText("Lorem Ipsum")).toBeVisible();

  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});