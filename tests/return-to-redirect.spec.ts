import { test, expect } from "./fixtures";
import { loginWithPassword } from "./pages/login";

test.describe("ReturnTo Redirection", () => {
  test("returnTo without query params is preserved", async ({ customContextPageProvider }) => {
    // Create a fresh browser context without authentication
    const { page } = await customContextPageProvider({ storageState: undefined });

    // Navigate to a protected page
    await page.goto("/lorem-ipsum/memories");

    // Should redirect to login with returnTo parameter
    await expect(page).toHaveURL(/\/login\?returnTo=%2Florem-ipsum%2Fmemories/);

    // Perform login via password
    await loginWithPassword(page);

    // After successful login, should be redirected to the original page
    await expect(page).toHaveURL(/\/lorem-ipsum\/memories/, { timeout: 15000 });
    
    // Verify we're on the memories page. Scope to visible page content because
    // the new responsive nav can include hidden duplicate labels.
    await expect(page.locator('main').getByText('Memories', { exact: true })).toBeVisible();
  });

  test("returnTo with query params is preserved", async ({ customContextPageProvider }) => {
    // Create a fresh browser context without authentication
    const { page } = await customContextPageProvider({ storageState: undefined });

    // Navigate to a protected page with session ID in path
    await page.goto("/sessions/39626");

    // Should redirect to login with returnTo parameter including the path
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fsessions%2F39626/);

    // Perform login via password
    await loginWithPassword(page);

    // After successful login, should be redirected to the original page with session ID in path
    await expect(page).toHaveURL(/\/sessions\/39626/, { timeout: 15000 });
  });
});
