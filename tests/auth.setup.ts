import { test as setup, expect } from "./fixtures";

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Just save the current state as authenticated
  // This is for testing environments that might not need real authentication
  await page.context().storageState({ path: authFile });
});