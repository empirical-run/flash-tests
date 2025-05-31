import { test as setup, expect } from "./fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Use static email ID for automation testing
  const emailId = `automation-test`;
  const client = new EmailClient({ emailId });
  const address = client.getAddress(); // This should give us the full email address
  
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Click on the email input field and enter the email
  await page.locator('[data-testid="login\\/email-input"]').click();
  await page.locator('[data-testid="login\\/email-input"]').fill(address);
  await page.locator('[data-testid="login\\/email-button"]').click();
  
  // Wait for the verification code email
  const email = await client.waitForEmail();
  const verificationCode = email.codes[0]; // Get the first verification code from the email
  
  // TODO(agent on page): Enter the verification code in the appropriate field and submit the form
  
  // Assert that "Lorem Ipsum" text is visible after successful login
  await expect(page.getByText("Lorem Ipsum")).toBeVisible();

  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});