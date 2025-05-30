import { test as setup, expect } from "./fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Set up email client for receiving verification codes
  const emailClient = new EmailClient({ emailId: "automation-test" });
  const emailAddress = emailClient.getAddress();
  
  // Login with email verification flow
  await page.getByRole('link', { name: 'Continue with Email →' }).click();
  await page.locator('[data-testid="login\\/email-input"]').click();
  await page.locator('[data-testid="login\\/email-input"]').fill(emailAddress);
  await page.locator('[data-testid="login\\/email-button"]').click();
  
  // Wait for verification email and get the code
  const email = await emailClient.waitForEmail();
  const verificationCode = email.codes[0];
  
  // Enter the verification code to complete login
  await page.getByLabel('One-time password, we sent it').fill(verificationCode);
  
  // Assert that "Lorem Ipsum" text is visible after successful login
  await expect(page.getByText("Lorem Ipsum")).toBeVisible();

  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});