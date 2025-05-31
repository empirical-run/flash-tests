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
  
  // Wait for email with verification code
  console.log("Waiting for email...");
  const email = await client.waitForEmail();
  console.log(`Received email content: ${JSON.stringify(email)}`);
  
  const verificationCode = email.codes?.[0];
  if (!verificationCode) {
    throw new Error(`No verification code found in email. Email content: ${JSON.stringify(email)}`);
  }
  
  // Enter the verification code and complete login
  await page.getByLabel('One-time password, we sent it').fill(verificationCode);
  await page.getByRole('button', { name: 'Continue' }).click();
  
  // Assert that "Lorem Ipsum" text is visible after successful login
  await expect(page.getByText("Lorem Ipsum")).toBeVisible();

  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});