import { test as setup, expect } from "./fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Show other login options
  await page.getByRole('button', { name: 'Show other options' }).click();
  
  // TODO(agent on page): Try GitHub login or find another working authentication method to access the main app
  
  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});