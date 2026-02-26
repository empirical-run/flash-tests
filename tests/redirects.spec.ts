import { test, expect } from "./fixtures";

test.describe("/flash/test-runs Authorization", () => {
  test("shows unauthorized when already logged in", async ({ page }) => {
    await page.goto("/flash/test-runs");

    await expect(page.getByText("Unauthorized")).toBeVisible({ timeout: 10000 });
  });

  test("shows unauthorized after login redirect", async ({ customContextPageProvider }) => {
    // Create a fresh browser context without authentication
    const { page } = await customContextPageProvider({ storageState: undefined });

    // Navigate to the protected page without auth — should redirect to login
    await page.goto("/flash/test-runs");
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fflash%2Ftest-runs/);

    // Perform login via password
    await page.getByRole("button", { name: "Login with password" }).click();
    await page.locator("#email-password").fill(process.env.AUTOMATED_USER_EMAIL!);
    await page.getByPlaceholder("●●●●●●●●").fill(process.env.AUTOMATED_USER_PASSWORD!);
    await page.getByRole("button", { name: "Submit" }).click();

    // After login, should be redirected back to /flash/test-runs
    await expect(page).toHaveURL(/\/flash\/test-runs/, { timeout: 15000 });

    // The page should show Unauthorized since the user has no access to the "flash" project
    await expect(page.getByText("Unauthorized")).toBeVisible({ timeout: 10000 });
  });
});

test.describe("URL Redirects", () => {
  test("auto redirect to project slug routes", async ({ page }) => {
    // Navigate to settings/integrations without project slug
    await page.goto("/settings/integrations");
    
    // Wait for page to load and verify integrations page content is visible (integration names are displayed as card titles, not semantic headings)
    await expect(page.getByText('GitHub', { exact: true }).first()).toBeVisible({ timeout: 10000 });
    
    // Verify that we've been redirected to the correct path with project slug
    await expect(page).toHaveURL(/\/lorem-ipsum\/settings\/integrations/);
  });

  test("session redirection respects auth", async ({ page }) => {
    test.skip(process.env.TEST_RUN_ENVIRONMENT === "preview", "Skipping in preview environment");
    
    // Navigate to session without project slug
    await page.goto("/sessions/50445");
    
    // Verify that unauthorized is shown
    await expect(page.getByText('Unauthorized')).toBeVisible({ timeout: 10000 });
  });
});
