import { test as setup, expect } from "./fixtures";

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Use email login with test credentials
  await page.locator('[data-testid="login\\/email-input"]').click();
  await page.locator('[data-testid="login\\/email-input"]').fill("test@empirical.run");
  await page.locator('[data-testid="login\\/email-button"]').click();
  
  // TODO(agent on page): Try to complete the login flow with a test account or look for bypass options specific to test environment
  
  // Assert that "Lorem Ipsum" text is visible after successful login
  await expect(page.getByText("Lorem Ipsum")).toBeVisible();

  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});