import { test as setup, expect } from "./fixtures";

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Check if we're already authenticated by looking for Lorem Ipsum text
  const isAlreadyAuthenticated = await page.getByText("Lorem Ipsum").isVisible({ timeout: 5000 }).catch(() => false);
  
  if (isAlreadyAuthenticated) {
    console.log("Already authenticated");
  } else {
    // Try to authenticate
    console.log("Attempting authentication");
    
    // Check if Google login button is available
    const googleButton = page.locator('[data-testid="login\\/google-button"]');
    const isGoogleButtonVisible = await googleButton.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (isGoogleButtonVisible) {
      await googleButton.click();
      // Wait for authentication to complete
      await page.waitForURL(/.*/, { timeout: 15000 }).catch(() => {});
    }
    
    // Final check for successful authentication
    await expect(page.getByText("Lorem Ipsum")).toBeVisible({ timeout: 15000 });
  }

  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});