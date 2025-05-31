import { test as setup, expect } from "./fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Use a specific email for authentication
  const emailId = `test-user`;
  const client = new EmailClient({ emailId });
  const email = client.getAddress();
  
  // Enter email for login
  await page.locator('[data-testid="login\\/email-input"]').click();
  await page.locator('[data-testid="login\\/email-input"]').fill(email);
  await page.locator('[data-testid="login\\/email-button"]').click();
  
  // Wait for and get the verification code from email
  try {
    const emailMessage = await client.waitForEmail();
    const verificationCode = emailMessage.codes[0];
    
    if (verificationCode) {
      // Enter verification code
      await page.locator('input[type="text"]').fill(verificationCode);
      await page.locator('button[type="submit"]').click();
    }
  } catch (error) {
    console.log("Email verification failed, trying to continue...");
  }
  
  // Assert that "Lorem Ipsum" text is visible after successful login
  await expect(page.getByText("Lorem Ipsum")).toBeVisible();

  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});