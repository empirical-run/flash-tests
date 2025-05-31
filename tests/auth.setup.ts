import { test as setup, expect } from "./fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Use email client for dynamic email authentication
  const client = new EmailClient();
  const address = client.getAddress();
  
  // Use email login with dynamic email
  await page.locator('[data-testid="login\\/email-input"]').click();
  await page.locator('[data-testid="login\\/email-input"]').fill(address);
  await page.locator('[data-testid="login\\/email-button"]').click();
  
  // Wait for verification email and extract code
  const email = await client.waitForEmail();
  const verificationCode = email.codes[0]; // Extract the first code from the email
  
  // Enter the verification code
  await page.getByLabel('One-time password, we sent it').fill(verificationCode);
  
  // Assert that "Lorem Ipsum" text is visible after successful login
  await expect(page.getByText("Lorem Ipsum")).toBeVisible();

  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});