import { test as setup, expect } from "./fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";

const authFile = 'playwright/.auth/user.json';

import { test as setup, expect } from "./fixtures";

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Try Google login approach
  await page.locator('[data-testid="login\\/google-button"]').click();
  
  // Wait for login to complete and check for success indicator
  await page.waitForURL(/.*/, { timeout: 30000 });
  
  // Try to find the success indicator (Lorem Ipsum text)
  const successIndicator = page.getByText("Lorem Ipsum");
  
  // If we can't find the success indicator, try alternative authentication
  try {
    await expect(successIndicator).toBeVisible({ timeout: 10000 });
  } catch (error) {
    // If Google login didn't work, the page might already be authenticated
    // or we might need to check for other success indicators
    console.log("Authentication verification: checking if already logged in");
    
    // Check if we're already on an authenticated page
    const isAuthenticated = await page.getByText("Lorem Ipsum").isVisible();
    if (!isAuthenticated) {
      throw new Error("Authentication failed");
    }
  }
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