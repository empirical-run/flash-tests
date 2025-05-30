import { test as setup, expect } from "./fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Set up email client for receiving verification codes
  const emailClient = new EmailClient();
  const emailAddress = emailClient.getAddress();
  
  // Login with email verification flow
  await page.getByRole('link', { name: 'Continue with Email →' }).click();
  await page.locator('[data-testid="login\\/email-input"]').click();
  await page.locator('[data-testid="login\\/email-input"]').fill(emailAddress);
  await page.locator('[data-testid="login\\/email-button"]').click();
  
  // Wait for verification email and get the sign-up link
  const email = await emailClient.waitForEmail();
  console.log('Email received:', email);
  console.log('Links found:', email.links);
  
  // Find the sign-up link
  const signUpLink = email.links.find(link => link.text === 'SIGN UP');
  
  if (!signUpLink) {
    throw new Error('No sign-up link found in email');
  }
  
  // Navigate to the sign-up link to complete account creation
  await page.goto(signUpLink.href);
  
  // Assert that "Lorem Ipsum" text is visible after successful login
  await expect(page.getByText("Lorem Ipsum")).toBeVisible();

  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});