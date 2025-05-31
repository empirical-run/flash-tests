import { test as setup, expect } from "./fixtures";

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  await page.getByRole('link', { name: '← Back' }).click();
  await page.getByRole('button', { name: 'Show other options' }).click();
  
  // TODO(agent on page): Check if there's a "demo" or "test" login option, or if we can bypass authentication entirely. Also check if there are any other login methods like GitHub or other OAuth providers that might work.
  
  // Assert that "Lorem Ipsum" text is visible after successful login
  await expect(page.getByText("Lorem Ipsum")).toBeVisible();

  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});