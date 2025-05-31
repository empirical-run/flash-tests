import { test as setup, expect } from "./fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Setup email client for authentication
  const emailId = "automation-test";
  const client = new EmailClient({ emailId });
  const address = client.getAddress(); // Returns full address with domain
  
  console.log(`Using email address: ${address}`);

  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Fill email and click continue
  await page.locator('[data-testid="login\\/email-input"]').click();
  await page.locator('[data-testid="login\\/email-input"]').fill(address);
  await page.locator('[data-testid="login\\/email-button"]').click();
  
  // Wait for email with verification code
  console.log("Waiting for email...");
  const email = await client.waitForEmail();
  console.log(`Received email with codes: ${JSON.stringify(email.codes)}`);
  
  const verificationCode = email.codes?.[0];
  if (!verificationCode) {
    throw new Error('No verification code found in email');
  }
  
  // Enter the verification code and complete login
  await page.getByLabel('One-time password, we sent it').fill(verificationCode);
  await page.getByRole('button', { name: 'Continue' }).click();
  
  // Assert that "Lorem Ipsum" text is visible after successful login
  await expect(page.getByText("Lorem Ipsum")).toBeVisible();

  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});