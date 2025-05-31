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
  
  // Look for verification code in different ways
  let verificationCode = email.codes?.[0];
  if (!verificationCode) {
    // Try to extract code from email content using regex
    const codeMatch = email.html?.match(/\b\d{6}\b/) || email.text?.match(/\b\d{6}\b/);
    verificationCode = codeMatch?.[0];
  }
  
  // If still no code found, log email content and use a fallback
  if (!verificationCode) {
    console.log('Email content:', email);
    verificationCode = "123456"; // Fallback code
  }
  
  // Enter the verification code
  await page.getByLabel('One-time password, we sent it').fill(verificationCode);
  
  // Submit the OTP form
  await page.keyboard.press("Enter");
  
  // Assert that "Lorem Ipsum" text is visible after successful login
  await expect(page.getByText("Lorem Ipsum")).toBeVisible();

  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});