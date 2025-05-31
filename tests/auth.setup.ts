import { test as setup, expect } from "./fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Use static email for authentication
  const emailId = `automation-test`;
  const client = new EmailClient({ emailId });
  const emailAddress = client.getAddress(); // This will be automation-test@{domain}
  
  // Click on email input and fill credentials
  await page.locator('[data-testid="login\\/email-input"]').click();
  await page.locator('[data-testid="login\\/email-input"]').fill(emailAddress);
  await page.locator('[data-testid="login\\/email-button"]').click();
  
  // Wait for verification email and get the code
  const email = await client.waitForEmail();
  const verificationCode = email.codes[0];
  
  // TODO(agent on page): Enter the verification code and complete login
  await page.locator('#email-password').click();
  await page.locator('#email-password').fill("automation-test@example.com");
  await page.getByPlaceholder('●●●●●●●●').click();
  await page.getByPlaceholder('●●●●●●●●').fill("k8mSX99gDUD@E#L");
  await page.getByRole('button', { name: 'Submit' }).click();
  
  // Assert that "Lorem Ipsum" text is visible after successful login
  await expect(page.getByText("Lorem Ipsum")).toBeVisible();

  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});