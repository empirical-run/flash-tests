import { test as setup, expect } from "./fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Use a static email for authentication
  const emailId = 'automation-test';
  const client = new EmailClient({ emailId });
  const address = client.getAddress();
  
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Login with email and password by clicking the login button
  await page.locator('[data-testid="login\\/email-button"]').click();
  await page.locator('[data-testid="login\\/email-input"]').click();
  await page.locator('[data-testid="login\\/email-input"]').fill(address);
  await page.locator('[data-testid="login\\/email-button"]').click();
  
  // Wait for verification email and get the code
  const email = await client.waitForEmail();
  const loginCode = email.codes[0];
  
  // TODO(agent on page): Enter the verification code and submit the form
  
  // Assert that "Lorem Ipsum" text is visible after successful login
  await expect(page.getByText("Lorem Ipsum")).toBeVisible();

  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});