import { test as setup, expect } from "./fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Initialize email client for the automation test email
  const emailClient = new EmailClient({ emailId: 'automation-test' });
  const emailAddress = emailClient.getAddress();
  
  // Enter email address
  await page.locator('[data-testid="login\\/email-input"]').click();
  await page.locator('[data-testid="login\\/email-input"]').fill(emailAddress);
  
  // Click Continue with Email
  await page.locator('[data-testid="login\\/email-button"]').click();
  
  // Wait for verification email and get the code
  const email = await emailClient.waitForEmail();
  console.log('Email received:', email);
  
  // Try different ways to extract the verification code
  let verificationCode = email.codes?.[0];
  if (!verificationCode && email.text) {
    // Try to extract code from email text using regex
    const codeMatch = email.text.match(/\b\d{6}\b/);
    verificationCode = codeMatch?.[0];
  }
  
  console.log('Verification code:', verificationCode);
  
  if (!verificationCode) {
    throw new Error('Could not extract verification code from email');
  }
  
  // Enter the verification code
  await page.getByPlaceholder('Enter code').fill(verificationCode);
  await page.getByRole('button', { name: 'Verify' }).click();
  
  // Assert that "Lorem Ipsum" text is visible after successful login
  await expect(page.getByText("Lorem Ipsum")).toBeVisible();

  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});