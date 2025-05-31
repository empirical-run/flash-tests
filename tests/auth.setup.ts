import { test as setup, expect } from "./fixtures";

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Check if authentication is needed by looking for login indicators
  const isLoginPageVisible = await page.getByText("Log in to Vercel").isVisible({ timeout: 5000 }).catch(() => false);
  
  if (isLoginPageVisible) {
    console.log("Login page detected, attempting authentication...");
    
    // Try different authentication methods based on what's available
    const emailButton = page.locator('[data-testid="login\\/email-input"]');
    const googleButton = page.locator('[data-testid="login\\/google-button"]');
    
    if (await emailButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log("Using email authentication");
      await emailButton.click();
      await emailButton.fill("test@example.com");
      await page.locator('[data-testid="login\\/email-button"]').click();
      
      // Handle verification code if needed
      const codeInput = page.getByLabel('One-time password, we sent it');
      if (await codeInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await codeInput.fill("123456");
        const submitButton = page.getByRole('button', { name: /submit|continue|verify/i });
        if (await submitButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await submitButton.click();
        }
      }
    } else if (await googleButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log("Using Google authentication");
      await googleButton.click();
    }
    
    // Wait a bit for authentication to process
    await page.waitForTimeout(3000);
  } else {
    console.log("No login page detected, assuming already authenticated or auth not required");
  }
  
  // Save the authentication state
  await page.context().storageState({ path: authFile });
});