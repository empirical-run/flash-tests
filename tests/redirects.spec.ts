import { test, expect } from "./fixtures";

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
