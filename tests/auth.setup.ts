import { test as setup, expect } from "./fixtures";

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Try Google login first
  try {
    await page.locator('[data-testid="login\\/google-button"]').click({ timeout: 5000 });
    // Wait to see if Google login redirects us automatically
    await page.waitForURL('**/auth/callback/**', { timeout: 10000 });
  } catch (error) {
    // If Google login doesn't work, continue with fallback approaches
    console.log('Google login not available, trying other methods');
  }
  
  // Check if we're already authenticated or if there's a demo mode
  const isLoremIpsumVisible = await page.getByText("Lorem Ipsum").isVisible().catch(() => false);
  if (isLoremIpsumVisible) {
    // We're already logged in, save the state and exit
    await page.context().storageState({ path: authFile });
    return;
  }
  
  // If not logged in yet, try to find any demo/test credentials or bypass
  // Look for any test user buttons or demo mode
  const demoButton = page.getByRole('button', { name: /demo|test|guest/i });
  if (await demoButton.isVisible().catch(() => false)) {
    await demoButton.click();
  }
  
  // Assert that "Lorem Ipsum" text is visible after successful login
  await expect(page.getByText("Lorem Ipsum")).toBeVisible();

  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});