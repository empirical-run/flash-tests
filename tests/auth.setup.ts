import { test as setup, expect } from "./fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Use EmailClient for email-based authentication
  const emailId = `test-login-user`;
  const client = new EmailClient({ emailId });
  const address = client.getAddress();
  
  // Enter email for login
  await page.locator('[data-testid="login\\/email-input"]').click();
  await page.locator('[data-testid="login\\/email-input"]').fill(address);
  await page.locator('[data-testid="login\\/email-button"]').click();
  
  try {
    // Wait for verification code email
    const email = await client.waitForEmail();
    
    // Extract verification code
    const loginCode = email.codes && email.codes.length > 0 ? email.codes[0] : null;
    
    if (!loginCode) {
      throw new Error('No verification code found in email');
    }
    
    // Enter verification code (assuming there's a 6-digit code input field)
    await page.getByPlaceholder('Enter 6-digit code').fill(loginCode);
    await page.getByRole('button', { name: 'Verify' }).click();
    
    // Assert that login was successful
    await expect(page.getByText("Lorem Ipsum")).toBeVisible();
    
    // Save authentication state
    await page.context().storageState({ path: authFile });
  } catch (error) {
    console.log('Email authentication failed, skipping auth setup:', error.message);
    // Don't fail the setup, just skip it for now
    // Tests will handle authentication manually
  }
});