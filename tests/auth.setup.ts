import { test as setup, expect } from "./fixtures";

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Skip authentication for now - handle manually in each test
  // This is a temporary workaround due to auth changes
  console.log('Auth setup skipped - handle manually in tests');
});