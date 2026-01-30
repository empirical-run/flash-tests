import { test, expect } from "./fixtures";

test.describe("ReturnTo Redirection", () => {
  test("returnTo without query params is preserved", async ({ customContextPageProvider }) => {
    // Create a fresh browser context without authentication
    const { page } = await customContextPageProvider({ storageState: undefined });

    // Navigate to a protected page
    await page.goto("/lorem-ipsum/app-knowledge");

    // Should redirect to login with returnTo parameter
    await expect(page).toHaveURL(/\/login\?returnTo=%2Florem-ipsum%2Fapp-knowledge/);

    // Perform login via password
    await page.getByRole('button', { name: 'Login with password' }).click();
    await page.locator('#email-password').fill(process.env.AUTOMATED_USER_EMAIL!);
    await page.getByPlaceholder('●●●●●●●●').fill(process.env.AUTOMATED_USER_PASSWORD!);
    await page.getByRole('button', { name: 'Submit' }).click();

    // After successful login, should be redirected to the original page
    await expect(page).toHaveURL(/\/lorem-ipsum\/app-knowledge/, { timeout: 15000 });
    
    // Verify we're on the app knowledge page
    await expect(page.getByRole("heading", { name: "App Knowledge" })).toBeVisible();
  });

  test("returnTo with query params is preserved", async ({ customContextPageProvider }) => {
    // Create a fresh browser context without authentication
    const { page } = await customContextPageProvider({ storageState: undefined });

    // Navigate to a protected page with query params
    await page.goto("/sessions?id=39626");

    // Should redirect to login with returnTo parameter including query params
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fsessions%3Fid%3D39626/);

    // Perform login via password
    await page.getByRole('button', { name: 'Login with password' }).click();
    await page.locator('#email-password').fill(process.env.AUTOMATED_USER_EMAIL!);
    await page.getByPlaceholder('●●●●●●●●').fill(process.env.AUTOMATED_USER_PASSWORD!);
    await page.getByRole('button', { name: 'Submit' }).click();

    // After successful login, should be redirected to the original page with session ID in path
    await expect(page).toHaveURL(/\/sessions\/39626/, { timeout: 15000 });
  });
});
