import { test as setup, expect } from "./fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Check if already logged in by looking for "Lorem Ipsum" text
  const isLoggedIn = await page.getByText("Lorem Ipsum").isVisible().catch(() => false);
  
  if (!isLoggedIn) {
    // Try Google authentication
    await page.locator('[data-testid="login\\/google-button"]').click();
    
    // Wait a bit for potential redirect or authentication completion
    await page.waitForTimeout(3000);
    
    // If still not logged in, try navigating directly to the home page 
    if (!(await page.getByText("Lorem Ipsum").isVisible().catch(() => false))) {
      await page.goto("/");
    }
  }
  
  // Assert that "Lorem Ipsum" text is visible after successful login
  await expect(page.getByText("Lorem Ipsum")).toBeVisible();

  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});