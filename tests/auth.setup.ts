import { test as setup, expect } from "./fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  try {
    // Try email-based authentication with verification code
    const emailId = `test-user`;
    const client = new EmailClient({ emailId });
    const email = client.getAddress();
    
    // Enter email for login
    await page.locator('[data-testid="login\\/email-input"]').click();
    await page.locator('[data-testid="login\\/email-input"]').fill(email);
    await page.locator('[data-testid="login\\/email-button"]').click();
    
    // Wait for and get the verification code from email
    const emailMessage = await client.waitForEmail();
    const verificationCode = emailMessage.codes[0];
    
    if (verificationCode) {
      // Find the verification code input field and enter the code
      await page.locator('input[placeholder*="code" i], input[type="text"]').first().fill(verificationCode);
      await page.locator('button[type="submit"], button:has-text("Verify"), button:has-text("Continue")').first().click();
    }
  } catch (error) {
    console.log("Email verification failed:", error);
    // If email verification fails, we might already be logged in or need different approach
  }
  
  // Assert that "Lorem Ipsum" text is visible after successful login
  await expect(page.getByText("Lorem Ipsum")).toBeVisible({ timeout: 30000 });

  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});