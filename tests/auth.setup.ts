import { test as setup, expect } from "./fixtures";

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Login with email (email verification required)
  await page.locator('[data-testid="login\\/email-input"]').click();
  await page.locator('[data-testid="login\\/email-input"]').fill("automation-test@example.com");
  await page.locator('[data-testid="login\\/email-button"]').click();
  
  // Return to the main page to see if authentication is needed
  await page.getByRole('link', { name: '← Back' }).click();
  
  // TODO(agent on page): Try to access the application directly or find alternative login methods
  
  // Assert that "Lorem Ipsum" text is visible after successful login
  await expect(page.getByText("Lorem Ipsum")).toBeVisible();

  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});