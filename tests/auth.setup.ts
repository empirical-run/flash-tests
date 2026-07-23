import { test as setup, expect } from "./fixtures";

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Login with email and password
  await page.getByRole('textbox', { name: /email/i }).fill(process.env.AUTOMATED_USER_EMAIL!);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('textbox', { name: 'Password' }).fill(process.env.AUTOMATED_USER_PASSWORD!);
  await page.getByRole('button', { name: 'Submit' }).click();
  
  // Assert that we're logged in by checking for the Dashboard heading
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  // Pin the active project to Lorem Ipsum before capturing storage state.
  // The active project is stored per-context in the `selected_project_repo`
  // cookie; visiting a Lorem Ipsum project URL sets it. Capturing it here means
  // every test starts on Lorem Ipsum regardless of the automation user's
  // server-side 
});