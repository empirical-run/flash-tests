import { test as setup, expect } from "./fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // TODO(agent on page): Complete the full authentication flow including any SSO redirects to reach the main app
  
  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});