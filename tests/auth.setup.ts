import { test as setup, expect } from "./fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Setup email client for authentication
  const emailId = "automation-test";
  const client = new EmailClient({ emailId });
  const address = client.getAddress(); // Returns full address with domain

  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Fill email and click continue
  await page.locator('[data-testid="login\\/email-input"]').click();
  await page.locator('[data-testid="login\\/email-input"]').fill(address);
  await page.locator('[data-testid="login\\/email-button"]').click();
  
  // Wait for email with verification code
  const email = await client.waitForEmail();
  const verificationCode = email.codes[0];
  
  // TODO(agent on page): Enter the verification code and complete login
  
  // Assert that "Lorem Ipsum" text is visible after successful login
  await expect(page.getByText("Lorem Ipsum")).toBeVisible();

  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});