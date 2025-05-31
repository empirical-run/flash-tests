import { test as setup, expect } from "./fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Setup email client for login verification
  const emailId = `automation-test`;
  const client = new EmailClient({ emailId });
  const address = client.getAddress(); // This should be automation-test@... with the domain
  
  // Enter email address for login
  await page.locator('[data-testid="login\\/email-input"]').click();
  await page.locator('[data-testid="login\\/email-input"]').fill(address);
  await page.locator('[data-testid="login\\/email-button"]').click();
  
  // Wait for verification code email (which might be a signup email)
  const email = await client.waitForEmail();
  
  // Check if this is a signup email (no account exists)
  const signupLink = email.links.find(link => link.text === "SIGN UP");
  
  if (signupLink) {
    // Account doesn't exist, need to sign up first
    await page.goto(signupLink.href);
    
    // Wait for the signup page and check if we're successfully logged in
    await expect(page.getByText("Lorem Ipsum")).toBeVisible();
  } else {
    // Normal login flow with verification code
    const verificationCode = email.codes[0];
    
    if (!verificationCode) {
      throw new Error(`No verification code found in email. Email content: ${JSON.stringify(email)}`);
    }
    
    // Enter the verification code and complete login
    await page.getByLabel('One-time password, we sent it').fill(verificationCode);
    
    // Assert that "Lorem Ipsum" text is visible after successful login
    await expect(page.getByText("Lorem Ipsum")).toBeVisible();
  }
  await page.locator('#email-password').click();
  await page.locator('#email-password').fill("automation-test@example.com");
  await page.getByPlaceholder('●●●●●●●●').click();
  await page.getByPlaceholder('●●●●●●●●').fill("k8mSX99gDUD@E#L");
  await page.getByRole('button', { name: 'Submit' }).click();
  
  // Assert that "Lorem Ipsum" text is visible after successful login
  await expect(page.getByText("Lorem Ipsum")).toBeVisible();

  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});