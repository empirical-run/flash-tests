import { test as setup, expect } from "./fixtures";

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Wait and check if the app loads directly (protected by Vercel bypass headers)
  await page.waitForTimeout(3000);
  
  // TODO(agent on page): Look for the main app interface or "Lorem Ipsum" text, if not visible try to find login options
  
  // Assert that "Lorem Ipsum" text is visible after successful login
  await expect(page.getByText("Lorem Ipsum")).toBeVisible();

  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});