import { test, expect } from "./fixtures";
import { loginWithPassword } from "./pages/login";

test.describe("/flash/test-runs Access", () => {
  test("shows not found when already logged in", async ({ page }) => {
    await page.goto("/flash/test-runs");

    await expect(page.getByText('Page not found').first()).toBeVisible();
  });

  test("shows not found after login redirect", async ({ customContextPageProvider }) => {
    // Create a fresh browser context without authentication
    const { page } = await customContextPageProvider({ storageState: undefined });

    // Navigate to the protected page without auth — should redirect to login
    await page.goto("/flash/test-runs");
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fflash%2Ftest-runs/);

    // Perform login via password
    await loginWithPassword(page);

    // After login, should be redirected back to /flash/test-runs
    await expect(page).toHaveURL(/\/flash\/test-runs/, { timeout: 15000 });

    // The page should show a not-found page since the user has no access to the "flash" project
    await expect(page.getByText('Page not found').first()).toBeVisible();
  });
});

test.describe("URL Redirects", () => {
  test("auto redirect to project slug routes", async ({ page }) => {
    // Navigate to settings/integrations without project slug
    // This legacy route now redirects to the Requests settings page
    await page.goto("/settings/integrations");
    
    // Wait for page to load and verify Requests page content is visible
    await expect(page.getByText('Jira', { exact: true }).first()).toBeVisible();
    
    // Verify that we've been redirected to the correct path with project slug
    await expect(page).toHaveURL(/\/lorem-ipsum\/settings\/requests/);
  });

  test("session redirection respects auth", async ({ page }) => {
    test.skip(process.env.TEST_RUN_ENVIRONMENT === "preview", "Skipping in preview environment");
    
    // Navigate to session without project slug
    await page.goto("/sessions/50445");
    
    // Verify that unauthorized is shown
    await expect(page.getByText('Unauthorized')).toBeVisible();
  });
});
