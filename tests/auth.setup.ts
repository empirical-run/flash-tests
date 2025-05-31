import { test as setup, expect } from "./fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Use the EmailClient to handle verification
  const emailId = 'automation-test';
  const client = new EmailClient({ emailId });
  const address = client.getAddress(); // This will be automation-test@[domain]
  
  // Click "Show other options" if needed
  await page.getByRole('button', { name: 'Show other options' }).click();
  
  // Enter email address
  await page.locator('[data-testid="login\\/email-input"]').click();
  await page.locator('[data-testid="login\\/email-input"]').fill(address);
  
  // Click continue with email
  await page.locator('[data-testid="login\\/email-button"]').click();
  
  // Wait for and get the verification email
  const email = await client.waitForEmail();
  const verificationCode = email.codes[0];
  
  // Enter the verification code
  await page.getByPlaceholder('6-digit code').fill(verificationCode);
  
  // Assert that "Lorem Ipsum" text is visible after successful login
  await expect(page.getByText("Lorem Ipsum")).toBeVisible();

  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});