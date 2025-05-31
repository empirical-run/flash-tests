import { test as setup, expect } from "./fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // TODO(agent on page): Check if we're already logged in (look for "Lorem Ipsum" text). If not logged in, try to find the simplest way to authenticate or access the app for testing.
  
  // Enter the verification code
  await page.getByPlaceholder('6-digit code').fill(verificationCode);
  
  // Assert that "Lorem Ipsum" text is visible after successful login
  await expect(page.getByText("Lorem Ipsum")).toBeVisible();

  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});