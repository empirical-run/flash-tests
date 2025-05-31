import { test as setup, expect } from "./fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Check if we're already authenticated by looking for the main app content
  const isAuthenticated = await page.getByText("Lorem Ipsum").isVisible().catch(() => false);
  
  if (isAuthenticated) {
    console.log("Already authenticated, skipping login");
    await page.context().storageState({ path: authFile });
    return;
  }
  
  // Setup email client for authentication
  const client = new EmailClient();
  const address = client.getAddress(); // Use dynamic email
  
  console.log(`Using dynamic email address: ${address}`);
  
  // Fill email and click continue
  await page.locator('[data-testid="login\\/email-input"]').click();
  await page.locator('[data-testid="login\\/email-input"]').fill(address);
  await page.locator('[data-testid="login\\/email-button"]').click();
  
  // Wait for email with either verification code or signup link
  console.log("Waiting for email...");
  const email = await client.waitForEmail();
  console.log(`Received email with subject: ${email.subject}`);
  
  // Check if this is a signup email (account doesn't exist)
  if (email.subject.includes("Attempted Vercel Sign-in") && email.links.some(link => link.text === "SIGN UP")) {
    console.log("Account doesn't exist, need to sign up first");
    const signupLink = email.links.find(link => link.text === "SIGN UP");
    
    // Navigate to signup link
    await page.goto(signupLink.href);
    
    // Complete the signup process
    await page.locator('[data-testid="signup-v2\\/hobby-select-option"] path').click();
    await page.locator('[data-testid="signup-v2\\/hobby-account-name-input"]').fill("Test User");
    await page.locator('[data-testid="signup-v2\\/hobby-continue-button"]').click();
    await page.locator('[data-testid="login\\/email-button"]').click();
    
    // Wait for signup verification email
    const signupEmail = await client.waitForEmail();
    console.log(`Signup email received with subject: ${signupEmail.subject}`);
    
    // Check if we now have a verification code
    if (signupEmail.codes && signupEmail.codes.length > 0) {
      const signupCode = signupEmail.codes[0];
      console.log(`Found verification code: ${signupCode}`);
      await page.getByLabel('One-time password, we sent it').fill(signupCode);
      await page.getByRole('button', { name: 'Continue' }).click();
    } else {
      console.log("No verification code found, signup might be complete or need different approach");
      // Maybe we need to navigate back to the original app
      await page.goto("/");
    }
  } else {
    // This is a login email with verification code
    const verificationCode = email.codes?.[0];
    if (!verificationCode) {
      throw new Error(`No verification code found in email. Email content: ${JSON.stringify(email)}`);
    }
    
    // Enter the verification code and complete login
    await page.getByLabel('One-time password, we sent it').fill(verificationCode);
    await page.getByRole('button', { name: 'Continue' }).click();
  }
  
  // Assert that "Lorem Ipsum" text is visible after successful login
  await expect(page.getByText("Lorem Ipsum")).toBeVisible();

  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});